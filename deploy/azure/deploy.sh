#!/usr/bin/env bash
set -euo pipefail

# Required env vars:
# AZ_SUBSCRIPTION_ID, AZ_LOCATION, AZ_RESOURCE_GROUP, AZ_ACR_NAME
# AZ_CONTAINERAPPS_ENV, AZ_DB_SERVER, AZ_DB_ADMIN_USER, AZ_DB_ADMIN_PASSWORD
# JWT_SECRET

# Optional env vars:
# AZ_DB_NAME (default: expense_tracker)
# BACKEND_APP_NAME (default: fintrack-backend)
# FRONTEND_APP_NAME (default: fintrack-frontend)
# ML_APP_NAME (default: fintrack-ml-service)
# CORS_ORIGIN (default: *)
# ML_TIMEOUT_MS (default: 3000)

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

: "${AZ_SUBSCRIPTION_ID:?Missing AZ_SUBSCRIPTION_ID}"
: "${AZ_LOCATION:?Missing AZ_LOCATION}"
: "${AZ_RESOURCE_GROUP:?Missing AZ_RESOURCE_GROUP}"
: "${AZ_ACR_NAME:?Missing AZ_ACR_NAME}"
: "${AZ_CONTAINERAPPS_ENV:?Missing AZ_CONTAINERAPPS_ENV}"
: "${AZ_DB_SERVER:?Missing AZ_DB_SERVER}"
: "${AZ_DB_ADMIN_USER:?Missing AZ_DB_ADMIN_USER}"
: "${AZ_DB_ADMIN_PASSWORD:?Missing AZ_DB_ADMIN_PASSWORD}"
: "${JWT_SECRET:?Missing JWT_SECRET}"

AZ_DB_NAME="${AZ_DB_NAME:-expense_tracker}"
BACKEND_APP_NAME="${BACKEND_APP_NAME:-fintrack-backend}"
FRONTEND_APP_NAME="${FRONTEND_APP_NAME:-fintrack-frontend}"
ML_APP_NAME="${ML_APP_NAME:-fintrack-ml-service}"
CORS_ORIGIN="${CORS_ORIGIN:-*}"
ML_TIMEOUT_MS="${ML_TIMEOUT_MS:-3000}"

az account set --subscription "$AZ_SUBSCRIPTION_ID"
az extension add --name containerapp --upgrade --yes >/dev/null
az group create -n "$AZ_RESOURCE_GROUP" -l "$AZ_LOCATION" >/dev/null

# Registry
az acr create -n "$AZ_ACR_NAME" -g "$AZ_RESOURCE_GROUP" --sku Basic >/dev/null || true
ACR_LOGIN_SERVER=$(az acr show -n "$AZ_ACR_NAME" -g "$AZ_RESOURCE_GROUP" --query loginServer -o tsv)

# Docker auth to ACR (avoids ACR Tasks, works in GitHub Actions runners)
ACR_TOKEN=$(az acr login -n "$AZ_ACR_NAME" --expose-token --query accessToken -o tsv)
docker login "$ACR_LOGIN_SERVER" --username 00000000-0000-0000-0000-000000000000 --password "$ACR_TOKEN" >/dev/null

# Build/push backend + ML first
docker build -t "$ACR_LOGIN_SERVER/fintrack-backend:latest" "$PROJECT_ROOT/backend"
docker push "$ACR_LOGIN_SERVER/fintrack-backend:latest"

docker build -t "$ACR_LOGIN_SERVER/fintrack-ml:latest" "$PROJECT_ROOT/ml-service"
docker push "$ACR_LOGIN_SERVER/fintrack-ml:latest"

# Container Apps environment
az containerapp env create -n "$AZ_CONTAINERAPPS_ENV" -g "$AZ_RESOURCE_GROUP" -l "$AZ_LOCATION" >/dev/null || true

# PostgreSQL Flexible Server
az postgres flexible-server create \
  -g "$AZ_RESOURCE_GROUP" \
  -n "$AZ_DB_SERVER" \
  -l "$AZ_LOCATION" \
  -u "$AZ_DB_ADMIN_USER" \
  -p "$AZ_DB_ADMIN_PASSWORD" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 16 \
  --yes >/dev/null || true

az postgres flexible-server db create -g "$AZ_RESOURCE_GROUP" -s "$AZ_DB_SERVER" -d "$AZ_DB_NAME" >/dev/null || true
DB_FQDN=$(az postgres flexible-server show -g "$AZ_RESOURCE_GROUP" -n "$AZ_DB_SERVER" --query fullyQualifiedDomainName -o tsv)
DATABASE_URL="postgres://${AZ_DB_ADMIN_USER}:${AZ_DB_ADMIN_PASSWORD}@${DB_FQDN}:5432/${AZ_DB_NAME}?sslmode=require"

# Deploy ML app
az containerapp up \
  -n "$ML_APP_NAME" \
  -g "$AZ_RESOURCE_GROUP" \
  --environment "$AZ_CONTAINERAPPS_ENV" \
  --image "${ACR_LOGIN_SERVER}/fintrack-ml:latest" \
  --target-port 8001 \
  --ingress external \
  --registry-server "$ACR_LOGIN_SERVER" >/dev/null
ML_URL=$(az containerapp show -n "$ML_APP_NAME" -g "$AZ_RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv)

# Deploy backend
az containerapp up \
  -n "$BACKEND_APP_NAME" \
  -g "$AZ_RESOURCE_GROUP" \
  --environment "$AZ_CONTAINERAPPS_ENV" \
  --image "${ACR_LOGIN_SERVER}/fintrack-backend:latest" \
  --target-port 4000 \
  --ingress external \
  --registry-server "$ACR_LOGIN_SERVER" \
  --env-vars NODE_ENV=production PORT=4000 JWT_SECRET="$JWT_SECRET" DATABASE_URL="$DATABASE_URL" ML_BASE_URL="https://${ML_URL}" CORS_ORIGIN="$CORS_ORIGIN" ML_TIMEOUT_MS="$ML_TIMEOUT_MS" >/dev/null
BACKEND_URL=$(az containerapp show -n "$BACKEND_APP_NAME" -g "$AZ_RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv)

# Deploy frontend with backend URL
docker build \
  --build-arg VITE_API_BASE_URL="https://${BACKEND_URL}/api" \
  -t "$ACR_LOGIN_SERVER/fintrack-frontend:latest" \
  "$PROJECT_ROOT/frontend"
docker push "$ACR_LOGIN_SERVER/fintrack-frontend:latest"

az containerapp up \
  -n "$FRONTEND_APP_NAME" \
  -g "$AZ_RESOURCE_GROUP" \
  --environment "$AZ_CONTAINERAPPS_ENV" \
  --image "${ACR_LOGIN_SERVER}/fintrack-frontend:latest" \
  --target-port 80 \
  --ingress external \
  --registry-server "$ACR_LOGIN_SERVER" >/dev/null
FRONTEND_URL=$(az containerapp show -n "$FRONTEND_APP_NAME" -g "$AZ_RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv)

echo "Deployment complete"
echo "Frontend: https://${FRONTEND_URL}"
echo "Backend:  https://${BACKEND_URL}"
echo "ML:       https://${ML_URL}"
