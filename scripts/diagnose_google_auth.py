#!/usr/bin/env python3
"""
DIAGNOSTISCH SCRIPT - Analyseert exact waarom Google Cloud authenticatie faalt
"""
import os
import json
import base64
import requests

def main():
    print("=" * 60)
    print("GOOGLE CLOUD AUTHENTICATIE DIAGNOSE")
    print("=" * 60)
    print()
    
    # Stap 1: Check of secret bestaat
    secret = os.environ.get('GOOGLE_CLOUD_SECRET')
    if not secret:
        print("❌ GOOGLE_CLOUD_SECRET is NIET ingesteld")
        print("   → Ga naar Replit Secrets tab en voeg GOOGLE_CLOUD_SECRET toe")
        return
    
    print(f"✓ GOOGLE_CLOUD_SECRET gevonden ({len(secret)} karakters)")
    
    # Stap 2: Parse de JSON
    key_data = None
    try:
        key_data = json.loads(secret)
        print("✓ Secret is geldige JSON")
    except json.JSONDecodeError:
        try:
            decoded = base64.b64decode(secret)
            key_data = json.loads(decoded)
            print("✓ Secret is base64-encoded JSON")
        except:
            print("❌ Secret is GEEN geldige JSON of base64")
            print("   → De service account key moet pure JSON zijn")
            print(f"   → Secret begint met: {secret[:50]}...")
            return
    
    # Stap 3: Check velden
    print()
    print("SERVICE ACCOUNT DETAILS:")
    print("-" * 40)
    
    required_fields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id', 'token_uri']
    for field in required_fields:
        value = key_data.get(field)
        if value:
            if field == 'private_key':
                # Check private key format
                if value.startswith('-----BEGIN PRIVATE KEY-----'):
                    print(f"✓ {field}: [GELDIG - begint correct]")
                else:
                    print(f"❌ {field}: [ONGELDIG - moet beginnen met '-----BEGIN PRIVATE KEY-----']")
            elif field == 'token_uri':
                print(f"✓ {field}: {value}")
            elif len(str(value)) > 50:
                print(f"✓ {field}: {str(value)[:50]}...")
            else:
                print(f"✓ {field}: {value}")
        else:
            print(f"❌ {field}: ONTBREEKT!")
    
    if key_data.get('type') != 'service_account':
        print()
        print(f"❌ Type is '{key_data.get('type')}' maar moet 'service_account' zijn")
        return
    
    # Stap 4: Test de token endpoint DIRECT
    print()
    print("TOKEN ENDPOINT TEST:")
    print("-" * 40)
    
    import time
    import jwt as pyjwt
    
    try:
        # Maak een JWT assertion
        now = int(time.time())
        claim_set = {
            "iss": key_data['client_email'],
            "scope": "https://www.googleapis.com/auth/cloud-platform",
            "aud": key_data['token_uri'],
            "iat": now,
            "exp": now + 3600
        }
        
        # Sign met private key
        signed_jwt = pyjwt.encode(
            claim_set,
            key_data['private_key'],
            algorithm='RS256'
        )
        
        print(f"✓ JWT aangemaakt voor: {key_data['client_email']}")
        
        # Stuur naar token endpoint
        token_response = requests.post(
            key_data['token_uri'],
            data={
                'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion': signed_jwt
            }
        )
        
        print(f"Token endpoint status: {token_response.status_code}")
        print()
        print("GOOGLE'S ANTWOORD:")
        print("-" * 40)
        
        response_json = token_response.json()
        
        # Check wat we terugkrijgen
        if 'access_token' in response_json:
            print("✓ ACCESS TOKEN ONTVANGEN!")
            print(f"  Token type: {response_json.get('token_type')}")
            print(f"  Expires in: {response_json.get('expires_in')} seconden")
            print()
            print("✅ AUTHENTICATIE WERKT CORRECT!")
            print("   De service account key is geldig.")
        elif 'id_token' in response_json and 'access_token' not in response_json:
            print("❌ ALLEEN ID_TOKEN - GEEN ACCESS_TOKEN")
            print()
            print("Dit betekent dat Google de key herkent maar GEEN toegang geeft.")
            print()
            print("MOGELIJKE OORZAKEN:")
            print("1. De service account heeft geen API rechten op project niveau")
            print("2. Er is een Organization Policy die toegang blokkeert")
            print("3. De Cloud Build API of Cloud Run API is niet ingeschakeld")
            print()
            print("OPLOSSING:")
            print("1. Ga naar Google Cloud Console > APIs & Services > Enable APIs")
            print("2. Zoek en enable: 'Cloud Build API'")
            print("3. Zoek en enable: 'Cloud Run Admin API'")
            print("4. Zoek en enable: 'Container Registry API'")
        elif 'error' in response_json:
            print(f"❌ ERROR: {response_json.get('error')}")
            print(f"   Details: {response_json.get('error_description', 'geen details')}")
            print()
            if response_json.get('error') == 'invalid_grant':
                print("Dit betekent dat de private key ongeldig is.")
                print("→ Maak een NIEUWE key aan in Google Cloud Console")
            elif response_json.get('error') == 'unauthorized_client':
                print("Dit betekent dat de service account geen toegang heeft.")
                print("→ Check of de service account bestaat in het project")
        else:
            print("Onverwacht antwoord:")
            print(json.dumps(response_json, indent=2))
            
    except Exception as e:
        print(f"❌ Error bij token test: {e}")
        import traceback
        traceback.print_exc()
    
    print()
    print("=" * 60)
    print("DIAGNOSE VOLTOOID")
    print("=" * 60)

if __name__ == "__main__":
    main()
