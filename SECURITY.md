# Security Policy

## Supported versions

Only the latest `main` branch is supported.

## Reporting a vulnerability

Please report security issues privately:

- Open a private security advisory in GitHub, or
- Contact the repository owner directly.

Do not open public issues for exploitable vulnerabilities.

## Hardening baseline

- Use strong `JWT_SECRET`
- Restrict backend `CORS_ORIGIN`
- Keep dependencies patched
- Use Azure Key Vault for production secrets
- Enable Azure Monitor + alerts
