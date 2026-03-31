# Azure production deployment (Container Apps)

This project is now production-ready for containerized deployment.

## What was prepared

- Docker image definitions:
  - [backend/Dockerfile](../../backend/Dockerfile)
  - [frontend/Dockerfile](../../frontend/Dockerfile)
  - [ml-service/Dockerfile](../../ml-service/Dockerfile)
- Frontend API URL is env-driven via `VITE_API_BASE_URL`.
- Production compose file: [docker-compose.prod.yml](../../docker-compose.prod.yml)
- Azure deploy script: [deploy/azure/deploy.sh](./deploy.sh)

## Prerequisites

- Azure CLI installed and logged in
- `containerapp` extension installed (`az extension add --name containerapp`)
- Subscription with permission to create:
  - Resource group
  - Azure Container Registry
  - Azure Container Apps
  - Azure Database for PostgreSQL Flexible Server

## Deploy

From project root, set env vars then run:

```bash
chmod +x deploy/azure/deploy.sh
export AZ_SUBSCRIPTION_ID="<subscription-id>"
export AZ_LOCATION="centralindia"
export AZ_RESOURCE_GROUP="rg-fintrack-prod"
export AZ_ACR_NAME="fintrackacr<unique>"
export AZ_CONTAINERAPPS_ENV="cae-fintrack-prod"
export AZ_DB_SERVER="fintrack-db-prod"
export AZ_DB_ADMIN_USER="fintrackadmin"
export AZ_DB_ADMIN_PASSWORD="<strong-password>"
export JWT_SECRET="<long-random-secret>"
./deploy/azure/deploy.sh
```

The script prints public URLs for frontend/backend/ML once complete.

## Post-deploy hardening

- Restrict backend `CORS_ORIGIN` to your frontend domain (not `*`).
- Add custom domains + managed certificates for Container Apps.
- Store secrets in Azure Key Vault and reference them in Container Apps.
- Enable diagnostic logs and alerts in Azure Monitor.
- Configure autoscaling min/max replicas per workload.
