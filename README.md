## Google Cloud

1. Navigate here and download and install the SDK: https://docs.cloud.google.com/sdk/docs/install-sdk

2. Initialize the gcloud CLI
   ```bash
   gcloud init
   ```

3. Log in to GCP, when the browser is opened, click and allow for all the permissions
   ```bash
   gcloud auth application-default login
   ```
4. Set the project to HTF-SCO
   ```bash
   gcloud config set project htf-sco
   ```

## Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the required packages:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and go to:
   ```
   http://localhost:5173
   ```

## Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install the required packages:
   ```bash
   pip install -r requirements.txt
   ```
   
3. Run the Python backend:
   ```bash
   python app.py
   ```
   
