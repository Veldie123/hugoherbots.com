"""
Setup Cloud Tasks queue for batch video processing
Run this once to create the queue in GCP
"""
import os
import subprocess
import json
import shlex

GCP_PROJECT = 'hugoherbots-80155'
GCP_REGION = 'europe-west1'
QUEUE_NAME = 'video-batch-queue'

def run_gcloud(args_list):
    """Run gcloud command and return output"""
    cmd = ['gcloud'] + args_list + [f'--project={GCP_PROJECT}', '--format=json']
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        return None
    return json.loads(result.stdout) if result.stdout.strip() else None

def main():
    print(f"Setting up Cloud Tasks queue: {QUEUE_NAME}")
    print(f"Project: {GCP_PROJECT}, Region: {GCP_REGION}")
    print("=" * 50)
    
    existing = run_gcloud(['tasks', 'queues', 'describe', QUEUE_NAME, f'--location={GCP_REGION}'])
    
    if existing:
        print(f"✅ Queue already exists: {existing.get('name', QUEUE_NAME)}")
    else:
        print(f"Creating queue {QUEUE_NAME}...")
        result = subprocess.run(
            ['gcloud', 'tasks', 'queues', 'create', QUEUE_NAME,
             f'--location={GCP_REGION}', f'--project={GCP_PROJECT}'],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            print(f"✅ Queue created: {QUEUE_NAME}")
        else:
            print(f"❌ Failed to create queue: {result.stderr}")
            return
    
    print("\nConfiguring queue for video processing...")
    config_cmd = [
        'gcloud', 'tasks', 'queues', 'update', QUEUE_NAME,
        f'--location={GCP_REGION}',
        '--max-concurrent-dispatches=1',
        '--max-dispatches-per-second=0.001',
        '--max-attempts=3',
        '--min-backoff=60s',
        '--max-backoff=600s',
        f'--project={GCP_PROJECT}'
    ]
    result = subprocess.run(config_cmd, capture_output=True, text=True)
    if result.returncode == 0:
        print("✅ Queue configured")
    else:
        print(f"⚠️ Queue config warning: {result.stderr}")
    
    print("\n" + "=" * 50)
    print("IMPORTANT: Grant Cloud Tasks permissions to Cloud Run service account:")
    print(f"  gcloud projects add-iam-policy-binding {GCP_PROJECT} \\")
    print(f"    --member='serviceAccount:{GCP_PROJECT}@appspot.gserviceaccount.com' \\")
    print(f"    --role='roles/cloudtasks.enqueuer'")
    print("=" * 50)

if __name__ == '__main__':
    main()
