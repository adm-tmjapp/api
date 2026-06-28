#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-oceanic-isotope-500713-f3}"
REGION="${REGION:-southamerica-east1}"
REPOSITORY="${REPOSITORY:-tmjapp}"
GITHUB_OWNER="${GITHUB_OWNER:-adm-tmjapp}"
GITHUB_REPO="${GITHUB_REPO:-api}"
POOL_ID="${POOL_ID:-github-actions}"
PROVIDER_ID="${PROVIDER_ID:-github}"
SERVICE_ACCOUNT_ID="${SERVICE_ACCOUNT_ID:-github-actions-deployer}"

gcloud config set project "${PROJECT_ID}"

gcloud services enable \
  artifactregistry.googleapis.com \
  iamcredentials.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  sts.googleapis.com

gcloud artifacts repositories describe "${REPOSITORY}" \
  --location "${REGION}" >/dev/null 2>&1 || \
gcloud artifacts repositories create "${REPOSITORY}" \
  --repository-format docker \
  --location "${REGION}" \
  --description "TMJ Docker images"

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
DEPLOY_SA="${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
POOL_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}"
PROVIDER_RESOURCE="${POOL_RESOURCE}/providers/${PROVIDER_ID}"

gcloud iam service-accounts describe "${DEPLOY_SA}" >/dev/null 2>&1 || \
gcloud iam service-accounts create "${SERVICE_ACCOUNT_ID}" \
  --display-name "GitHub Actions Cloud Run deployer"

for role in \
  roles/artifactregistry.writer \
  roles/run.admin \
  roles/secretmanager.secretAccessor \
  roles/iam.serviceAccountUser
do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member "serviceAccount:${DEPLOY_SA}" \
    --role "${role}" \
    --condition=None >/dev/null
done

gcloud iam workload-identity-pools describe "${POOL_ID}" \
  --location global >/dev/null 2>&1 || \
gcloud iam workload-identity-pools create "${POOL_ID}" \
  --location global \
  --display-name "GitHub Actions"

gcloud iam workload-identity-pools providers describe "${PROVIDER_ID}" \
  --workload-identity-pool "${POOL_ID}" \
  --location global >/dev/null 2>&1 || \
gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" \
  --workload-identity-pool "${POOL_ID}" \
  --location global \
  --display-name "GitHub" \
  --issuer-uri "https://token.actions.githubusercontent.com" \
  --attribute-mapping "google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition "assertion.repository == '${GITHUB_OWNER}/${GITHUB_REPO}' && assertion.ref == 'refs/heads/main'"

gcloud iam service-accounts add-iam-policy-binding "${DEPLOY_SA}" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/${POOL_RESOURCE}/attribute.repository/${GITHUB_OWNER}/${GITHUB_REPO}" >/dev/null

cat <<EOF
GitHub Actions GCP identity is ready.

Add these GitHub repository secrets:

GCP_WORKLOAD_IDENTITY_PROVIDER=${PROVIDER_RESOURCE}
GCP_DEPLOY_SERVICE_ACCOUNT=${DEPLOY_SA}
EOF
