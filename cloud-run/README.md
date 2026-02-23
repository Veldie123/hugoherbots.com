# HugoHerbots Video Processor - Cloud Run

Cloud Run service voor verwerking van grote video's (>500MB) die niet op Replit passen.

## Vereisten

1. Google Cloud Project met:
   - Cloud Run API enabled
   - Cloud Storage API enabled
   - Container Registry API enabled

2. Een Cloud Storage bucket voor tijdelijke video opslag

3. Service Account met permissions:
   - Cloud Run Admin
   - Storage Admin
   - Cloud Build Editor

## Deployment Stappen

### 1. Maak een Cloud Storage bucket

```bash
gcloud storage buckets create gs://hugoherbots-video-processing --location=europe-west1
```

### 2. Kopieer de winter achtergrond

```bash
# Upload de winter background naar assets folder
gsutil cp ../assets/winter*.jpg gs://hugoherbots-video-processing/assets/
```

### 3. Set environment variables in Cloud Run

Ga naar Google Cloud Console > Cloud Run > video-processor > Edit & Deploy New Revision > Variables & Secrets:

| Variable | Beschrijving |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `MUX_TOKEN_ID` | Mux API token ID |
| `MUX_TOKEN_SECRET` | Mux API token secret |
| `OPENAI_API_KEY` | OpenAI API key |
| `ELEVENLABS_API_KEY` | ElevenLabs API key |
| `GCS_BUCKET` | Cloud Storage bucket naam |
| `CLOUD_RUN_WORKER_SECRET` | Shared secret voor authenticatie (zelfde als in Replit) |

### 4. Deploy met Cloud Build

```bash
gcloud builds submit --config cloudbuild.yaml
```

Of handmatig:

```bash
# Build de container
docker build -t gcr.io/YOUR_PROJECT_ID/video-processor .

# Push naar Container Registry
docker push gcr.io/YOUR_PROJECT_ID/video-processor

# Deploy naar Cloud Run
gcloud run deploy video-processor \
  --image gcr.io/YOUR_PROJECT_ID/video-processor \
  --region europe-west1 \
  --memory 4Gi \
  --cpu 2 \
  --timeout 3600 \
  --allow-unauthenticated
```

### 5. Configureer de Replit app

Na deployment, kopieer de Cloud Run URL en voeg toe als environment variable in Replit:

```
CLOUD_RUN_WORKER_URL=https://video-processor-xxxxx-ew.a.run.app
CLOUD_RUN_WORKER_SECRET=<genereer-een-sterke-random-string>
```

**Belangrijk:** Gebruik dezelfde `CLOUD_RUN_WORKER_SECRET` in zowel Replit als Cloud Run. Genereer een sterke random string (bijv. `openssl rand -hex 32`).

## API Endpoints

### POST /process

Verwerk een video.

**Request Body:**
```json
{
  "job_id": "uuid",
  "drive_file_id": "google-drive-file-id",
  "access_token": "google-oauth-token",
  "callback_url": "https://your-replit-app.replit.app/api/worker-callback"
}
```

**Response:**
```json
{
  "success": true,
  "job_id": "uuid",
  "mux_playback_id": "playback-id"
}
```

### GET /health

Health check endpoint.

## Kosten Indicatie

- Cloud Run: ~€0.00002400 per vCPU-second
- Geschatte kosten per video (5 min verwerking): ~€0.15
- Cloud Storage: €0.020 per GB per maand
