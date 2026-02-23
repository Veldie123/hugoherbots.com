#!/usr/bin/env python3
"""
Configure Cloud Run service with environment variables from Replit secrets.
Uses Cloud Run Admin API to update the service configuration securely.
"""
import os
import sys
import json
import base64
import time
import requests
import jwt

PROJECT_ID = 'hugoherbots-80155'
SERVICE_NAME = 'video-worker'
REGION = 'europe-west1'

def get_access_token():
    """Get access token using service account JWT grant"""
    secret = os.environ.get('GOOGLE_CLOUD_SECRET')
    if not secret:
        print("ERROR: GOOGLE_CLOUD_SECRET niet gevonden")
        return None
    
    try:
        key_data = json.loads(secret)
    except json.JSONDecodeError:
        try:
            decoded = base64.b64decode(secret)
            key_data = json.loads(decoded)
        except:
            print("ERROR: GOOGLE_CLOUD_SECRET is geen geldige JSON of base64")
            return None
    
    print(f"✓ Service account: {key_data.get('client_email')}")
    
    now = int(time.time())
    payload = {
        'iss': key_data['client_email'],
        'sub': key_data['client_email'],
        'aud': 'https://oauth2.googleapis.com/token',
        'iat': now,
        'exp': now + 3600,
        'scope': 'https://www.googleapis.com/auth/cloud-platform'
    }
    
    signed_jwt = jwt.encode(payload, key_data['private_key'], algorithm='RS256')
    
    token_response = requests.post(
        'https://oauth2.googleapis.com/token',
        data={
            'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion': signed_jwt
        }
    )
    
    if token_response.status_code != 200:
        print(f"ERROR: Token request failed: {token_response.status_code}")
        return None
    
    token_data = token_response.json()
    print(f"✓ Access token verkregen")
    return token_data.get('access_token')


def get_service_config(access_token):
    """Get current Cloud Run service configuration"""
    url = f"https://run.googleapis.com/v2/projects/{PROJECT_ID}/locations/{REGION}/services/{SERVICE_NAME}"
    
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    
    resp = requests.get(url, headers=headers)
    if resp.status_code != 200:
        print(f"ERROR: Kan service config niet ophalen: {resp.status_code}")
        print(resp.text)
        return None
    
    return resp.json()


def update_service_env_vars(access_token, env_vars):
    """Update Cloud Run service with environment variables"""
    
    service_config = get_service_config(access_token)
    if not service_config:
        return False
    
    containers = service_config.get('template', {}).get('containers', [{}])
    if not containers:
        containers = [{}]
    
    existing_env = containers[0].get('env', [])
    existing_env_dict = {e['name']: e.get('value', '') for e in existing_env}
    
    for key, value in env_vars.items():
        existing_env_dict[key] = value
    
    new_env = [{'name': k, 'value': v} for k, v in existing_env_dict.items()]
    
    containers[0]['env'] = new_env
    service_config['template']['containers'] = containers
    
    url = f"https://run.googleapis.com/v2/projects/{PROJECT_ID}/locations/{REGION}/services/{SERVICE_NAME}"
    
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    
    print(f"\n🔧 Updating service with {len(env_vars)} environment variables...")
    
    resp = requests.patch(url, headers=headers, json=service_config)
    
    if resp.status_code in [200, 201]:
        print("✓ Service configuratie bijgewerkt!")
        return True
    else:
        print(f"ERROR: Update failed: {resp.status_code}")
        print(resp.text[:500])
        return False


def main():
    print("=" * 50)
    print("Cloud Run Secrets Configuration")
    print("=" * 50)
    print()
    
    env_vars = {
        'SUPABASE_URL': os.environ.get('SUPABASE_URL', ''),
        'SUPABASE_SERVICE_ROLE_KEY': os.environ.get('SUPABASE_SERVICE_ROLE_KEY', ''),
        'MUX_TOKEN_ID': os.environ.get('MUX_TOKEN_ID', ''),
        'MUX_TOKEN_SECRET': os.environ.get('MUX_TOKEN_SECRET', ''),
        'OPENAI_API_KEY': os.environ.get('OPENAI_API_KEY', ''),
        'ELEVENLABS_API_KEY': os.environ.get('ELEVENLABS_API_KEY', ''),
        'WORKER_SECRET': os.environ.get('CLOUD_RUN_WORKER_SECRET', '')
    }
    
    missing = [k for k, v in env_vars.items() if not v]
    if missing:
        print(f"WARNING: Deze secrets zijn niet ingesteld in Replit: {missing}")
    
    present = [k for k, v in env_vars.items() if v]
    print(f"✓ {len(present)} secrets gevonden in Replit")
    
    access_token = get_access_token()
    if not access_token:
        print("\n❌ Configuratie afgebroken: geen geldige credentials")
        sys.exit(1)
    
    success = update_service_env_vars(access_token, env_vars)
    
    if success:
        print("\n✅ Cloud Run service geconfigureerd met secrets!")
        print("\nDe video worker kan nu:")
        print("  • Supabase updaten met voortgang")
        print("  • Mux gebruiken voor video hosting")
        print("  • ElevenLabs voor transcriptie")
        print("  • OpenAI voor embeddings")
    else:
        print("\n❌ Configuratie mislukt")
        sys.exit(1)


if __name__ == '__main__':
    main()
