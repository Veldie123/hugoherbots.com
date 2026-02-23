#!/usr/bin/env python3
"""
Cloud Run Deployment Script
Deploys worker.py v7.2 to Google Cloud Run without needing Cloud Shell

Uses GOOGLE_CLOUD_SECRET (service account JSON key) to authenticate
"""
import os
import sys
import json
import base64
import tempfile
import time
import requests
import jwt as pyjwt

PROJECT_ID = "hugoherbots-80155"
REGION = "europe-west1"
SERVICE_NAME = "video-worker"

def get_access_token():
    """Get access token using direct JWT grant (more reliable than google-auth library)"""
    secret = os.environ.get('GOOGLE_CLOUD_SECRET')
    if not secret:
        print("ERROR: GOOGLE_CLOUD_SECRET niet gevonden")
        return None, None
    
    try:
        key_data = json.loads(secret)
    except json.JSONDecodeError:
        try:
            decoded = base64.b64decode(secret)
            key_data = json.loads(decoded)
        except:
            print("ERROR: GOOGLE_CLOUD_SECRET is geen geldige JSON of base64")
            return None, None
    
    required = ['type', 'project_id', 'private_key', 'client_email', 'token_uri']
    missing = [f for f in required if f not in key_data]
    if missing:
        print(f"ERROR: Service account key mist velden: {missing}")
        return None, None
    
    if key_data.get('type') != 'service_account':
        print("ERROR: Key type moet 'service_account' zijn")
        return None, None
    
    print(f"✓ Service account: {key_data.get('client_email')}")
    print(f"✓ Project: {key_data.get('project_id')}")
    
    # Create JWT assertion directly (bypasses google-auth library issues)
    now = int(time.time())
    claim_set = {
        "iss": key_data['client_email'],
        "scope": "https://www.googleapis.com/auth/cloud-platform",
        "aud": key_data['token_uri'],
        "iat": now,
        "exp": now + 3600
    }
    
    try:
        signed_jwt = pyjwt.encode(
            claim_set,
            key_data['private_key'],
            algorithm='RS256'
        )
        
        token_response = requests.post(
            key_data['token_uri'],
            data={
                'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion': signed_jwt
            }
        )
        
        if token_response.status_code != 200:
            print(f"ERROR: Token request failed: {token_response.status_code}")
            print(token_response.text)
            return None, None
        
        token_data = token_response.json()
        
        if 'access_token' not in token_data:
            print("ERROR: Geen access token in response")
            print(f"Response: {json.dumps(token_data, indent=2)}")
            return None, None
        
        print(f"✓ Access token verkregen (geldig voor {token_data.get('expires_in', 3600)} sec)")
        return token_data['access_token'], key_data
        
    except Exception as e:
        print(f"ERROR: Kon geen access token verkrijgen: {e}")
        import traceback
        traceback.print_exc()
        return None, None

def trigger_cloud_build(access_token):
    """Trigger Cloud Build to build and deploy"""
    
    # Read worker.py and Dockerfile
    cloud_run_dir = os.path.join(os.path.dirname(__file__), '..', 'cloud-run')
    worker_path = os.path.join(cloud_run_dir, 'worker.py')
    dockerfile_path = os.path.join(cloud_run_dir, 'Dockerfile')
    backgrounds_dir = os.path.join(cloud_run_dir, 'backgrounds')
    
    if not os.path.exists(worker_path):
        print(f"ERROR: worker.py niet gevonden: {worker_path}")
        return False
    
    if not os.path.exists(backgrounds_dir):
        print(f"ERROR: backgrounds folder niet gevonden: {backgrounds_dir}")
        return False
    
    with open(worker_path, 'r') as f:
        worker_content = f.read()
    
    with open(dockerfile_path, 'r') as f:
        dockerfile_content = f.read()
    
    bg_files = os.listdir(backgrounds_dir)
    print(f"✓ Worker v8.3 geladen ({len(worker_content)} bytes)")
    print(f"✓ Backgrounds: {len(bg_files)} bestanden ({', '.join(bg_files)})")
    print(f"✓ Dockerfile geladen ({len(dockerfile_content)} bytes)")
    
    # Use inline build with Cloud Build
    build_config = {
        "steps": [
            {
                "name": "gcr.io/cloud-builders/docker",
                "args": [
                    "build",
                    "-t", f"gcr.io/{PROJECT_ID}/{SERVICE_NAME}",
                    "."
                ]
            },
            {
                "name": "gcr.io/cloud-builders/docker",
                "args": [
                    "push",
                    f"gcr.io/{PROJECT_ID}/{SERVICE_NAME}"
                ]
            },
            {
                "name": "gcr.io/google.com/cloudsdktool/cloud-sdk",
                "entrypoint": "gcloud",
                "args": [
                    "run", "deploy", SERVICE_NAME,
                    "--image", f"gcr.io/{PROJECT_ID}/{SERVICE_NAME}",
                    "--region", REGION,
                    "--platform", "managed",
                    "--allow-unauthenticated",
                    "--memory", "8Gi",
                    "--timeout", "3600",
                    "--cpu", "4",
                    "--no-cpu-throttling",
                    "--cpu-boost"
                ]
            }
        ],
        "images": [f"gcr.io/{PROJECT_ID}/{SERVICE_NAME}"],
        "timeout": "1200s"
    }
    
    # First, we need to upload the source code to Cloud Storage
    # For simplicity, let's use the gcloud builds submit alternative:
    # We'll create a tarball and upload it
    
    print("\n📦 Preparing source for Cloud Build...")
    
    # Create a temporary directory with the files
    with tempfile.TemporaryDirectory() as tmpdir:
        import shutil
        
        # Write files
        with open(os.path.join(tmpdir, 'worker.py'), 'w') as f:
            f.write(worker_content)
        with open(os.path.join(tmpdir, 'Dockerfile'), 'w') as f:
            f.write(dockerfile_content)
        
        # Copy entire backgrounds directory
        dest_backgrounds = os.path.join(tmpdir, 'backgrounds')
        shutil.copytree(backgrounds_dir, dest_backgrounds)
        print(f"✓ Backgrounds folder gekopieerd ({len(os.listdir(dest_backgrounds))} bestanden)")
        
        # Create cloudbuild.yaml
        cloudbuild_yaml = f"""
steps:
- name: 'gcr.io/cloud-builders/docker'
  args: ['build', '-t', 'gcr.io/{PROJECT_ID}/{SERVICE_NAME}', '.']
- name: 'gcr.io/cloud-builders/docker'
  args: ['push', 'gcr.io/{PROJECT_ID}/{SERVICE_NAME}']
- name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
  entrypoint: gcloud
  args:
  - 'run'
  - 'deploy'
  - '{SERVICE_NAME}'
  - '--image'
  - 'gcr.io/{PROJECT_ID}/{SERVICE_NAME}'
  - '--region'
  - '{REGION}'
  - '--platform'
  - 'managed'
  - '--allow-unauthenticated'
  - '--memory'
  - '8Gi'
  - '--timeout'
  - '3600'
  - '--cpu'
  - '4'
  - '--no-cpu-throttling'
  - '--cpu-boost'
images:
- 'gcr.io/{PROJECT_ID}/{SERVICE_NAME}'
timeout: 1200s
"""
        with open(os.path.join(tmpdir, 'cloudbuild.yaml'), 'w') as f:
            f.write(cloudbuild_yaml)
        
        # Create tarball
        import tarfile
        import io
        
        tar_buffer = io.BytesIO()
        with tarfile.open(fileobj=tar_buffer, mode='w:gz') as tar:
            for filename in os.listdir(tmpdir):
                filepath = os.path.join(tmpdir, filename)
                tar.add(filepath, arcname=filename)
        
        tar_data = tar_buffer.getvalue()
        print(f"✓ Source tarball created ({len(tar_data)} bytes)")
        
        # Upload to Cloud Storage
        bucket_name = f"{PROJECT_ID}_cloudbuild"
        object_name = f"source/{SERVICE_NAME}-{int(__import__('time').time())}.tar.gz"
        
        storage_url = f"https://storage.googleapis.com/upload/storage/v1/b/{bucket_name}/o?uploadType=media&name={object_name}"
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/gzip'
        }
        
        print(f"\n☁️ Uploading source to gs://{bucket_name}/{object_name}...")
        
        resp = requests.post(storage_url, headers=headers, data=tar_data)
        if resp.status_code not in [200, 201]:
            print(f"ERROR: Upload failed: {resp.status_code}")
            print(resp.text)
            return False
        
        print("✓ Source uploaded to Cloud Storage")
        
        # Now trigger Cloud Build
        build_url = f"https://cloudbuild.googleapis.com/v1/projects/{PROJECT_ID}/builds"
        
        build_request = {
            "source": {
                "storageSource": {
                    "bucket": bucket_name,
                    "object": object_name
                }
            },
            "substitutions": {
                "_WORKER_SECRET": os.environ.get('WORKER_SECRET', ''),
                "_SUPABASE_URL": os.environ.get('SUPABASE_URL', ''),
                "_SUPABASE_SERVICE_ROLE_KEY": os.environ.get('SUPABASE_SERVICE_ROLE_KEY', ''),
                "_MUX_TOKEN_ID": os.environ.get('MUX_TOKEN_ID', ''),
                "_MUX_TOKEN_SECRET": os.environ.get('MUX_TOKEN_SECRET', ''),
                "_OPENAI_API_KEY": os.environ.get('OPENAI_API_KEY', ''),
                "_ELEVENLABS_API_KEY": os.environ.get('ELEVENLABS_API_KEY', ''),
                "_GOOGLE_CLOUD_SECRET": os.environ.get('GOOGLE_CLOUD_SECRET', '')
            },
            "options": {
                "substitutionOption": "ALLOW_LOOSE"
            },
            "steps": [
                {
                    "name": "gcr.io/cloud-builders/docker",
                    "args": ["build", "-t", f"gcr.io/{PROJECT_ID}/{SERVICE_NAME}", "."]
                },
                {
                    "name": "gcr.io/cloud-builders/docker",
                    "args": ["push", f"gcr.io/{PROJECT_ID}/{SERVICE_NAME}"]
                },
                {
                    "name": "gcr.io/google.com/cloudsdktool/cloud-sdk",
                    "entrypoint": "gcloud",
                    "args": [
                        "run", "deploy", SERVICE_NAME,
                        "--image", f"gcr.io/{PROJECT_ID}/{SERVICE_NAME}",
                        "--region", REGION,
                        "--platform", "managed",
                        "--allow-unauthenticated",
                        "--memory", "8Gi",
                        "--timeout", "3600",
                        "--cpu", "4",
                        "--no-cpu-throttling",
                        "--cpu-boost",
                        "--min-instances", "1",
                        "--concurrency", "1",
                        "--set-env-vars", ",".join([
                            f"WORKER_URL=https://{SERVICE_NAME}-ldna2kfohq-ew.a.run.app",
                            "WORKER_SECRET=$_WORKER_SECRET",
                            "SUPABASE_URL=$_SUPABASE_URL",
                            "SUPABASE_SERVICE_ROLE_KEY=$_SUPABASE_SERVICE_ROLE_KEY",
                            "MUX_TOKEN_ID=$_MUX_TOKEN_ID",
                            "MUX_TOKEN_SECRET=$_MUX_TOKEN_SECRET",
                            "OPENAI_API_KEY=$_OPENAI_API_KEY",
                            "ELEVENLABS_API_KEY=$_ELEVENLABS_API_KEY",
                            f"GCP_PROJECT={PROJECT_ID}",
                            f"GCP_REGION={REGION}",
                            "CLOUD_TASKS_QUEUE=video-batch-queue"
                        ]),
                        "--set-secrets", "GOOGLE_CLOUD_SECRET=google-drive-service-account:latest"
                    ]
                }
            ],
            "images": [f"gcr.io/{PROJECT_ID}/{SERVICE_NAME}"],
            "timeout": "1200s"
        }
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        print("\n🚀 Starting Cloud Build...")
        
        resp = requests.post(build_url, headers=headers, json=build_request)
        if resp.status_code not in [200, 201]:
            print(f"ERROR: Cloud Build failed to start: {resp.status_code}")
            print(resp.text)
            return False
        
        build_data = resp.json()
        build_id = build_data.get('metadata', {}).get('build', {}).get('id', 'unknown')
        
        print(f"✓ Build gestart: {build_id}")
        print(f"\n📊 Bekijk voortgang: https://console.cloud.google.com/cloud-build/builds/{build_id}?project={PROJECT_ID}")
        print("\nDit duurt ongeveer 3-5 minuten. De video worker wordt automatisch bijgewerkt.")
        
        return True


def check_credentials_only():
    """Just check if credentials JSON is valid (without testing auth)"""
    secret = os.environ.get('GOOGLE_CLOUD_SECRET')
    if not secret:
        print("ERROR: GOOGLE_CLOUD_SECRET niet gevonden")
        return False
    
    try:
        key_data = json.loads(secret)
    except json.JSONDecodeError:
        try:
            decoded = base64.b64decode(secret)
            key_data = json.loads(decoded)
        except:
            print("ERROR: GOOGLE_CLOUD_SECRET is geen geldige JSON of base64")
            return False
    
    required = ['type', 'project_id', 'private_key', 'client_email']
    missing = [f for f in required if f not in key_data]
    if missing:
        print(f"ERROR: Service account key mist velden: {missing}")
        return False
    
    if key_data.get('type') != 'service_account':
        print("ERROR: Key type moet 'service_account' zijn")
        return False
    
    print(f"✓ Service account: {key_data.get('client_email')}")
    print(f"✓ Project: {key_data.get('project_id')}")
    print("\n✓ Credentials JSON is geldig!")
    return True


def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--check':
        success = check_credentials_only()
        sys.exit(0 if success else 1)
    
    print("=" * 50)
    print("Cloud Run Worker Deployment")
    print("=" * 50)
    print()
    
    access_token, key_data = get_access_token()
    if not access_token:
        print("\n❌ Deployment afgebroken: geen geldige credentials")
        sys.exit(1)
    
    success = trigger_cloud_build(access_token)
    if success:
        print("\n✅ Deployment gestart!")
    else:
        print("\n❌ Deployment mislukt")
        sys.exit(1)


if __name__ == '__main__':
    main()
