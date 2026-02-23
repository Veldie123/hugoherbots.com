"""
Google Cloud Run Worker for Video Processing v7.2 (DOWNLOAD FIX)
Full pipeline: chromakey → audio → transcript → RAG → Mux
Now processes in background thread to avoid HTTP timeouts

v7.2 Changes:
- Fixed download timeout: 30s connect, 60s read, 10min max total
- Added progress logging every 10 seconds during download
- Larger chunks (64KB) for faster downloads
- Previous: FFmpeg CRF 14, yuv420p, VBV 18M/36M, Mux encoding_tier='smart'
"""
import os
import tempfile
import subprocess
import requests
import time
import threading
from flask import Flask, request, jsonify
import mux_python

app = Flask(__name__)

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
MUX_TOKEN_ID = os.environ.get('MUX_TOKEN_ID')
MUX_TOKEN_SECRET = os.environ.get('MUX_TOKEN_SECRET')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
ELEVENLABS_API_KEY = os.environ.get('ELEVENLABS_API_KEY')
WORKER_SECRET = os.environ.get('WORKER_SECRET')

CHROMAKEY_SIMILARITY = 0.29
CHROMAKEY_BLEND = 0.10

mux_uploads_api = None
mux_assets_api = None

def init_mux():
    global mux_uploads_api, mux_assets_api
    if MUX_TOKEN_ID and MUX_TOKEN_SECRET and not mux_uploads_api:
        config = mux_python.Configuration()
        config.username = MUX_TOKEN_ID
        config.password = MUX_TOKEN_SECRET
        client = mux_python.ApiClient(config)
        mux_uploads_api = mux_python.DirectUploadsApi(client)
        mux_assets_api = mux_python.AssetsApi(client)

def update_status(job_id, status, error=None, **kwargs):
    if not SUPABASE_URL or not SUPABASE_KEY:
        print(f"[{job_id}] Status: {status} (no Supabase)")
        return
    try:
        data = {'status': status}
        if error:
            data['error_message'] = error
        data.update(kwargs)
        requests.patch(
            f'{SUPABASE_URL}/rest/v1/video_ingest_jobs?id=eq.{job_id}',
            json=data,
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            }
        )
        print(f"[{job_id}] Status updated: {status}")
    except Exception as e:
        print(f"[{job_id}] Failed to update status: {e}")

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
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    try:
        resp = requests.post(
            f'{SUPABASE_URL}/rest/v1/rag_documents',
            json={
                'content': transcript,
                'embedding': embedding,
                'metadata': {'source': 'video_pipeline', 'job_id': job_id}
            },
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        )
        if resp.status_code in [200, 201]:
            doc_id = resp.json()[0].get('id')
            print(f"Saved to RAG: {doc_id}")
            return doc_id
    except Exception as e:
        print(f"RAG save error: {e}")
    return None

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'version': '7.2-download-fix',
        'has_mux': bool(MUX_TOKEN_ID),
        'has_elevenlabs': bool(ELEVENLABS_API_KEY),
        'has_openai': bool(OPENAI_API_KEY),
        'has_supabase': bool(SUPABASE_URL)
    })


def run_pipeline(job_id, drive_file_id, access_token, callback_url):
    """Background worker function - runs the full video pipeline"""
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            input_video = f'{tmpdir}/input.mp4'
            output_video = f'{tmpdir}/output.mp4'
            audio_file = f'{tmpdir}/audio.mp3'
            
            print(f"[{job_id}] Step 1/7: Downloading from Drive...")
            update_status(job_id, 'cloud_downloading')
            
            url = f"https://www.googleapis.com/drive/v3/files/{drive_file_id}?alt=media"
            # Add timeout: 30s connect, 60s read per chunk
            resp = requests.get(url, headers={'Authorization': f'Bearer {access_token}'}, stream=True, timeout=(30, 60))
            resp.raise_for_status()
            
            # Get content length if available
            total_size = int(resp.headers.get('content-length', 0))
            downloaded = 0
            last_log = time.time()
            start_time = time.time()
            max_download_time = 600  # 10 minutes max
            
            with open(input_video, 'wb') as f:
                for chunk in resp.iter_content(chunk_size=65536):  # 64KB chunks for speed
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        
                        # Log progress every 10 seconds
                        if time.time() - last_log > 10:
                            mb_done = downloaded / 1024 / 1024
                            mb_total = total_size / 1024 / 1024 if total_size else 0
                            pct = (downloaded / total_size * 100) if total_size else 0
                            print(f"[{job_id}] Download: {mb_done:.1f}/{mb_total:.1f} MB ({pct:.0f}%)")
                            last_log = time.time()
                        
                        # Check timeout
                        if time.time() - start_time > max_download_time:
                            raise Exception(f"Download timeout: exceeded {max_download_time}s")
            
            file_size = os.path.getsize(input_video) / 1024 / 1024
            download_time = time.time() - start_time
            print(f"[{job_id}] Downloaded: {file_size:.1f} MB in {download_time:.1f}s")
            
            print(f"[{job_id}] Step 2/7: Applying chromakey...")
            update_status(job_id, 'cloud_chromakey')
            
            bg_path = '/app/bg_winter_avond_1080p.jpg'
            
            filter_complex = (
                f"[0:v]format=yuv444p,chromakey=0x00FF00:{CHROMAKEY_SIMILARITY}:{CHROMAKEY_BLEND}[fg];"
                "[1:v][fg]scale2ref=iw:ih:flags=lanczos[bg][fgref];"
                "[bg][fgref]overlay=0:0:shortest=1,format=yuv420p[out]"
            )
            
            cmd = [
                'ffmpeg', '-y',
                '-i', input_video,
                '-loop', '1',
                '-i', bg_path,
                '-filter_complex', filter_complex,
                '-map', '[out]', '-map', '0:a?',
                '-c:v', 'libx264', 
                '-preset', 'slow',
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
            if embedding:
                print(f"[{job_id}] Saving to RAG corpus...")
                rag_doc_id = save_to_rag(job_id, transcript, embedding)
            
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
            
            for i in range(120):
                upload_status = mux_uploads_api.get_direct_upload(upload.data.id)
                if upload_status.data.asset_id:
                    asset = mux_assets_api.get_asset(upload_status.data.asset_id).data
                    mux_asset_id = asset.id
                    if asset.playback_ids:
                        mux_playback_id = asset.playback_ids[0].id
                    if hasattr(asset, 'duration'):
                        duration = asset.duration
                    break
                time.sleep(5)
            
            if not mux_asset_id:
                raise Exception("Mux upload timeout")
            
            update_data = {
                'mux_asset_id': mux_asset_id,
                'mux_playback_id': mux_playback_id,
                'transcript': transcript,
                'rag_document_id': rag_doc_id,
                'error_message': None
            }
            if duration:
                update_data['duration_seconds'] = int(duration)
            
            update_status(job_id, 'completed', **update_data)
            
            print(f"\n[{job_id}] ✅ COMPLETE!")
            print(f"  - Playback ID: {mux_playback_id}")
            print(f"  - Transcript: {len(transcript)} chars")
            print(f"  - RAG doc: {rag_doc_id}")
            
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


@app.route('/process', methods=['POST'])
def process_video():
    """Accept video processing job and run in background thread"""
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
    print(f"[{job_id}] Job accepted - starting background processing")
    print(f"[{job_id}] Callback URL: {callback_url}")
    print(f"{'='*50}")
    
    update_status(job_id, 'cloud_queued')
    
    thread = threading.Thread(
        target=run_pipeline,
        args=(job_id, drive_file_id, access_token, callback_url),
        daemon=True
    )
    thread.start()
    
    return jsonify({
        'accepted': True,
        'job_id': job_id,
        'message': 'Job queued for background processing'
    }), 202


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    print(f"Starting worker v7.0 (async) on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
