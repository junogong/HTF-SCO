# Autonomous News Scraping Pipeline

This directory contains instructions for setting up Google Cloud Scheduler to hit the autonomous Finviz scraping endpoint (`/api/cron/scrape-finviz`). 

When deployed, the intelligence agent will autonomously read the latest headlines every hour, embed them, match them against the Tier 1, 2, and 3 global supply network, and add them to the Action Center if they pose a threat.

## Setup Instructions

1. Ensure your Flask backend is deployed to Cloud Run or a publicly accessible endpoint.
2. Edit `deploy_scheduler.sh` and set `PROJECT_ID` and `API_URL` to your real deployed URL.
3. Make the script executable: `chmod +x deploy_scheduler.sh`
4. Run the script: `./deploy_scheduler.sh`

Once completed, the scheduler will trigger a `POST` request to your backend at the top of every hour. The backend relies on Vertex AI to map these signals to the GraphRAG memory.
