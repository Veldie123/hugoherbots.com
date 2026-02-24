"""
Google Cloud Run Worker for Video Processing v8.5 (DURATION FILTER)
Full pipeline: chromakey → audio → transcript → RAG → AI Technique Match → Mux
Now with Cloud Tasks-based batch processing for 300+ videos

v8.5 Changes (Duration Filter):
- Added minimum 30-second duration filter after download
- Videos < 30 seconds are marked 'skipped_too_short' and not processed
- Duration is stored in database even for skipped videos
- Prevents processing of test clips and short fragments

v8.4 Changes (AI Technique Matching):
- Added automatic technique matching after transcription
- Uses cosine similarity between transcript embedding and 49 technique embeddings
- Stores ai_suggested_techniek_id and ai_confidence in video_ingest_jobs
- Minimum confidence threshold: 30% for valid matches

v8.3 Changes (Archief Transcription Pipeline):
- Added /batch/transcribe-archief endpoints for tone-of-voice training data
- Simplified pipeline: download → audio → transcript (no chromakey/RAG/Mux)
- Status 'archived_transcribed' for completed archief jobs
- Separate batch state for archief processing

v8.2 Changes (Performance Optimization):
- x264 preset changed from 'slow' → 'medium' for 3-4x faster encoding
- Added mux_playback_id validation before marking job as completed
- Worker should now process videos in ~10 min instead of ~45 min

v8.1 Changes (Self-Healing Batch Processing):
- Added cleanup_stale_jobs() watchdog function to recover stuck jobs
- Added /batch/watchdog endpoint for manual or scheduled cleanup
- /batch/process-next now calls watchdog first for automatic self-healing
- Jobs stuck in transitional states >15 min are auto-reset to 'pending'
- update_status() now sets updated_at for watchdog tracking
- Scheduling delay reduced to 30s (was 3 min) - scheduled AFTER job completes
- get_pending_jobs_count() now includes stuck jobs that will be recovered

v8.0 Changes:
- Cloud Tasks integration for scheduled batch processing
- /batch/start, /batch/stop, /batch/status, /batch/process-next endpoints
- Automatic job chaining with 15 min intervals
- Robust error handling: failed jobs don't break the chain
"""
import os
import json
import tempfile
import subprocess
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import time
import threading
import ssl
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
import mux_python

try:
    from google.cloud import tasks_v2
    from google.protobuf import timestamp_pb2
    CLOUD_TASKS_AVAILABLE = True
except ImportError:
    CLOUD_TASKS_AVAILABLE = False
    print("WARNING: google-cloud-tasks not installed, batch processing disabled")

app = Flask(__name__)

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
MUX_TOKEN_ID = os.environ.get('MUX_TOKEN_ID')
MUX_TOKEN_SECRET = os.environ.get('MUX_TOKEN_SECRET')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
ELEVENLABS_API_KEY = os.environ.get('ELEVENLABS_API_KEY')
WORKER_SECRET = os.environ.get('WORKER_SECRET')

GCP_PROJECT = os.environ.get('GCP_PROJECT', 'hugoherbots-80155')
GCP_REGION = os.environ.get('GCP_REGION', 'europe-west1')
CLOUD_TASKS_QUEUE = os.environ.get('CLOUD_TASKS_QUEUE', 'video-batch-queue')

# WORKER_URL: Set via environment variable during deployment
# This is injected by deploy script: --set-env-vars WORKER_URL=https://...
WORKER_URL = os.environ.get('WORKER_URL', '')
if WORKER_URL:
    print(f"WORKER_URL configured: {WORKER_URL}")
else:
    print("WARNING: WORKER_URL not set - batch queue scheduling will fail")

def get_cloud_run_url():
    """Get Cloud Run service URL from environment variable"""
    return WORKER_URL

BATCH_INTERVAL_SECONDS = 30  # Changed from 3 min to 30s - schedule AFTER job completion
STALE_JOB_THRESHOLD_MINUTES = 15  # Jobs stuck in transitional states for >15 min are considered stale

# Transitional states that indicate a job is actively being processed
TRANSITIONAL_STATES = [
    'cloud_downloading',
    'cloud_chromakey', 
    'cloud_uploading',
    'external_processing',
    'cloud_audio',
    'cloud_transcribing',
    'cloud_embedding',
    'mux_processing',
    'archief_downloading',
    'archief_audio',
    'archief_transcribing'
]
BATCH_STATE_FILE = '/tmp/batch_state.json'

CHROMAKEY_SIMILARITY = 0.29
CHROMAKEY_BLEND = 0.10

ARCHIEF_FOLDER_ID = '1E49dwl2hq_nhoe52bmK0DRn5ZhFdRGyq'

BACKGROUNDS = [
    '/app/backgrounds/bg_kantoor_ochtend_1080p.jpg',
    '/app/backgrounds/bg_kantoor_golden_hour_1080p.jpg',
    '/app/backgrounds/bg_kantoor_avond_1080p.jpg',
]
BACKGROUND_BATCH_SIZE = 10  # Switch background every N videos

mux_uploads_api = None
mux_assets_api = None
tasks_client = None

def init_mux():
    global mux_uploads_api, mux_assets_api
    if MUX_TOKEN_ID and MUX_TOKEN_SECRET and not mux_uploads_api:
        config = mux_python.Configuration()
        config.username = MUX_TOKEN_ID
        config.password = MUX_TOKEN_SECRET
        client = mux_python.ApiClient(config)
        mux_uploads_api = mux_python.DirectUploadsApi(client)
        mux_assets_api = mux_python.AssetsApi(client)

def init_cloud_tasks():
    global tasks_client
    if CLOUD_TASKS_AVAILABLE and not tasks_client:
        try:
            tasks_client = tasks_v2.CloudTasksClient()
            print(f"Cloud Tasks client initialized for {GCP_PROJECT}/{GCP_REGION}/{CLOUD_TASKS_QUEUE}")
        except Exception as e:
            print(f"Failed to init Cloud Tasks: {e}")
            return False
    return CLOUD_TASKS_AVAILABLE and tasks_client is not None


def get_batch_state():
    """Get batch_active state from Supabase or fallback to file"""
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            resp = requests.get(
                f'{SUPABASE_URL}/rest/v1/video_batch_state?select=*&limit=1',
                headers={
                    'apikey': SUPABASE_KEY,
                    'Authorization': f'Bearer {SUPABASE_KEY}'
                },
                timeout=10
            )
            if resp.status_code == 200:
                data = resp.json()
                if data:
                    state = data[0]
                    return {
                        'batch_active': state.get('batch_active', False),
                        'started_at': state.get('started_at'),
                        'total_jobs': state.get('total_jobs', 0),
                        'processed_jobs': state.get('processed_jobs', 0),
                        'failed_jobs': state.get('failed_jobs', 0)
                    }
        except Exception as e:
            print(f"Supabase batch state error: {e}")
    
    try:
        with open(BATCH_STATE_FILE, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {'batch_active': False, 'total_jobs': 0, 'processed_jobs': 0, 'failed_jobs': 0}
    except Exception as e:
        print(f"File batch state error: {e}")
        return {'batch_active': False, 'total_jobs': 0, 'processed_jobs': 0, 'failed_jobs': 0}


def set_batch_state(batch_active, **kwargs):
    """Update batch state in Supabase (upsert) and fallback file"""
    state = get_batch_state()
    state['batch_active'] = batch_active
    state.update(kwargs)
    
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            data = {
                'id': 1,
                'batch_active': batch_active,
                'updated_at': datetime.utcnow().isoformat()
            }
            data.update(kwargs)
            
            resp = requests.post(
                f'{SUPABASE_URL}/rest/v1/video_batch_state',
                json=data,
                headers={
                    'apikey': SUPABASE_KEY,
                    'Authorization': f'Bearer {SUPABASE_KEY}',
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                timeout=10
            )
            if resp.status_code in [200, 201]:
                print(f"Batch state updated in Supabase: batch_active={batch_active}")
        except Exception as e:
            print(f"Supabase batch state update error: {e}")
    
    try:
        with open(BATCH_STATE_FILE, 'w') as f:
            json.dump(state, f)
        print(f"Batch state saved to file: batch_active={batch_active}")
    except Exception as e:
        print(f"File batch state save error: {e}")
    
    return state


def get_pending_jobs_count():
    """Get count of pending jobs from Supabase (excludes archief folder)
    Also counts stuck jobs that will be recovered by watchdog"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return 0
    
    count = 0
    
    # Count regular pending/failed jobs
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/video_ingest_jobs?select=id&status=in.(pending,failed,chromakey_failed)&drive_folder_id=neq.{ARCHIEF_FOLDER_ID}",
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Prefer': 'count=exact'
            },
            timeout=10
        )
        if resp.status_code == 200:
            header_count = resp.headers.get('content-range', '').split('/')[-1]
            count = int(header_count) if header_count and header_count != '*' else len(resp.json())
    except Exception as e:
        print(f"Error getting pending jobs count: {e}")
    
    # Also count stuck jobs that will be recovered by watchdog
    try:
        states_param = ','.join(TRANSITIONAL_STATES)
        cutoff_time = (datetime.utcnow() - timedelta(minutes=STALE_JOB_THRESHOLD_MINUTES)).isoformat()
        
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/video_ingest_jobs?select=id&status=in.({states_param})&updated_at=lt.{cutoff_time}&drive_folder_id=neq.{ARCHIEF_FOLDER_ID}",
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Prefer': 'count=exact'
            },
            timeout=10
        )
        if resp.status_code == 200:
            header_count = resp.headers.get('content-range', '').split('/')[-1]
            stuck_count = int(header_count) if header_count and header_count != '*' else len(resp.json())
            if stuck_count > 0:
                print(f"[Watchdog] Found {stuck_count} stuck jobs that will be recovered")
            count += stuck_count
    except Exception as e:
        print(f"Error getting stuck jobs count: {e}")
    
    return count


def cleanup_stale_jobs():
    """
    Watchdog function: Find and reset jobs stuck in transitional states for >15 minutes.
    This enables self-healing batch processing - crashed jobs are automatically recovered.
    
    Returns: count of reset jobs
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[Watchdog] No Supabase credentials, cannot cleanup stale jobs")
        return 0
    
    print("\n[Watchdog] Checking for stale jobs stuck in transitional states...")
    
    # Calculate cutoff time (15 minutes ago)
    cutoff_time = (datetime.utcnow() - timedelta(minutes=STALE_JOB_THRESHOLD_MINUTES)).isoformat()
    states_param = ','.join(TRANSITIONAL_STATES)
    
    reset_count = 0
    
    try:
        # Find jobs in transitional states with updated_at older than cutoff
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/video_ingest_jobs"
            f"?status=in.({states_param})"
            f"&updated_at=lt.{cutoff_time}"
            f"&drive_folder_id=neq.{ARCHIEF_FOLDER_ID}"
            f"&select=id,status,drive_file_name,updated_at",
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}'
            },
            timeout=15
        )
        
        if resp.status_code != 200:
            print(f"[Watchdog] Error fetching stale jobs: {resp.status_code} - {resp.text[:200]}")
            return 0
        
        stale_jobs = resp.json()
        
        if not stale_jobs:
            print("[Watchdog] No stale jobs found - all clear!")
            return 0
        
        print(f"[Watchdog] Found {len(stale_jobs)} stale jobs to reset:")
        
        for job in stale_jobs:
            job_id = job['id']
            old_status = job.get('status', 'unknown')
            file_name = job.get('drive_file_name', 'unknown')
            updated_at = job.get('updated_at', 'unknown')
            
            print(f"[Watchdog]   - {job_id}: {file_name} (was: {old_status}, stuck since: {updated_at})")
            
            # Reset job to pending with error message
            error_msg = f"[Watchdog Reset] Job was stuck in '{old_status}' state for >{STALE_JOB_THRESHOLD_MINUTES} min. Auto-reset at {datetime.utcnow().isoformat()}"
            
            patch_resp = requests.patch(
                f'{SUPABASE_URL}/rest/v1/video_ingest_jobs?id=eq.{job_id}',
                json={
                    'status': 'pending',
                    'error_message': error_msg,
                    'updated_at': datetime.utcnow().isoformat()
                },
                headers={
                    'apikey': SUPABASE_KEY,
                    'Authorization': f'Bearer {SUPABASE_KEY}',
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                timeout=10
            )
            
            if patch_resp.status_code in [200, 204]:
                reset_count += 1
                print(f"[Watchdog]     ✅ Reset to pending")
            else:
                print(f"[Watchdog]     ❌ Failed to reset: {patch_resp.status_code}")
        
        print(f"[Watchdog] ✅ Reset {reset_count}/{len(stale_jobs)} stale jobs to pending")
        
    except Exception as e:
        print(f"[Watchdog] Error during cleanup: {e}")
        import traceback
        traceback.print_exc()
    
    return reset_count


def get_next_pending_job():
    """Get the oldest pending job that needs processing (excludes archief folder)"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("No Supabase credentials for job lookup")
        return None
    
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/video_ingest_jobs"
            f"?status=in.(pending,failed,chromakey_failed)"
            f"&drive_folder_id=neq.{ARCHIEF_FOLDER_ID}"
            f"&order=created_at.asc"
            f"&limit=1"
            f"&select=id,drive_file_id,status,drive_file_name,created_at",
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}'
            },
            timeout=15
        )
        if resp.status_code == 200:
            jobs = resp.json()
            if jobs:
                job = jobs[0]
                print(f"Found pending job: {job['id']} ({job.get('drive_file_name', 'unknown')}) - status: {job['status']}")
                return job
            else:
                print("No pending jobs found (archief excluded)")
                return None
        else:
            print(f"Error fetching pending jobs: {resp.status_code} - {resp.text[:200]}")
    except Exception as e:
        print(f"Error getting next pending job: {e}")
    return None


def get_pending_archief_jobs_count():
    """Get count of archief jobs that need transcription (no transcript yet)"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return 0
    
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/video_ingest_jobs"
            f"?select=id"
            f"&drive_folder_id=eq.{ARCHIEF_FOLDER_ID}"
            f"&transcript=is.null"
            f"&status=neq.archived_transcribed",
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Prefer': 'count=exact'
            },
            timeout=10
        )
        if resp.status_code == 200:
            header_count = resp.headers.get('content-range', '').split('/')[-1]
            count = int(header_count) if header_count and header_count != '*' else len(resp.json())
            return count
    except Exception as e:
        print(f"Error getting pending archief jobs count: {e}")
    return 0


def get_next_pending_archief_job():
    """Get the oldest archief job that needs transcription (no transcript yet)"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("No Supabase credentials for archief job lookup")
        return None
    
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/video_ingest_jobs"
            f"?drive_folder_id=eq.{ARCHIEF_FOLDER_ID}"
            f"&transcript=is.null"
            f"&status=neq.archived_transcribed"
            f"&order=created_at.asc"
            f"&limit=1"
            f"&select=id,drive_file_id,status,drive_file_name,created_at",
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}'
            },
            timeout=15
        )
        if resp.status_code == 200:
            jobs = resp.json()
            if jobs:
                job = jobs[0]
                print(f"[Archief] Found pending job: {job['id']} ({job.get('drive_file_name', 'unknown')})")
                return job
            else:
                print("[Archief] No pending archief jobs found")
                return None
        else:
            print(f"[Archief] Error fetching jobs: {resp.status_code} - {resp.text[:200]}")
    except Exception as e:
        print(f"[Archief] Error getting next job: {e}")
    return None


def claim_job(job_id):
    """Atomically claim a job by updating status to external_processing"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return False
    
    try:
        resp = requests.patch(
            f'{SUPABASE_URL}/rest/v1/video_ingest_jobs?id=eq.{job_id}&status=in.(pending,failed,chromakey_failed)',
            json={
                'status': 'external_processing',
                'error_message': f'Claimed at {datetime.utcnow().isoformat()}'
            },
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            timeout=10
        )
        if resp.status_code == 200:
            updated = resp.json()
            if updated:
                print(f"[{job_id}] ✅ Job claimed (status → external_processing)")
                return True
            else:
                print(f"[{job_id}] ❌ Job already claimed by another worker")
                return False
        else:
            print(f"[{job_id}] ❌ Claim failed: {resp.status_code}")
            return False
    except Exception as e:
        print(f"[{job_id}] ❌ Claim error: {e}")
        return False


GOOGLE_CLOUD_SECRET = os.environ.get('GOOGLE_CLOUD_SECRET')
SECRET_MANAGER_SECRET_NAME = 'google-drive-service-account'

_cached_service_account_info = None

def get_service_account_info():
    """Get service account info from env var or Secret Manager"""
    global _cached_service_account_info
    
    if _cached_service_account_info:
        return _cached_service_account_info
    
    # Try environment variable first
    if GOOGLE_CLOUD_SECRET:
        import json
        import base64
        try:
            _cached_service_account_info = json.loads(GOOGLE_CLOUD_SECRET)
        except json.JSONDecodeError:
            _cached_service_account_info = json.loads(base64.b64decode(GOOGLE_CLOUD_SECRET))
        print(f"Loaded service account from env var: {_cached_service_account_info.get('client_email', 'unknown')}")
        return _cached_service_account_info
    
    # Try Google Secret Manager
    try:
        from google.cloud import secretmanager
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{GCP_PROJECT}/secrets/{SECRET_MANAGER_SECRET_NAME}/versions/latest"
        response = client.access_secret_version(request={"name": name})
        secret_value = response.payload.data.decode("utf-8")
        
        import json
        _cached_service_account_info = json.loads(secret_value)
        print(f"Loaded service account from Secret Manager: {_cached_service_account_info.get('client_email', 'unknown')}")
        return _cached_service_account_info
    except Exception as e:
        print(f"Failed to load from Secret Manager: {e}")
    
    return None

def get_google_access_token():
    """Get Google access token from service account for Drive API"""
    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
        
        key_data = get_service_account_info()
        
        if key_data:
            credentials = service_account.Credentials.from_service_account_info(
                key_data,
                scopes=['https://www.googleapis.com/auth/drive.readonly']
            )
            credentials.refresh(Request())
            return credentials.token
        else:
            # Fallback to default credentials (Cloud Run service identity)
            import google.auth
            credentials, project = google.auth.default(
                scopes=['https://www.googleapis.com/auth/drive.readonly']
            )
            credentials.refresh(Request())
            print("Using Cloud Run default credentials")
            return credentials.token
    except Exception as e:
        print(f"Failed to get Google access token: {e}")
        import traceback
        traceback.print_exc()
        return None


def schedule_next_job(delay_seconds=BATCH_INTERVAL_SECONDS):
    """Schedule next job using Cloud Tasks (preferred) or self-invocation (fallback)"""
    
    worker_url = get_cloud_run_url()
    
    # Try Cloud Tasks first (preferred)
    if CLOUD_TASKS_AVAILABLE and init_cloud_tasks():
        if not worker_url:
            print("WORKER_URL not available, falling back to self-invocation")
        else:
            try:
                parent = tasks_client.queue_path(GCP_PROJECT, GCP_REGION, CLOUD_TASKS_QUEUE)
                
                schedule_time = timestamp_pb2.Timestamp()
                schedule_time.FromDatetime(datetime.utcnow() + timedelta(seconds=delay_seconds))
                
                task = {
                    'http_request': {
                        'http_method': tasks_v2.HttpMethod.POST,
                        'url': f"{worker_url}/batch/process-next",
                        'headers': {
                            'Content-Type': 'application/json',
                            'Authorization': f'Bearer {WORKER_SECRET}'
                        },
                        'body': json.dumps({'scheduled': True, 'timestamp': datetime.utcnow().isoformat()}).encode()
                    },
                    'schedule_time': schedule_time
                }
                
                response = tasks_client.create_task(parent=parent, task=task)
                task_name = response.name.split('/')[-1]
                print(f"✅ Scheduled next job via Cloud Tasks in {delay_seconds}s: {task_name}")
                return task_name
            except Exception as e:
                print(f"⚠️ Cloud Tasks failed: {e}, using self-invocation fallback")
    
    # Self-invocation fallback is NOT reliable on Cloud Run
    # Cloud Run terminates background threads after request completes
    print("❌ Cloud Tasks not available and self-invocation is not reliable on Cloud Run")
    print("   → Install google-cloud-tasks package and configure Cloud Tasks queue")
    print("   → Current environment: CLOUD_TASKS_AVAILABLE =", CLOUD_TASKS_AVAILABLE)
    return None


def cancel_pending_tasks():
    """Cancel all pending Cloud Tasks in the queue"""
    if not init_cloud_tasks():
        print("Cloud Tasks not available")
        return 0
    
    cancelled = 0
    try:
        parent = tasks_client.queue_path(GCP_PROJECT, GCP_REGION, CLOUD_TASKS_QUEUE)
        
        for task in tasks_client.list_tasks(parent=parent):
            try:
                tasks_client.delete_task(name=task.name)
                cancelled += 1
                print(f"Cancelled task: {task.name.split('/')[-1]}")
            except Exception as e:
                print(f"Failed to cancel task {task.name}: {e}")
        
        print(f"✅ Cancelled {cancelled} pending tasks")
    except Exception as e:
        print(f"Error listing/cancelling tasks: {e}")
    
    return cancelled


def update_status(job_id, status, error=None, **kwargs):
    """Update job status in Supabase. Always sets updated_at for watchdog tracking."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print(f"[{job_id}] ❌ Status: {status} - NO SUPABASE CREDENTIALS!")
        print(f"[{job_id}]    SUPABASE_URL: {'set' if SUPABASE_URL else 'MISSING'}")
        print(f"[{job_id}]    SUPABASE_KEY: {'set' if SUPABASE_KEY else 'MISSING'}")
        return False
    try:
        data = {
            'status': status,
            'updated_at': datetime.utcnow().isoformat()  # Always update timestamp for watchdog
        }
        if error:
            data['error_message'] = error
        data.update(kwargs)
        resp = requests.patch(
            f'{SUPABASE_URL}/rest/v1/video_ingest_jobs?id=eq.{job_id}',
            json=data,
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            timeout=30
        )
        if resp.status_code in [200, 204]:
            print(f"[{job_id}] ✅ Status updated: {status} (updated_at refreshed)")
            return True
        else:
            print(f"[{job_id}] ❌ Supabase error {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"[{job_id}] ❌ Failed to update status: {e}")
        return False

def transcribe_audio(audio_path):
    if not ELEVENLABS_API_KEY:
        print("No ElevenLabs API key")
        return ""
    
    print(f"Transcribing {audio_path}...")
    with open(audio_path, 'rb') as f:
        resp = requests.post(
            'https://api.elevenlabs.io/v1/speech-to-text',
            headers={'xi-api-key': ELEVENLABS_API_KEY},
            files={'file': ('audio.mp3', f, 'audio/mpeg')},
            data={'model_id': 'scribe_v1', 'language_code': 'nld'}
        )
    
    if resp.status_code == 200:
        text = resp.json().get('text', '')
        print(f"Transcript: {len(text)} characters")
        return text
    else:
        print(f"ElevenLabs error: {resp.status_code} - {resp.text[:200]}")
        return ""

def generate_embedding(text):
    if not OPENAI_API_KEY or not text:
        return None
    
    try:
        resp = requests.post(
            'https://api.openai.com/v1/embeddings',
            headers={
                'Authorization': f'Bearer {OPENAI_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={'input': text[:8000], 'model': 'text-embedding-3-small'}
        )
        if resp.status_code == 200:
            return resp.json()['data'][0]['embedding']
        else:
            print(f"OpenAI error: {resp.status_code}")
    except Exception as e:
        print(f"Embedding error: {e}")
    return None

def save_to_rag(job_id, transcript, embedding):
    """Save transcript and embedding to RAG documents. Returns document ID or None."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print(f"[{job_id}] RAG save skipped: missing SUPABASE credentials")
        return None
    
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }
    
    try:
        # First check if a RAG document already exists for this job
        check_resp = requests.get(
            f'{SUPABASE_URL}/rest/v1/rag_documents?metadata->>job_id=eq.{job_id}&select=id',
            headers=headers
        )
        if check_resp.status_code == 200:
            existing = check_resp.json()
            if existing and len(existing) > 0:
                doc_id = existing[0].get('id')
                print(f"[{job_id}] RAG document already exists: {doc_id}")
                return doc_id
        
        # Insert new RAG document
        resp = requests.post(
            f'{SUPABASE_URL}/rest/v1/rag_documents',
            json={
                'content': transcript,
                'embedding': embedding,
                'metadata': {'source': 'video_pipeline', 'job_id': job_id}
            },
            headers=headers
        )
        
        if resp.status_code in [200, 201]:
            doc_id = resp.json()[0].get('id')
            print(f"[{job_id}] Saved to RAG: {doc_id}")
            return doc_id
        elif resp.status_code == 409:
            # Conflict - document already exists, try to fetch it
            print(f"[{job_id}] RAG conflict (409), fetching existing document...")
            check_resp = requests.get(
                f'{SUPABASE_URL}/rest/v1/rag_documents?metadata->>job_id=eq.{job_id}&select=id',
                headers=headers
            )
            if check_resp.status_code == 200:
                existing = check_resp.json()
                if existing and len(existing) > 0:
                    doc_id = existing[0].get('id')
                    print(f"[{job_id}] Found existing RAG document: {doc_id}")
                    return doc_id
            print(f"[{job_id}] RAG 409 but couldn't find existing document")
        else:
            print(f"[{job_id}] RAG save failed: {resp.status_code} - {resp.text[:200]}")
    except Exception as e:
        print(f"[{job_id}] RAG save error: {e}")
    
    return None


def cosine_similarity(vec1, vec2):
    """Calculate cosine similarity between two vectors."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    magnitude1 = sum(a * a for a in vec1) ** 0.5
    magnitude2 = sum(b * b for b in vec2) ** 0.5
    
    if magnitude1 == 0 or magnitude2 == 0:
        return 0.0
    
    return dot_product / (magnitude1 * magnitude2)


def match_technique_from_embedding(transcript_embedding, job_id):
    """
    Match transcript embedding against technique embeddings in database.
    Returns (techniek_id, confidence_score) or (None, None) if no match found.
    
    Only techniques with doc_type='techniek' are considered.
    Minimum confidence threshold: 0.30 (30%)
    """
    if not transcript_embedding or not SUPABASE_URL or not SUPABASE_KEY:
        return None, None
    
    MIN_CONFIDENCE = 0.30  # Minimum 30% similarity for a valid match
    
    try:
        # Fetch all technique embeddings from rag_documents
        resp = requests.get(
            f'{SUPABASE_URL}/rest/v1/rag_documents?doc_type=eq.techniek&select=id,techniek_id,title,embedding',
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
            }
        )
        
        if resp.status_code != 200:
            print(f"[{job_id}] Failed to fetch technique embeddings: {resp.status_code}")
            return None, None
        
        techniques = resp.json()
        if not techniques:
            print(f"[{job_id}] No technique embeddings found in database")
            return None, None
        
        print(f"[{job_id}] Matching against {len(techniques)} techniques...")
        
        best_match = None
        best_score = 0.0
        
        for tech in techniques:
            tech_embedding = tech.get('embedding')
            if not tech_embedding:
                continue
            
            # Parse embedding if it's a string
            if isinstance(tech_embedding, str):
                try:
                    tech_embedding = json.loads(tech_embedding)
                except:
                    continue
            
            similarity = cosine_similarity(transcript_embedding, tech_embedding)
            
            if similarity > best_score:
                best_score = similarity
                best_match = tech
        
        if best_match and best_score >= MIN_CONFIDENCE:
            techniek_id = best_match.get('techniek_id')
            title = best_match.get('title', 'Onbekend')
            print(f"[{job_id}] AI Techniek Match: {title} (confidence: {best_score:.1%})")
            return techniek_id, round(best_score, 4)
        else:
            print(f"[{job_id}] No confident technique match (best: {best_score:.1%}, min: {MIN_CONFIDENCE:.0%})")
            return None, None
            
    except Exception as e:
        print(f"[{job_id}] Technique matching error: {e}")
        return None, None

def download_from_drive_resumable(drive_file_id, access_token, output_path, job_id, max_retries=10, max_time=1800):
    """
    Resumable download from Google Drive with Range headers.
    Handles SSL errors and connection drops by resuming from last byte.
    Uses longer backoff times and more retries for large files.
    """
    url = f"https://www.googleapis.com/drive/v3/files/{drive_file_id}?alt=media"
    headers = {'Authorization': f'Bearer {access_token}'}
    
    downloaded = 0
    total_size = 0
    start_time = time.time()
    last_log = time.time()
    retry_count = 0
    
    def create_session():
        s = requests.Session()
        adapter = HTTPAdapter(
            max_retries=Retry(total=0),
            pool_connections=1,
            pool_maxsize=1
        )
        s.mount('https://', adapter)
        return s
    
    with open(output_path, 'wb') as f:
        while True:
            if time.time() - start_time > max_time:
                raise Exception(f"Download timeout: exceeded {max_time}s")
            
            try:
                session = create_session()
                
                range_headers = headers.copy()
                if downloaded > 0:
                    range_headers['Range'] = f'bytes={downloaded}-'
                    print(f"[{job_id}] Resuming download from {downloaded / 1024 / 1024:.1f} MB")
                
                resp = session.get(url, headers=range_headers, stream=True, timeout=(60, 300))
                
                if resp.status_code == 401:
                    raise Exception("Access token expired or invalid")
                elif resp.status_code == 403:
                    raise Exception("Access denied to file")
                
                if resp.status_code == 206:
                    content_range = resp.headers.get('Content-Range', '')
                    if '/' in content_range:
                        total_size = int(content_range.split('/')[-1])
                elif resp.status_code == 200:
                    if downloaded > 0:
                        print(f"[{job_id}] Server reset, restarting download")
                        f.seek(0)
                        f.truncate()
                        downloaded = 0
                    total_size = int(resp.headers.get('content-length', 0))
                    if total_size > 0:
                        print(f"[{job_id}] File size: {total_size / 1024 / 1024:.1f} MB")
                elif resp.status_code == 416:
                    print(f"[{job_id}] Download already complete")
                    break
                else:
                    resp.raise_for_status()
                
                for chunk in resp.iter_content(chunk_size=65536):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        
                        if time.time() - last_log > 30:
                            mb_done = downloaded / 1024 / 1024
                            mb_total = total_size / 1024 / 1024 if total_size else 0
                            pct = (downloaded / total_size * 100) if total_size else 0
                            elapsed = time.time() - start_time
                            speed = downloaded / 1024 / 1024 / elapsed if elapsed > 0 else 0
                            progress_msg = f"Download: {mb_done:.0f}/{mb_total:.0f} MB ({pct:.0f}%) - {speed:.1f} MB/s"
                            print(f"[{job_id}] {progress_msg}")
                            update_progress(job_id, progress_msg)
                            last_log = time.time()
                
                if total_size > 0 and downloaded >= total_size:
                    break
                elif total_size == 0 and downloaded > 0:
                    total_size = downloaded
                    break
                    
            except (requests.exceptions.SSLError, 
                    requests.exceptions.ConnectionError,
                    requests.exceptions.ChunkedEncodingError,
                    requests.exceptions.Timeout,
                    ssl.SSLError) as e:
                retry_count += 1
                if retry_count > max_retries:
                    raise Exception(f"Max retries ({max_retries}) exceeded after {downloaded / 1024 / 1024:.1f} MB: {str(e)[:150]}")
                
                wait_time = min(60, 10 * (2 ** (retry_count - 1)))
                print(f"[{job_id}] Connection error (retry {retry_count}/{max_retries}), waiting {wait_time}s...")
                print(f"[{job_id}]   Error: {str(e)[:100]}")
                print(f"[{job_id}]   Downloaded so far: {downloaded / 1024 / 1024:.1f} MB")
                time.sleep(wait_time)
                continue
            finally:
                try:
                    session.close()
                except:
                    pass
    
    file_size = os.path.getsize(output_path)
    elapsed = time.time() - start_time
    print(f"[{job_id}] ✅ Download complete: {file_size / 1024 / 1024:.1f} MB in {elapsed:.0f}s ({retry_count} retries)")
    return file_size


def update_progress(job_id, message):
    """Update job with progress message for visibility"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return
    try:
        requests.patch(
            f'{SUPABASE_URL}/rest/v1/video_ingest_jobs?id=eq.{job_id}',
            json={'error_message': f'[Progress] {message}'},
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            timeout=5
        )
    except:
        pass


@app.route('/health', methods=['GET'])
def health():
    try:
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True)
        ffmpeg_version = result.stdout.split('\n')[0] if result.returncode == 0 else 'unknown'
    except:
        ffmpeg_version = 'not installed'
    
    batch_state = get_batch_state()
    
    sa_info = get_service_account_info()
    sa_email = sa_info.get('client_email', 'none') if sa_info else 'failed_to_load'
    
    return jsonify({
        'status': 'ok',
        'version': '8.2-performance',
        'ffmpeg_version': ffmpeg_version,
        'has_mux': bool(MUX_TOKEN_ID and MUX_TOKEN_SECRET),
        'has_elevenlabs': bool(ELEVENLABS_API_KEY),
        'has_openai': bool(OPENAI_API_KEY),
        'has_supabase_url': bool(SUPABASE_URL),
        'has_supabase_key': bool(SUPABASE_KEY),
        'supabase_ready': bool(SUPABASE_URL and SUPABASE_KEY),
        'cloud_tasks_available': CLOUD_TASKS_AVAILABLE,
        'worker_url': WORKER_URL[:50] + '...' if WORKER_URL else None,
        'batch_active': batch_state.get('batch_active', False),
        'service_account': sa_email
    })


@app.route('/debug/drive-test', methods=['GET'])
def debug_drive_test():
    """Test Google Drive API access with current credentials"""
    auth = request.headers.get('Authorization', '')
    if not WORKER_SECRET or auth != f'Bearer {WORKER_SECRET}':
        return jsonify({'error': 'Unauthorized'}), 401
    
    file_id = request.args.get('file_id', '1iaRAByySJPXpcJ6I3aoXwlb0SR3q3wKZ')
    
    result = {
        'file_id': file_id,
        'steps': []
    }
    
    sa_info = get_service_account_info()
    if not sa_info:
        result['error'] = 'Failed to load service account from Secret Manager'
        result['steps'].append({'step': 'load_credentials', 'status': 'failed'})
        return jsonify(result), 500
    
    result['service_account'] = sa_info.get('client_email', 'unknown')
    result['steps'].append({'step': 'load_credentials', 'status': 'ok', 'email': sa_info.get('client_email')})
    
    access_token = get_google_access_token()
    if not access_token:
        result['error'] = 'Failed to get access token'
        result['steps'].append({'step': 'get_token', 'status': 'failed'})
        return jsonify(result), 500
    
    result['steps'].append({'step': 'get_token', 'status': 'ok', 'token_prefix': access_token[:20]})
    
    try:
        resp = requests.get(
            f'https://www.googleapis.com/drive/v3/files/{file_id}',
            params={'fields': 'id,name,mimeType'},
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=10
        )
        
        if resp.status_code == 200:
            file_info = resp.json()
            result['steps'].append({'step': 'drive_api', 'status': 'ok', 'file': file_info})
            result['success'] = True
        else:
            result['steps'].append({'step': 'drive_api', 'status': 'failed', 'code': resp.status_code, 'body': resp.text[:200]})
            result['error'] = f'Drive API error: {resp.status_code}'
            return jsonify(result), 500
    except Exception as e:
        result['steps'].append({'step': 'drive_api', 'status': 'exception', 'error': str(e)})
        result['error'] = str(e)
        return jsonify(result), 500
    
    return jsonify(result)


@app.route('/batch/start', methods=['POST'])
def batch_start():
    """Start batch processing: get pending jobs and schedule first Cloud Task"""
    auth = request.headers.get('Authorization', '')
    if not WORKER_SECRET or auth != f'Bearer {WORKER_SECRET}':
        return jsonify({'error': 'Unauthorized'}), 401
    
    print("\n" + "="*60)
    print("BATCH START REQUESTED")
    print("="*60)
    
    state = get_batch_state()
    if state.get('batch_active'):
        return jsonify({
            'error': 'Batch already running',
            'state': state
        }), 400
    
    pending_count = get_pending_jobs_count()
    if pending_count == 0:
        return jsonify({
            'error': 'No pending jobs to process',
            'pending_count': 0
        }), 400
    
    print(f"Found {pending_count} pending jobs")
    
    new_state = set_batch_state(
        batch_active=True,
        started_at=datetime.utcnow().isoformat(),
        total_jobs=pending_count,
        processed_jobs=0,
        failed_jobs=0
    )
    
    task_name = schedule_next_job(delay_seconds=5)
    
    if task_name:
        print(f"✅ Batch started! First task scheduled: {task_name}")
        return jsonify({
            'success': True,
            'message': 'Batch processing started',
            'pending_jobs': pending_count,
            'first_task': task_name,
            'state': new_state
        })
    else:
        set_batch_state(batch_active=False)
        return jsonify({
            'error': 'Failed to schedule first task',
            'cloud_tasks_available': CLOUD_TASKS_AVAILABLE,
            'worker_url': WORKER_URL
        }), 500


@app.route('/batch/stop', methods=['POST'])
def batch_stop():
    """Stop batch processing: cancel pending Cloud Tasks"""
    auth = request.headers.get('Authorization', '')
    if not WORKER_SECRET or auth != f'Bearer {WORKER_SECRET}':
        return jsonify({'error': 'Unauthorized'}), 401
    
    print("\n" + "="*60)
    print("BATCH STOP REQUESTED")
    print("="*60)
    
    cancelled = cancel_pending_tasks()
    
    state = set_batch_state(batch_active=False)
    
    print(f"✅ Batch stopped. Cancelled {cancelled} pending tasks.")
    
    return jsonify({
        'success': True,
        'message': 'Batch processing stopped',
        'cancelled_tasks': cancelled,
        'state': state
    })


@app.route('/batch/status', methods=['GET'])
def batch_status():
    """Get current batch processing status"""
    state = get_batch_state()
    pending_count = get_pending_jobs_count()
    
    completed = 0
    failed = 0
    processing = 0
    
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            resp = requests.get(
                f"{SUPABASE_URL}/rest/v1/video_ingest_jobs?select=status",
                headers={
                    'apikey': SUPABASE_KEY,
                    'Authorization': f'Bearer {SUPABASE_KEY}'
                },
                timeout=10
            )
            if resp.status_code == 200:
                jobs = resp.json()
                for job in jobs:
                    status = job.get('status', '')
                    if status == 'completed':
                        completed += 1
                    elif status in ('cloud_failed', 'failed', 'chromakey_failed'):
                        failed += 1
                    elif status == 'external_processing':
                        processing += 1
        except Exception as e:
            print(f"Error getting job counts: {e}")
    
    return jsonify({
        'batch_active': state.get('batch_active', False),
        'started_at': state.get('started_at'),
        'counters': {
            'pending': pending_count,
            'processing': processing,
            'completed': completed,
            'failed': failed,
            'total_in_batch': state.get('total_jobs', 0),
            'processed_in_batch': state.get('processed_jobs', 0),
            'failed_in_batch': state.get('failed_jobs', 0)
        }
    })


@app.route('/batch/watchdog', methods=['POST'])
def batch_watchdog():
    """
    Watchdog endpoint: Clean up stale jobs stuck in transitional states.
    Call this manually or set up a Cloud Scheduler to call it periodically.
    Stale jobs (>15 min in transitional state) are reset to 'pending'.
    """
    auth = request.headers.get('Authorization', '')
    if not WORKER_SECRET or auth != f'Bearer {WORKER_SECRET}':
        return jsonify({'error': 'Unauthorized'}), 401
    
    print("\n" + "="*60)
    print("BATCH WATCHDOG TRIGGERED")
    print("="*60)
    
    reset_count = cleanup_stale_jobs()
    
    return jsonify({
        'success': True,
        'message': f'Watchdog cleanup complete',
        'reset_count': reset_count,
        'stale_threshold_minutes': STALE_JOB_THRESHOLD_MINUTES,
        'transitional_states': TRANSITIONAL_STATES
    })


ARCHIEF_BATCH_STATE_ID = 2  # Row ID 2 in video_batch_state is for archief

def get_archief_batch_state():
    """Get archief batch state from Supabase (row id=2)"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return {'batch_active': False, 'total_jobs': 0, 'processed_jobs': 0, 'failed_jobs': 0}
    
    try:
        resp = requests.get(
            f'{SUPABASE_URL}/rest/v1/video_batch_state?id=eq.{ARCHIEF_BATCH_STATE_ID}',
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}'
            },
            timeout=10
        )
        if resp.status_code == 200:
            rows = resp.json()
            if rows:
                return rows[0]
            else:
                # Create initial row for archief batch
                init_resp = requests.post(
                    f'{SUPABASE_URL}/rest/v1/video_batch_state',
                    json={
                        'id': ARCHIEF_BATCH_STATE_ID,
                        'batch_active': False,
                        'total_jobs': 0,
                        'processed_jobs': 0,
                        'failed_jobs': 0
                    },
                    headers={
                        'apikey': SUPABASE_KEY,
                        'Authorization': f'Bearer {SUPABASE_KEY}',
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    timeout=10
                )
                if init_resp.status_code in [200, 201]:
                    return init_resp.json()[0]
    except Exception as e:
        print(f"[Archief] Error getting batch state: {e}")
    
    return {'batch_active': False, 'total_jobs': 0, 'processed_jobs': 0, 'failed_jobs': 0}


def set_archief_batch_state(batch_active, **kwargs):
    """Update archief batch state in Supabase (row id=2)"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return {'batch_active': batch_active, **kwargs}
    
    update_data = {'batch_active': batch_active, **kwargs}
    
    try:
        resp = requests.patch(
            f'{SUPABASE_URL}/rest/v1/video_batch_state?id=eq.{ARCHIEF_BATCH_STATE_ID}',
            json=update_data,
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            timeout=10
        )
        if resp.status_code == 200:
            rows = resp.json()
            if rows:
                print(f"[Archief] Batch state saved: batch_active={batch_active}")
                return rows[0]
            else:
                # Row doesn't exist, create it
                get_archief_batch_state()  # This will create the row
                # Try update again
                resp = requests.patch(
                    f'{SUPABASE_URL}/rest/v1/video_batch_state?id=eq.{ARCHIEF_BATCH_STATE_ID}',
                    json=update_data,
                    headers={
                        'apikey': SUPABASE_KEY,
                        'Authorization': f'Bearer {SUPABASE_KEY}',
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    timeout=10
                )
                if resp.status_code == 200 and resp.json():
                    return resp.json()[0]
        print(f"[Archief] Error updating batch state: {resp.status_code}")
    except Exception as e:
        print(f"[Archief] Batch state save error: {e}")
    
    return {'batch_active': batch_active, **kwargs}


def run_archief_transcription_pipeline(job_id, drive_file_id, access_token):
    """
    Simplified pipeline for archief videos: download → audio → transcript only.
    NO chromakey, NO RAG embeddings, NO Mux upload.
    Used for tone-of-voice training data collection.
    """
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            input_video = f'{tmpdir}/input.mp4'
            audio_file = f'{tmpdir}/audio.mp3'
            
            print(f"[{job_id}] [Archief] Step 1/3: Downloading from Drive...")
            update_status(job_id, 'archief_downloading')
            
            file_size = download_from_drive_resumable(
                drive_file_id=drive_file_id,
                access_token=access_token,
                output_path=input_video,
                job_id=job_id,
                max_retries=5,
                max_time=1800
            )
            
            print(f"[{job_id}] [Archief] Download complete: {file_size/1024/1024:.1f} MB")
            
            print(f"[{job_id}] [Archief] Step 2/3: Extracting audio...")
            update_status(job_id, 'archief_audio')
            
            subprocess.run([
                'ffmpeg', '-y', '-i', input_video,
                '-vn', '-acodec', 'libmp3lame', '-q:a', '4',
                audio_file
            ], check=True, capture_output=True)
            
            audio_size = os.path.getsize(audio_file) / 1024 / 1024
            print(f"[{job_id}] [Archief] Audio extracted: {audio_size:.1f} MB")
            
            print(f"[{job_id}] [Archief] Step 3/3: Transcribing with ElevenLabs...")
            update_status(job_id, 'archief_transcribing')
            transcript = transcribe_audio(audio_file)
            
            if not transcript:
                raise Exception("Transcription failed - empty result")
            
            update_status(
                job_id, 
                'archived_transcribed',
                transcript=transcript,
                error_message=None
            )
            
            print(f"\n[{job_id}] [Archief] ✅ COMPLETE!")
            print(f"  - Transcript: {len(transcript)} chars")
            print(f"  - Status: archived_transcribed")
            
            return True
            
    except Exception as e:
        error_msg = str(e)
        print(f"\n[{job_id}] [Archief] ❌ ERROR: {error_msg}")
        update_status(job_id, 'archief_failed', error=error_msg[:500])
        raise


def schedule_next_archief_job(delay_seconds=BATCH_INTERVAL_SECONDS):
    """Schedule next archief transcription job using Cloud Tasks"""
    worker_url = get_cloud_run_url()
    
    if CLOUD_TASKS_AVAILABLE and init_cloud_tasks() and worker_url:
        try:
            parent = tasks_client.queue_path(GCP_PROJECT, GCP_REGION, CLOUD_TASKS_QUEUE)
            
            schedule_time = timestamp_pb2.Timestamp()
            schedule_time.FromDatetime(datetime.utcnow() + timedelta(seconds=delay_seconds))
            
            task = {
                'http_request': {
                    'http_method': tasks_v2.HttpMethod.POST,
                    'url': f"{worker_url}/batch/transcribe-archief/process-next",
                    'headers': {
                        'Content-Type': 'application/json',
                        'Authorization': f'Bearer {WORKER_SECRET}'
                    },
                    'body': json.dumps({'scheduled': True, 'timestamp': datetime.utcnow().isoformat()}).encode()
                },
                'schedule_time': schedule_time
            }
            
            response = tasks_client.create_task(parent=parent, task=task)
            task_name = response.name.split('/')[-1]
            print(f"[Archief] ✅ Scheduled next job via Cloud Tasks in {delay_seconds}s: {task_name}")
            return task_name
        except Exception as e:
            print(f"[Archief] ⚠️ Cloud Tasks failed: {e}")
    
    print("[Archief] ❌ Cloud Tasks not available")
    return None


@app.route('/batch/transcribe-archief', methods=['POST'])
def batch_transcribe_archief_start():
    """Start batch transcription of archief videos (transcript only, no RAG/Mux)"""
    auth = request.headers.get('Authorization', '')
    if not WORKER_SECRET or auth != f'Bearer {WORKER_SECRET}':
        return jsonify({'error': 'Unauthorized'}), 401
    
    print("\n" + "="*60)
    print("ARCHIEF TRANSCRIPTION BATCH START REQUESTED")
    print("="*60)
    
    state = get_archief_batch_state()
    if state.get('batch_active'):
        return jsonify({
            'error': 'Archief batch already running',
            'state': state
        }), 400
    
    pending_count = get_pending_archief_jobs_count()
    if pending_count == 0:
        return jsonify({
            'error': 'No archief jobs need transcription',
            'pending_count': 0
        }), 400
    
    print(f"[Archief] Found {pending_count} archief videos needing transcription")
    
    new_state = set_archief_batch_state(
        batch_active=True,
        started_at=datetime.utcnow().isoformat(),
        total_jobs=pending_count,
        processed_jobs=0,
        failed_jobs=0
    )
    
    task_name = schedule_next_archief_job(delay_seconds=5)
    
    if task_name:
        print(f"[Archief] ✅ Batch started! First task scheduled: {task_name}")
        return jsonify({
            'success': True,
            'message': 'Archief transcription batch started',
            'pending_jobs': pending_count,
            'first_task': task_name,
            'state': new_state
        })
    else:
        set_archief_batch_state(batch_active=False)
        return jsonify({
            'error': 'Failed to schedule first task',
            'cloud_tasks_available': CLOUD_TASKS_AVAILABLE,
            'worker_url': WORKER_URL
        }), 500


@app.route('/batch/transcribe-archief/status', methods=['GET'])
def batch_transcribe_archief_status():
    """Get current archief transcription batch status"""
    state = get_archief_batch_state()
    pending_count = get_pending_archief_jobs_count()
    
    transcribed = 0
    failed = 0
    
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            resp = requests.get(
                f"{SUPABASE_URL}/rest/v1/video_ingest_jobs"
                f"?drive_folder_id=eq.{ARCHIEF_FOLDER_ID}"
                f"&select=status",
                headers={
                    'apikey': SUPABASE_KEY,
                    'Authorization': f'Bearer {SUPABASE_KEY}'
                },
                timeout=10
            )
            if resp.status_code == 200:
                jobs = resp.json()
                for job in jobs:
                    status = job.get('status', '')
                    if status == 'archived_transcribed':
                        transcribed += 1
                    elif status == 'archief_failed':
                        failed += 1
        except Exception as e:
            print(f"[Archief] Error getting job counts: {e}")
    
    return jsonify({
        'batch_active': state.get('batch_active', False),
        'started_at': state.get('started_at'),
        'archief_folder_id': ARCHIEF_FOLDER_ID,
        'counters': {
            'pending': pending_count,
            'transcribed': transcribed,
            'failed': failed,
            'total_in_batch': state.get('total_jobs', 0),
            'processed_in_batch': state.get('processed_jobs', 0),
            'failed_in_batch': state.get('failed_jobs', 0)
        }
    })


@app.route('/batch/transcribe-archief/stop', methods=['POST'])
def batch_transcribe_archief_stop():
    """Stop archief transcription batch"""
    auth = request.headers.get('Authorization', '')
    if not WORKER_SECRET or auth != f'Bearer {WORKER_SECRET}':
        return jsonify({'error': 'Unauthorized'}), 401
    
    print("\n" + "="*60)
    print("ARCHIEF TRANSCRIPTION BATCH STOP REQUESTED")
    print("="*60)
    
    state = set_archief_batch_state(batch_active=False)
    
    return jsonify({
        'success': True,
        'message': 'Archief transcription batch stopped',
        'state': state
    })


@app.route('/batch/transcribe-archief/process-next', methods=['POST'])
def batch_transcribe_archief_process_next():
    """Process the next archief job and schedule the next Cloud Task"""
    auth = request.headers.get('Authorization', '')
    if not WORKER_SECRET or auth != f'Bearer {WORKER_SECRET}':
        return jsonify({'error': 'Unauthorized'}), 401
    
    print("\n" + "="*60)
    print("ARCHIEF TRANSCRIPTION PROCESS-NEXT TRIGGERED")
    print("="*60)
    
    state = get_archief_batch_state()
    if not state.get('batch_active'):
        print("[Archief] Batch is not active, skipping")
        return jsonify({
            'skipped': True,
            'reason': 'Archief batch not active'
        })
    
    job = get_next_pending_archief_job()
    
    if not job:
        print("[Archief] No more pending archief jobs, stopping batch")
        set_archief_batch_state(batch_active=False)
        return jsonify({
            'completed': True,
            'message': 'All archief jobs transcribed, batch stopped'
        })
    
    job_id = job['id']
    drive_file_id = job.get('drive_file_id')
    
    if not drive_file_id:
        print(f"[{job_id}] [Archief] No drive_file_id, marking as failed")
        update_status(job_id, 'archief_failed', error='Missing drive_file_id')
        schedule_next_archief_and_update_state(success=False)
        return jsonify({'error': 'Job missing drive_file_id', 'job_id': job_id}), 400
    
    access_token = get_google_access_token()
    if not access_token:
        print(f"[{job_id}] [Archief] Failed to get access token")
        update_status(job_id, 'archief_failed', error='Failed to get Google access token')
        schedule_next_archief_and_update_state(success=False)
        return jsonify({'error': 'Failed to get access token', 'job_id': job_id}), 500
    
    success = False
    try:
        run_archief_transcription_pipeline(job_id, drive_file_id, access_token)
        success = True
    except Exception as e:
        print(f"[{job_id}] [Archief] Pipeline error: {e}")
    
    schedule_next_archief_and_update_state(success=success)
    
    return jsonify({
        'processed': True,
        'job_id': job_id,
        'success': success
    })


def schedule_next_archief_and_update_state(success):
    """Schedule next archief job and update batch state counters"""
    state = get_archief_batch_state()
    
    if not state.get('batch_active'):
        print("[Archief] Batch no longer active, not scheduling next")
        return
    
    processed = state.get('processed_jobs', 0) + 1
    failed = state.get('failed_jobs', 0) + (0 if success else 1)
    
    set_archief_batch_state(
        batch_active=True,
        processed_jobs=processed,
        failed_jobs=failed
    )
    
    pending = get_pending_archief_jobs_count()
    if pending > 0:
        print(f"[Archief] Scheduling next job (still {pending} pending)...")
        schedule_next_archief_job(delay_seconds=BATCH_INTERVAL_SECONDS)
    else:
        print("[Archief] No more pending archief jobs, batch complete!")
        set_archief_batch_state(batch_active=False)


@app.route('/batch/process-next', methods=['POST'])
def batch_process_next():
    """Process the next pending job and schedule the next Cloud Task.
    Calls watchdog first to recover any stuck jobs before picking next job."""
    auth = request.headers.get('Authorization', '')
    if not WORKER_SECRET or auth != f'Bearer {WORKER_SECRET}':
        return jsonify({'error': 'Unauthorized'}), 401
    
    print("\n" + "="*60)
    print("BATCH PROCESS-NEXT TRIGGERED")
    print("="*60)
    
    # Self-healing: First cleanup any stale jobs before processing
    print("[Self-healing] Running watchdog cleanup before processing...")
    reset_count = cleanup_stale_jobs()
    if reset_count > 0:
        print(f"[Self-healing] Recovered {reset_count} stuck jobs - they will be retried")
    
    state = get_batch_state()
    if not state.get('batch_active'):
        print("Batch is not active, skipping")
        return jsonify({
            'skipped': True,
            'reason': 'Batch not active',
            'watchdog_reset_count': reset_count
        })
    
    job = get_next_pending_job()
    
    if not job:
        print("No more pending jobs, stopping batch")
        set_batch_state(batch_active=False)
        return jsonify({
            'completed': True,
            'message': 'All jobs processed, batch stopped'
        })
    
    job_id = job['id']
    drive_file_id = job.get('drive_file_id')
    
    if not drive_file_id:
        print(f"[{job_id}] No drive_file_id, marking as failed")
        update_status(job_id, 'cloud_failed', error='Missing drive_file_id')
        schedule_next_and_update_state(success=False)
        return jsonify({'error': 'Job missing drive_file_id', 'job_id': job_id}), 400
    
    if not claim_job(job_id):
        print(f"[{job_id}] Failed to claim job, scheduling next")
        schedule_next_and_update_state(success=False)
        return jsonify({'error': 'Failed to claim job', 'job_id': job_id}), 409
    
    access_token = get_google_access_token()
    if not access_token:
        print(f"[{job_id}] Failed to get access token")
        update_status(job_id, 'cloud_failed', error='Failed to get Google access token')
        schedule_next_and_update_state(success=False)
        return jsonify({'error': 'Failed to get access token', 'job_id': job_id}), 500
    
    success = False
    try:
        run_pipeline(job_id, drive_file_id, access_token, callback_url=None)
        success = True
    except Exception as e:
        print(f"[{job_id}] Pipeline error: {e}")
        update_status(job_id, 'cloud_failed', error=str(e)[:500])
    
    schedule_next_and_update_state(success=success)
    
    return jsonify({
        'processed': True,
        'job_id': job_id,
        'success': success
    })


def schedule_next_and_update_state(success):
    """Schedule next job and update batch state counters"""
    state = get_batch_state()
    
    if not state.get('batch_active'):
        print("Batch no longer active, not scheduling next")
        return
    
    processed = state.get('processed_jobs', 0) + 1
    failed = state.get('failed_jobs', 0) + (0 if success else 1)
    
    set_batch_state(
        batch_active=True,
        processed_jobs=processed,
        failed_jobs=failed
    )
    
    pending = get_pending_jobs_count()
    if pending > 0:
        print(f"Scheduling next job (still {pending} pending)...")
        schedule_next_job(delay_seconds=BATCH_INTERVAL_SECONDS)
    else:
        print("No more pending jobs, batch complete!")
        set_batch_state(batch_active=False)


@app.route('/test-supabase', methods=['POST'])
def test_supabase():
    """Test endpoint to verify Supabase connection"""
    data = request.json or {}
    job_id = data.get('job_id', 'test-job-id')
    
    result = {
        'supabase_url': SUPABASE_URL[:30] + '...' if SUPABASE_URL else None,
        'supabase_key_length': len(SUPABASE_KEY) if SUPABASE_KEY else 0,
    }
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        result['error'] = 'Missing Supabase credentials'
        return jsonify(result), 500
    
    try:
        resp = requests.patch(
            f'{SUPABASE_URL}/rest/v1/video_ingest_jobs?id=eq.{job_id}',
            json={'status': 'cloud_test'},
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            timeout=10
        )
        result['status_code'] = resp.status_code
        result['response'] = resp.text[:200] if resp.text else 'empty'
        
        if resp.status_code in [200, 204]:
            result['success'] = True
        else:
            result['success'] = False
            
    except Exception as e:
        result['error'] = str(e)[:200]
        result['success'] = False
        
    return jsonify(result)


def run_pipeline(job_id, drive_file_id, access_token, callback_url):
    """Background worker function - runs the full video pipeline"""
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            input_video = f'{tmpdir}/input.mp4'
            output_video = f'{tmpdir}/output.mp4'
            audio_file = f'{tmpdir}/audio.mp3'
            
            print(f"[{job_id}] Step 1/7: Downloading from Drive (resumable)...")
            update_status(job_id, 'cloud_downloading')
            update_progress(job_id, "Starting download...")
            
            file_size = download_from_drive_resumable(
                drive_file_id=drive_file_id,
                access_token=access_token,
                output_path=input_video,
                job_id=job_id,
                max_retries=5,
                max_time=1800
            )
            
            update_progress(job_id, f"Download complete: {file_size/1024/1024:.0f} MB")
            
            # Check video duration - skip videos < 30 seconds
            MINIMUM_DURATION_SECONDS = 30
            duration_cmd = [
                'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                '-of', 'default=nokey=1:noprint_wrappers=1', input_video
            ]
            duration_result = subprocess.run(duration_cmd, capture_output=True, text=True)
            try:
                video_duration = float(duration_result.stdout.strip())
            except (ValueError, TypeError):
                video_duration = 0
            
            print(f"[{job_id}] Video duration: {video_duration:.1f} seconds")
            
            if video_duration < MINIMUM_DURATION_SECONDS:
                print(f"[{job_id}] SKIPPING: Video too short ({video_duration:.1f}s < {MINIMUM_DURATION_SECONDS}s)")
                update_status(job_id, 'skipped_too_short')
                update_progress(job_id, f"Skipped: video too short ({video_duration:.1f}s)")
                # Update duration in database before returning
                requests.patch(
                    f'{SUPABASE_URL}/rest/v1/video_ingest_jobs?id=eq.{job_id}',
                    json={'duration_seconds': int(video_duration)},
                    headers={
                        'apikey': SUPABASE_KEY,
                        'Authorization': f'Bearer {SUPABASE_KEY}',
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    timeout=10
                )
                return
            
            probe_cmd = [
                'ffprobe', '-v', 'error', '-select_streams', 'v:0',
                '-show_entries', 'stream=pix_fmt,color_space,color_transfer,color_primaries,color_range,width,height',
                '-of', 'default=nokey=1:noprint_wrappers=1',
                input_video
            ]
            probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)
            color_info = probe_result.stdout.strip().replace('\n', ' | ')
            print(f"[{job_id}] INPUT VIDEO METADATA: {color_info}")
            update_progress(job_id, f"Input: {color_info}")
            
            print(f"[{job_id}] Step 2/7: Applying chromakey...")
            update_status(job_id, 'cloud_chromakey')
            update_progress(job_id, "Chromakey processing...")
            
            # Select background based on processed_jobs count (rotate every BACKGROUND_BATCH_SIZE videos)
            batch_state = get_batch_state()
            processed_jobs = batch_state.get('processed_jobs', 0)
            bg_index = (processed_jobs // BACKGROUND_BATCH_SIZE) % len(BACKGROUNDS)
            bg_path = BACKGROUNDS[bg_index]
            bg_name = os.path.basename(bg_path)
            print(f"[{job_id}] Using background {bg_index + 1}/{len(BACKGROUNDS)}: {bg_name} (processed: {processed_jobs})")
            
            filter_complex = (
                "[0:v]format=yuva444p,chromakey=0x00FF00:0.29:0.10,"
                "despill=type=green:mix=0.78:expand=0.06,"
                "lutyuv=a='if(lt(val,64),0,if(gt(val,160),255,val))'[fg];"
                "[1:v][fg]scale2ref=iw:ih:flags=lanczos[bg][fgref];"
                "[bg][fgref]overlay=0:0:shortest=1,format=yuv420p[out]"
            )
            
            cmd = [
                'ffmpeg', '-y',
                '-color_primaries', 'bt709',
                '-color_trc', 'bt709',
                '-colorspace', 'bt709',
                '-i', input_video,
                '-loop', '1',
                '-i', bg_path,
                '-filter_complex', filter_complex,
                '-map', '[out]', '-map', '0:a?',
                '-c:v', 'libx264', 
                '-preset', 'medium',  # Changed from 'slow' for 3-4x faster encoding
                '-crf', '14',
                '-profile:v', 'high',
                '-level:v', '4.2',
                '-pix_fmt', 'yuv420p',
                '-maxrate', '18M',
                '-bufsize', '36M',
                '-tune', 'film',
                '-movflags', '+faststart',
                '-c:a', 'aac', '-b:a', '192k',
                '-shortest',
                output_video
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                raise Exception(f"Chromakey failed: {result.stderr[-500:]}")
            
            output_size = os.path.getsize(output_video) / 1024 / 1024
            print(f"[{job_id}] Chromakey done: {output_size:.1f} MB")
            
            print(f"[{job_id}] Step 3/7: Extracting audio...")
            update_status(job_id, 'cloud_audio')
            
            subprocess.run([
                'ffmpeg', '-y', '-i', input_video,
                '-vn', '-acodec', 'libmp3lame', '-q:a', '4',
                audio_file
            ], check=True, capture_output=True)
            
            print(f"[{job_id}] Step 4/7: Transcribing with ElevenLabs...")
            update_status(job_id, 'cloud_transcribing')
            transcript = transcribe_audio(audio_file)
            
            print(f"[{job_id}] Step 5/7: Generating embeddings...")
            update_status(job_id, 'cloud_embedding')
            embedding = generate_embedding(transcript)
            
            rag_doc_id = None
            ai_techniek_id = None
            ai_confidence = None
            if embedding:
                print(f"[{job_id}] Saving to RAG corpus...")
                rag_doc_id = save_to_rag(job_id, transcript, embedding)
                
                # AI Technique Matching: find best matching technique based on transcript
                print(f"[{job_id}] Step 5b/7: AI Technique Matching...")
                ai_techniek_id, ai_confidence = match_technique_from_embedding(embedding, job_id)
            
            print(f"[{job_id}] Step 6/7: Uploading to Mux...")
            update_status(job_id, 'cloud_uploading')
            
            init_mux()
            if not mux_uploads_api:
                raise Exception("Mux not configured")
            
            upload = mux_uploads_api.create_direct_upload(mux_python.CreateUploadRequest(
                new_asset_settings=mux_python.CreateAssetRequest(
                    playback_policy=[mux_python.PlaybackPolicy.PUBLIC],
                    encoding_tier='smart',
                    max_resolution_tier='1080p'
                ),
                cors_origin="*"
            ))
            
            with open(output_video, 'rb') as f:
                requests.put(upload.data.url, data=f, headers={'Content-Type': 'video/mp4'})
            
            print(f"[{job_id}] Step 7/7: Waiting for Mux...")
            update_status(job_id, 'mux_processing')
            
            mux_asset_id = None
            mux_playback_id = None
            duration = None
            
            # Poll until we have BOTH asset_id AND playback_id (max 10 minutes)
            for i in range(120):
                upload_status = mux_uploads_api.get_direct_upload(upload.data.id)
                if upload_status.data.asset_id:
                    asset = mux_assets_api.get_asset(upload_status.data.asset_id).data
                    mux_asset_id = asset.id
                    if asset.playback_ids and len(asset.playback_ids) > 0:
                        mux_playback_id = asset.playback_ids[0].id
                    if hasattr(asset, 'duration') and asset.duration:
                        duration = asset.duration
                    
                    # Only break if we have BOTH asset_id AND playback_id
                    if mux_asset_id and mux_playback_id:
                        print(f"[{job_id}] Mux ready: asset={mux_asset_id}, playback={mux_playback_id}")
                        break
                    else:
                        # Asset exists but playback_id not yet ready, keep polling
                        if i % 6 == 0:  # Log every 30 seconds
                            print(f"[{job_id}] Mux asset exists but waiting for playback_id... ({i*5}s)")
                time.sleep(5)
            
            if not mux_asset_id:
                raise Exception("Mux upload timeout - no asset_id after 10 minutes")
            
            if not mux_playback_id:
                raise Exception(f"Mux upload incomplete - asset_id={mux_asset_id} but no playback_id after 10 minutes")
            
            update_data = {
                'mux_asset_id': mux_asset_id,
                'mux_playback_id': mux_playback_id,
                'mux_status': 'ready',
                'transcript': transcript,
                'rag_document_id': rag_doc_id,
                'error_message': None
            }
            if duration:
                update_data['duration_seconds'] = int(duration)
            
            # Add AI technique suggestion if found
            if ai_techniek_id:
                update_data['ai_suggested_techniek_id'] = ai_techniek_id
            if ai_confidence:
                update_data['ai_confidence'] = ai_confidence
            
            update_status(job_id, 'completed', **update_data)
            
            # Increment processed_jobs counter for background rotation
            try:
                current_state = get_batch_state()
                new_processed = current_state.get('processed_jobs', 0) + 1
                set_batch_state(
                    batch_active=current_state.get('batch_active', False),
                    processed_jobs=new_processed
                )
                print(f"[{job_id}] Background rotation counter: {new_processed}")
            except Exception as e:
                print(f"[{job_id}] Warning: failed to update processed_jobs counter: {e}")
            
            print(f"\n[{job_id}] ✅ COMPLETE!")
            print(f"  - Playback ID: {mux_playback_id}")
            print(f"  - Transcript: {len(transcript)} chars")
            print(f"  - RAG doc: {rag_doc_id}")
            print(f"  - AI Techniek: {ai_techniek_id} ({ai_confidence:.0%})" if ai_techniek_id else "  - AI Techniek: geen match")
            print(f"  - Background used: {bg_name}")
            
            if callback_url:
                try:
                    requests.post(callback_url, json={
                        'job_id': job_id,
                        'status': 'completed',
                        'mux_playback_id': mux_playback_id
                    }, headers={'Authorization': f'Bearer {WORKER_SECRET}'}, timeout=30)
                    print(f"[{job_id}] Callback sent to {callback_url}")
                except Exception as e:
                    print(f"[{job_id}] Callback failed: {e}")
                    
    except Exception as e:
        error_msg = str(e)
        print(f"\n[{job_id}] ❌ ERROR: {error_msg}")
        
        update_status(job_id, 'cloud_failed', error=error_msg)
        
        if callback_url:
            try:
                requests.post(callback_url, json={
                    'job_id': job_id,
                    'status': 'failed',
                    'error': error_msg
                }, headers={'Authorization': f'Bearer {WORKER_SECRET}'}, timeout=30)
            except:
                pass
        
        raise


@app.route('/process', methods=['POST'])
def process_video():
    """Process video SYNCHRONOUSLY - keeps full CPU during processing"""
    auth = request.headers.get('Authorization', '')
    if not WORKER_SECRET or auth != f'Bearer {WORKER_SECRET}':
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    job_id = data.get('job_id')
    drive_file_id = data.get('drive_file_id')
    access_token = data.get('access_token')
    callback_url = data.get('callback_url')
    
    if not all([job_id, drive_file_id, access_token]):
        return jsonify({'error': 'Missing required fields'}), 400
    
    print(f"\n{'='*50}")
    print(f"[{job_id}] Job accepted - SYNCHRONOUS processing (full CPU)")
    print(f"[{job_id}] Drive file: {drive_file_id}")
    print(f"{'='*50}")
    
    run_pipeline(job_id, drive_file_id, access_token, callback_url)
    
    return jsonify({
        'completed': True,
        'job_id': job_id,
        'message': 'Job completed'
    }), 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    print(f"Starting worker v8.3 (archief transcription) on port {port}")
    print(f"Cloud Tasks: {CLOUD_TASKS_AVAILABLE}")
    print(f"Worker URL: {WORKER_URL}")
    print(f"Archief folder: {ARCHIEF_FOLDER_ID}")
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
