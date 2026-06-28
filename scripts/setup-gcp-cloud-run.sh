#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-oceanic-isotope-500713-f3}"
REGION="${REGION:-southamerica-east1}"
SERVICE="${SERVICE:-tmjapp-api}"
REPOSITORY="${REPOSITORY:-tmjapp}"
GITHUB_OWNER="${GITHUB_OWNER:-adm-tmjapp}"
GITHUB_REPO="${GITHUB_REPO:-api}"
BRANCH_PATTERN="${BRANCH_PATTERN:-^main$}"

echo "Using project: ${PROJECT_ID}"
gcloud config set project "${PROJECT_ID}"

echo "Enabling required APIs..."
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com

echo "Creating Artifact Registry repository if missing..."
gcloud artifacts repositories describe "${REPOSITORY}" \
  --location "${REGION}" >/dev/null 2>&1 || \
gcloud artifacts repositories create "${REPOSITORY}" \
  --repository-format docker \
  --location "${REGION}" \
  --description "TMJ Docker images"

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

echo "Granting Cloud Build deploy permissions..."
for role in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/secretmanager.secretAccessor \
  roles/iam.serviceAccountUser
do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member "serviceAccount:${CLOUD_BUILD_SA}" \
    --role "${role}" \
    --condition=None >/dev/null
done

create_secret_from_env() {
  local env_name="$1"
  local secret_name="$2"
  local value

  value="$(grep -E "^${env_name}=" .env 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^\"//' -e 's/\"$//' -e \"s/^'//\" -e \"s/'$//\")"
  if [[ -z "${value}" ]]; then
    echo "Skipping ${secret_name}; ${env_name} is not set in .env"
    return
  fi

  gcloud secrets describe "${secret_name}" >/dev/null 2>&1 || \
    gcloud secrets create "${secret_name}" --replication-policy automatic >/dev/null

  printf '%s' "${value}" | gcloud secrets versions add "${secret_name}" --data-file=- >/dev/null
  echo "Updated secret: ${secret_name}"
}

if [[ "${CREATE_SECRETS_FROM_ENV:-0}" == "1" ]]; then
  echo "Creating/updating Secret Manager values from .env..."
  create_secret_from_env MONGO_URI tmjapp-mongo-uri
  create_secret_from_env JWT_SECRET tmjapp-jwt-secret
  create_secret_from_env MAIL_FROM tmjapp-mail-from
  create_secret_from_env MAIL_HOST tmjapp-mail-host
  create_secret_from_env MAIL_PORT tmjapp-mail-port
  create_secret_from_env MAIL_USER tmjapp-mail-user
  create_secret_from_env MAIL_PASS tmjapp-mail-pass
  create_secret_from_env AWS_ACCESS_KEY_ID tmjapp-aws-access-key-id
  create_secret_from_env AWS_SECRET_ACCESS_KEY tmjapp-aws-secret-access-key
  create_secret_from_env AWS_REGION tmjapp-aws-region
  create_secret_from_env AWS_S3_BUCKET_NAME tmjapp-aws-s3-bucket-name
  create_secret_from_env FIREBASE_SERVICE_ACCOUNT_JSON tmjapp-firebase-service-account-json
  create_secret_from_env FIREBASE_DATABASE_URL tmjapp-firebase-database-url
  create_secret_from_env ASAAS_API_KEY tmjapp-asaas-api-key
  create_secret_from_env ASAAS_BASE_URL tmjapp-asaas-base-url
  create_secret_from_env SWAGGER_ACCESS_CODE tmjapp-swagger-access-code
  create_secret_from_env API_PUBLIC_BASE_URL tmjapp-api-public-base-url
else
  echo "Skipping secrets. Re-run with CREATE_SECRETS_FROM_ENV=1 after reviewing .env."
fi

echo "Creating Cloud Build trigger if missing..."
if ! gcloud builds triggers describe "${SERVICE}-main" --region global >/dev/null 2>&1; then
  gcloud beta builds triggers create github \
    --name "${SERVICE}-main" \
    --repo-owner "${GITHUB_OWNER}" \
    --repo-name "${GITHUB_REPO}" \
    --branch-pattern "${BRANCH_PATTERN}" \
    --build-config cloudbuild.yaml \
    --include-logs-with-status
else
  echo "Trigger already exists: ${SERVICE}-main"
fi

echo "Done. Push to main to deploy ${SERVICE} to Cloud Run."
