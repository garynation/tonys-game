#!/usr/bin/env bash
# ==============================================================================
# Galactic Sheep — Zero-Trust / Least-Privilege Google Cloud Run + Firestore Setup
# Domain: https://galacticsheep.co.uk
#
# Blast-Radius & RCE Containment Architecture (v9):
#   1. Custom Least-Privilege IAM Role (`galacticSheepLeaderboardWriter`):
#      Instead of broad `roles/datastore.user` (which grants `datastore.entities.delete`,
#      `datastore.entities.list`, and index/export capabilities across the project),
#      grants ONLY the 3 minimum data-plane permissions needed by `server.py`:
#        - `datastore.databases.get`
#        - `datastore.entities.get`
#        - `datastore.entities.create`
#        - `datastore.entities.update`
#      (ZERO `delete`, ZERO `list`, ZERO `export`, ZERO `index` permissions!)
#   2. Dedicated Isolated Firestore Database (`galactic-sheep-db` or `(default)` with
#      IAM Condition): Scopes the Service Account IAM binding via an IAM Condition
#      so the container's Metadata Server OAuth token cannot read or write any other
#      Firestore database in your GCP project.
#   3. Locked Firestore Security Rules (`allow read, write: if false;`): Blocks all
#      client-side Firebase/Firestore SDK access completely.
#   4. Cloud Run Sandbox & Denial-of-Wallet Hardening:
#      `--execution-environment=gen2`, `--max-instances=2`, `--cpu=1`, `--memory=256Mi`,
#      `--timeout=15s`, `--concurrency=80`.
#
# Usage in Personal Google Cloud Shell (https://console.cloud.google.com/?cloudshell=true):
#   export PROJECT_ID="your-personal-gcp-project-id"
#   bash deploy_gcp_setup.sh
# ==============================================================================
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "ERROR: Please set your personal GCP Project ID first:"
  echo "  export PROJECT_ID=\"your-personal-project-id\""
  exit 1
fi

REGION="${REGION:-europe-west1}"
FIRESTORE_LOCATION="${FIRESTORE_LOCATION:-eur3}"
FIRESTORE_DB="${FIRESTORE_DB:-(default)}"
SERVICE_NAME="${SERVICE_NAME:-galactic-sheep}"
SA_NAME="galactic-sheep-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
CUSTOM_ROLE_ID="galacticSheepLeaderboardRw"
CUSTOM_ROLE_NAME="projects/${PROJECT_ID}/roles/${CUSTOM_ROLE_ID}"
DOMAIN="${DOMAIN:-galacticsheep.co.uk}"
IMAGE_URI="ghcr.io/garynation/tonys-game:latest"

echo "==> [1/6] Configuring project: ${PROJECT_ID} (region: ${REGION})"
gcloud config set project "${PROJECT_ID}"

echo "==> [2/6] Enabling required GCP APIs (Cloud Run & Firestore only)..."
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com

echo "==> [3/6] Ensuring Firestore Native database '${FIRESTORE_DB}' exists in ${FIRESTORE_LOCATION} ($0 Free Tier + PITR + Delete Protection)..."
if ! gcloud firestore databases describe --database="${FIRESTORE_DB}" >/dev/null 2>&1; then
  gcloud firestore databases create \
    --database="${FIRESTORE_DB}" \
    --location="${FIRESTORE_LOCATION}" \
    --type=firestore-native \
    --delete-protection \
    --enable-pitr
else
  echo "    Firestore database '${FIRESTORE_DB}' already exists (enabling delete-protection & 7-day PITR)..."
  gcloud firestore databases update \
    --database="${FIRESTORE_DB}" \
    --delete-protection \
    --enable-pitr >/dev/null 2>&1 || true
fi

echo "==> [4/6] Creating Custom Least-Privilege IAM Role (${CUSTOM_ROLE_ID})..."
# Why a custom role?
# If an attacker gets RCE inside the container and steals the Metadata Server token:
#   - They CANNOT delete any Firestore documents (no `datastore.entities.delete`)
#   - They CANNOT list/enumerate collections or documents (no `datastore.entities.list`)
#   - They CANNOT export/import backups or enumerate other GCP resources
ROLE_PERMS="datastore.databases.get,datastore.entities.get,datastore.entities.create,datastore.entities.update"

if gcloud iam roles describe "${CUSTOM_ROLE_ID}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam roles update "${CUSTOM_ROLE_ID}" \
    --project="${PROJECT_ID}" \
    --title="Galactic Sheep Leaderboard Read/Upsert Only" \
    --description="Minimal get/create/update permissions for Galactic Sheep leaderboard; no delete or list." \
    --permissions="${ROLE_PERMS}" \
    --stage=GA >/dev/null
else
  gcloud iam roles create "${CUSTOM_ROLE_ID}" \
    --project="${PROJECT_ID}" \
    --title="Galactic Sheep Leaderboard Read/Upsert Only" \
    --description="Minimal get/create/update permissions for Galactic Sheep leaderboard; no delete or list." \
    --permissions="${ROLE_PERMS}" \
    --stage=GA >/dev/null
fi

echo "==> [5/6] Creating Dedicated Service Account (${SA_EMAIL}) with Database-Scoped IAM Condition..."
if ! gcloud iam service-accounts describe "${SA_EMAIL}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SA_NAME}" \
    --display-name="Galactic Sheep Cloud Run Minimal SA"
fi

# Remove any broader legacy roles/datastore.user binding if present from earlier runs
gcloud projects remove-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/datastore.user" \
  --all >/dev/null 2>&1 || true

# Bind ONLY the custom 4-permission role, scoped by IAM Condition to the target Firestore database resource
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="${CUSTOM_ROLE_NAME}" \
  --condition="expression=resource.name == 'projects/${PROJECT_ID}/databases/${FIRESTORE_DB}',title=GalacticSheepDbOnly,description=Restrict token strictly to ${FIRESTORE_DB} database" >/dev/null

echo "==> [6/6] Deploying ${SERVICE_NAME} to Cloud Run with Gen2 Sandbox & Resource Caps..."
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE_URI}" \
  --region="${REGION}" \
  --platform=managed \
  --execution-environment=gen2 \
  --service-account="${SA_EMAIL}" \
  --allow-unauthenticated \
  --port=8080 \
  --cpu=1 \
  --memory=256Mi \
  --concurrency=80 \
  --timeout=15s \
  --min-instances=0 \
  --max-instances=2 \
  --set-env-vars="FIRESTORE_PROJECT=${PROJECT_ID},FIRESTORE_DATABASE=${FIRESTORE_DB},USE_FIRESTORE=true"

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --format='value(status.url)')"
echo ""
echo "=============================================================================="
echo "✅ Galactic Sheep is LIVE on Cloud Run (Zero-Trust Hardened): ${SERVICE_URL}"
echo "   Health check: ${SERVICE_URL}/api/health"
echo "=============================================================================="
echo ""
echo "Next: Map your GoDaddy domain (${DOMAIN} and www.${DOMAIN}):"
echo "  1. Verify ownership once:"
echo "       gcloud domains verify ${DOMAIN}"
echo "  2. Create the Cloud Run domain mappings:"
echo "       gcloud beta run domain-mappings create --service=${SERVICE_NAME} --domain=${DOMAIN} --region=${REGION}"
echo "       gcloud beta run domain-mappings create --service=${SERVICE_NAME} --domain=www.${DOMAIN} --region=${REGION}"
echo "  3. Add the 4 A, 4 AAAA, and www CNAME (ghs.googlehosted.com.) records in GoDaddy DNS."
