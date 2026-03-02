#!/bin/bash

# Configuration
PROJECT_ID="your-gcp-project-id"
REGION="us-central1"
JOB_NAME="scrape-finviz-hourly"
API_URL="https://your-backend-service-url.run.app/api/cron/scrape-finviz"
SERVICE_ACCOUNT="supply-chain-agent@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Deploying Cloud Scheduler job to hit: $API_URL"

# Create the Cloud Scheduler job
# This job runs at minute 0 past every hour (e.g. 10:00, 11:00, etc)
gcloud scheduler jobs create http $JOB_NAME \
    --project=$PROJECT_ID \
    --location=$REGION \
    --schedule="0 * * * *" \
    --time-zone="UTC" \
    --uri=$API_URL \
    --http-method=POST \
    --oidc-service-account-email=$SERVICE_ACCOUNT \
    --oidc-token-audience=$API_URL

echo "✅ Scheduler job deployed!"
echo "To manually trigger a test run, execute:"
echo "gcloud scheduler jobs run $JOB_NAME --project=$PROJECT_ID --location=$REGION"
