# TMJ API production deploy

This project is configured for two deploy options:

1. GitHub Actions to Cloud Run
2. Google Cloud Build trigger to Cloud Run

The initial production profile is intentionally small:

- Cloud Run min instances: `0`
- Cloud Run max instances: `2`
- CPU: `1`
- Memory: `512Mi`
- Region: `southamerica-east1`

This keeps the first production setup below the target budget for low traffic because there is no always-on VM.

## Option A: GitHub Actions setup

Authenticate the Google Cloud CLI:

```bash
gcloud auth login
```

Then run:

```bash
cd /Users/wildsonsantos/dev-cliente/TMJ/api
./scripts/setup-github-actions-gcp.sh
```

The script prints the values that must be saved as GitHub repository secrets:

```text
GCP_WORKLOAD_IDENTITY_PROVIDER
GCP_DEPLOY_SERVICE_ACCOUNT
```

After that, every push to `main` runs `.github/workflows/deploy-production.yml`.

## Option B: Cloud Build setup

Authenticate the Google Cloud CLI:

```bash
gcloud auth login
```

Then run:

```bash
cd /Users/wildsonsantos/dev-cliente/TMJ/api
./scripts/setup-gcp-cloud-run.sh
```

To create/update Secret Manager values from the local `.env`, review `.env` first and run:

```bash
CREATE_SECRETS_FROM_ENV=1 ./scripts/setup-gcp-cloud-run.sh
```

## Required billing step

The Google Cloud Console currently blocks Cloud Build API activation until billing is activated for project `oceanic-isotope-500713-f3`.

In the Console, approve billing/prepayment only if the budget is ready. After that, the setup script can enable APIs and create the trigger.

## Deploy

After either GitHub Actions or the Cloud Build trigger exists, every push to `main` builds and deploys:

```bash
git push origin main
```

Cloud Run service name:

```text
tmjapp-api
```

Artifact Registry repository:

```text
southamerica-east1-docker.pkg.dev/oceanic-isotope-500713-f3/tmjapp
```
