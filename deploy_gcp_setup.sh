#!/usr/bin/env bash
# ==============================================================================
# Galactic Sheep — One-Shot Google Cloud Run + Firestore + GoDaddy Domain Setup
# Domain: https://galacticsheep.co.uk
#
# Run this script inside your personal Google Cloud Shell:
#   https://console.cloud.google.com/?cloudshell=true
#
# Usage:
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

# Note: europe-west1 (Belgium) is the closest European region to the UK that
# natively supports Cloud Run Domain Mapping (`gcloud beta run domain-mappings`)
# with free Google-managed TLS certificates for galacticsheep.co.uk.
REGION="${REGION:-europe-west1}"
FIRESTORE_LOCATION="${FIRESTORE_LOCATION:-eur3}"
SERVICE_NAME="${SERVICE_NAME:-galactic-sheep}"
SA_NAME="galactic-sheep-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
DOMAIN="${DOMAIN:-galacticsheep.co.uk}"
IMAGE_URI="ghcr.io/garynation/tonys-game:latest"

echo "==> [1/5] Configuring project: ${PROJECT_ID} (region: ${REGION})"
gcloud config set project "${PROJECT_ID}"

echo "==> [2/5] Enabling required GCP APIs (Cloud Run & Firestore)..."
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com

echo "==> [3/5] Ensuring Firestore Native (default) database exists in ${FIRESTORE_LOCATION} ($0 Free Tier)..."
if ! gcloud firestore databases describe --database="(default)" >/dev/null 2>&1; then
  gcloud firestore databases create \
    --database="(default)" \
    --location="${FIRESTORE_LOCATION}" \
    --type=firestore-native
else
  echo "    Firestore (default) database already exists."
fi

echo "==> [4/5] Creating least-privilege Service Account (${SA_EMAIL}) with ONLY roles/datastore.user (F9)..."
if ! gcloud iam service-accounts describe "${SA_EMAIL}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SA_NAME}" \
    --display-name="Galactic Sheep Cloud Run Leaderboard SA"
fi

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/datastore.user" \
  --Condition=None >/dev/null

echo "==> [5/5] Deploying ${SERVICE_NAME} to Cloud Run with Denial-of-Wallet caps (F9: max-instances=2, 256Mi, 1 vCPU)..."
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE_URI}" \
  --region="${REGION}" \
  --platform=managed \
  --service-account="${SA_EMAIL}" \
  --allow-unauthenticated \
  --port=8080 \
  --cpu=1 \
  --memory=256Mi \
  --concurrency=80 \
  --min-instances=0 \
  --max-instances=2 \
  --set-env-vars="FIRESTORE_PROJECT=${PROJECT_ID},USE_FIRESTORE=true"

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --format='value(status.url)')"
echo ""
echo "=============================================================================="
echo "✅ Galactic Sheep is LIVE on Cloud Run: ${SERVICE_URL}"
echo "   Health check: ${SERVICE_URL}/api/health"
echo "=============================================================================="
echo ""
echo "Next: To map your GoDaddy domain (${DOMAIN} and www.${DOMAIN}):"
echo "  1. Verify ownership once (if not already verified in Google Search Console):"
echo "       gcloud domains verify ${DOMAIN}"
echo "  2. Create the Cloud Run domain mappings:"
echo "       gcloud beta run domain-mappings create --service=${SERVICE_NAME} --domain=${DOMAIN} --region=${REGION}"
echo "       gcloud beta run domain-mappings create --service=${SERVICE_NAME} --domain=www.${DOMAIN} --region=${REGION}"
echo "  3. Add the displayed A, AAAA, and CNAME (ghs.googlehosted.com.) records in GoDaddy DNS."
