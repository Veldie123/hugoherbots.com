#!/bin/bash

echo "========================================="
echo "  HugoHerbots Video Worker Deployment"
echo "========================================="
echo ""

PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    echo "❌ Geen project geselecteerd. Kies eerst een project:"
    gcloud projects list
    echo ""
    echo "Voer uit: gcloud config set project JOUW_PROJECT_ID"
    exit 1
fi

echo "📁 Project: $PROJECT_ID"
echo ""

WORKER_SECRET=$(openssl rand -hex 32)
echo "🔑 Gegenereerde secret: $WORKER_SECRET"
echo ""
echo "⚠️  BEWAAR DEZE SECRET! Je hebt hem straks nodig in Replit."
echo ""

read -p "Druk Enter om door te gaan..."

echo ""
echo "📦 Bestanden aanmaken..."

mkdir -p video-worker
cd video-worker

cat > Dockerfile << 'DOCKERFILE'
FROM python:3.11-slim

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY worker.py .

ENV PORT=8080
EXPOSE 8080

CMD ["python", "worker.py"]
DOCKERFILE

cat > requirements.txt << 'REQUIREMENTS'
flask>=3.0.0
google-auth>=2.23.0
google-auth-oauthlib>=1.1.0
google-api-python-client>=2.100.0
mux-python>=5.0.0
requests>=2.31.0
gunicorn>=21.0.0
REQUIREMENTS

cat > worker.py << 'WORKER'
import os
import subprocess
import tempfile
import requests
from flask import Flask, request, jsonify
import mux_python
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io

app = Flask(__name__)

WORKER_SECRET = os.environ.get('WORKER_SECRET', '')
MUX_TOKEN_ID = os.environ.get('MUX_TOKEN_ID', '')
MUX_TOKEN_SECRET = os.environ.get('MUX_TOKEN_SECRET', '')
CALLBACK_URL = os.environ.get('CALLBACK_URL', '')

configuration = mux_python.Configuration()
configuration.username = MUX_TOKEN_ID
configuration.password = MUX_TOKEN_SECRET
assets_api = mux_python.AssetsApi(mux_python.ApiClient(configuration))

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

@app.route('/process', methods=['POST'])
def process_video():
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer ') or auth_header[7:] != WORKER_SECRET:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.json
    job_id = data.get('job_id')
    drive_file_id = data.get('drive_file_id')
    drive_file_name = data.get('drive_file_name', 'video.mp4')
    
    if not job_id or not drive_file_id:
        return jsonify({'error': 'Missing job_id or drive_file_id'}), 400
    
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = os.path.join(tmpdir, 'input.mp4')
            output_path = os.path.join(tmpdir, 'output.mp4')
            
            send_callback(job_id, 'cloud_downloading', None)
            download_from_drive(drive_file_id, input_path)
            
            send_callback(job_id, 'cloud_processing', None)
            apply_chromakey(input_path, output_path)
            
            send_callback(job_id, 'cloud_uploading', None)
            mux_asset = upload_to_mux(output_path, drive_file_name)
            
            send_callback(job_id, 'mux_processing', {
                'mux_asset_id': mux_asset.id,
                'mux_playback_id': mux_asset.playback_ids[0].id if mux_asset.playback_ids else None
            })
            
        return jsonify({'success': True, 'mux_asset_id': mux_asset.id})
    
    except Exception as e:
        send_callback(job_id, 'cloud_failed', {'error': str(e)})
        return jsonify({'error': str(e)}), 500

def download_from_drive(file_id, output_path):
    creds_json = os.environ.get('GOOGLE_CREDENTIALS_JSON', '{}')
    creds = service_account.Credentials.from_service_account_info(
        eval(creds_json),
        scopes=['https://www.googleapis.com/auth/drive.readonly']
    )
    service = build('drive', 'v3', credentials=creds)
    
    request_obj = service.files().get_media(fileId=file_id)
    with open(output_path, 'wb') as f:
        downloader = MediaIoBaseDownload(f, request_obj)
        done = False
        while not done:
            status, done = downloader.next_chunk()

def apply_chromakey(input_path, output_path):
    background = '/app/winter_bg.jpg'
    if not os.path.exists(background):
        background_url = 'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=1920&h=1080&fit=crop'
        subprocess.run(['curl', '-o', background, background_url], check=True)
    
    cmd = [
        'ffmpeg', '-y',
        '-i', input_path,
        '-i', background,
        '-filter_complex',
        '[0:v]colorkey=0x00FF00:0.30:0.10[ckout];[1:v][ckout]overlay[out]',
        '-map', '[out]',
        '-map', '0:a?',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        output_path
    ]
    subprocess.run(cmd, check=True)

def upload_to_mux(video_path, filename):
    upload = assets_api.create_upload(
        mux_python.CreateUploadRequest(
            new_asset_settings=mux_python.CreateAssetRequest(
                playback_policy=[mux_python.PlaybackPolicy.PUBLIC],
                passthrough=filename
            ),
            timeout=3600
        )
    )
    
    with open(video_path, 'rb') as f:
        requests.put(upload.data.url, data=f, headers={'Content-Type': 'video/mp4'})
    
    import time
    for _ in range(60):
        upload_status = assets_api.get_upload(upload.data.id)
        if upload_status.data.asset_id:
            return assets_api.get_asset(upload_status.data.asset_id).data
        time.sleep(5)
    
    raise Exception('Mux upload timeout')

def send_callback(job_id, status, data):
    if not CALLBACK_URL:
        return
    try:
        requests.post(
            CALLBACK_URL,
            json={'job_id': job_id, 'status': status, 'data': data},
            headers={'Authorization': f'Bearer {WORKER_SECRET}'},
            timeout=10
        )
    except:
        pass

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
WORKER

echo "✅ Bestanden aangemaakt"
echo ""
echo "🚀 Container bouwen en deployen..."

gcloud builds submit --tag gcr.io/$PROJECT_ID/video-worker

echo ""
echo "📦 Deploying naar Cloud Run..."

gcloud run deploy video-worker \
    --image gcr.io/$PROJECT_ID/video-worker \
    --region europe-west1 \
    --platform managed \
    --allow-unauthenticated \
    --memory 2Gi \
    --timeout 900 \
    --set-env-vars "WORKER_SECRET=$WORKER_SECRET"

echo ""
echo "========================================="
echo "  ✅ DEPLOYMENT VOLTOOID!"
echo "========================================="
echo ""

SERVICE_URL=$(gcloud run services describe video-worker --region europe-west1 --format 'value(status.url)')

echo "🌐 Cloud Run URL: $SERVICE_URL"
echo ""
echo "📋 KOPIEER DEZE WAARDEN NAAR REPLIT SECRETS:"
echo ""
echo "   CLOUD_RUN_WORKER_URL = $SERVICE_URL"
echo "   CLOUD_RUN_WORKER_SECRET = $WORKER_SECRET"
echo ""
echo "========================================="
