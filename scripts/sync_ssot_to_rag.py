#!/usr/bin/env python3
"""
SSOT Sync Script for Technieken
================================
Dit script synchroniseert de technieken_index.json (SSOT) naar de rag_documents tabel.

Wanneer uit te voeren:
- Na elke wijziging in technieken_index.json
- Bij deployment
- Periodiek als validatie

Wat het doet:
1. Laadt SSOT technieken uit technieken_index.json
2. Vergelijkt met rag_documents (doc_type='techniek')
3. Update/insert technieken die gewijzigd zijn
4. Genereert nieuwe embeddings voor gewijzigde content
5. Verwijdert orphaned entries (in rag maar niet in SSOT)

Usage:
    python scripts/sync_ssot_to_rag.py [--dry-run] [--force-all]
"""

import os
import sys
import json
import hashlib
import argparse
from datetime import datetime

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from supabase import create_client
    import openai
except ImportError:
    print("Required packages: supabase, openai")
    print("Run: pip install supabase openai")
    sys.exit(1)

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')

def load_ssot():
    """Load technieken from SSOT json file."""
    ssot_path = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'technieken_index.json')
    with open(ssot_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data['technieken']

def generate_techniek_content(tech):
    """Generate searchable content from technique definition for embedding."""
    parts = [
        f"Techniek {tech.get('nummer', '')}: {tech.get('naam', '')}",
        f"Fase: {tech.get('fase', '')}",
    ]
    
    if tech.get('doel'):
        parts.append(f"Doel: {tech['doel']}")
    if tech.get('wat'):
        parts.append(f"Wat: {tech['wat']}")
    if tech.get('waarom'):
        parts.append(f"Waarom: {tech['waarom']}")
    if tech.get('wanneer'):
        parts.append(f"Wanneer: {tech['wanneer']}")
    if tech.get('hoe'):
        parts.append(f"Hoe: {tech['hoe']}")
    if tech.get('voorbeeld'):
        voorbeelden = tech['voorbeeld']
        if isinstance(voorbeelden, list):
            parts.append(f"Voorbeelden: {' | '.join(voorbeelden)}")
        else:
            parts.append(f"Voorbeeld: {voorbeelden}")
    if tech.get('themas'):
        parts.append(f"Thema's: {', '.join(tech['themas'])}")
    if tech.get('tags'):
        parts.append(f"Tags: {', '.join(tech['tags'])}")
    
    return "\n".join(parts)

def content_hash(content: str) -> str:
    """Generate hash of content for change detection."""
    return hashlib.sha256(content.encode('utf-8')).hexdigest()[:16]

def generate_embedding(text: str) -> list:
    """Generate OpenAI embedding for text."""
    if not OPENAI_API_KEY:
        print("  WARNING: No OPENAI_API_KEY, skipping embedding generation")
        return None
    
    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding

def sync_technieken(dry_run=False, force_all=False):
    """Main sync function."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return False
    
    print("=" * 60)
    print("SSOT Techniek Sync")
    print("=" * 60)
    print(f"Dry run: {dry_run}")
    print(f"Force all: {force_all}")
    print()
    
    # Load SSOT
    ssot = load_ssot()
    print(f"SSOT: {len(ssot)} technieken geladen")
    
    # Skip phase headers (0, 1, 2, 3, 4) - they're not matchable techniques
    matchable_technieken = {k: v for k, v in ssot.items() if not v.get('is_fase', False)}
    print(f"Matchable technieken (excl. fase headers): {len(matchable_technieken)}")
    
    # Connect to Supabase
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Load current rag_documents
    result = client.table('rag_documents').select('id, techniek_id, title, content').eq('doc_type', 'techniek').execute()
    existing = {r['techniek_id']: r for r in result.data}
    print(f"Existing rag_documents: {len(existing)} technieken")
    print()
    
    # Track changes
    to_insert = []
    to_update = []
    to_delete = []
    unchanged = 0
    
    # Check each SSOT techniek
    for nummer, tech in matchable_technieken.items():
        title = f"{nummer} - {tech.get('naam', '')}"
        content = generate_techniek_content(tech)
        new_hash = content_hash(content)
        
        if nummer in existing:
            existing_content = existing[nummer].get('content', '')
            existing_hash = content_hash(existing_content) if existing_content else ''
            
            if force_all or new_hash != existing_hash:
                to_update.append({
                    'id': existing[nummer]['id'],
                    'nummer': nummer,
                    'title': title,
                    'content': content,
                    'old_title': existing[nummer].get('title', '')
                })
            else:
                unchanged += 1
        else:
            to_insert.append({
                'nummer': nummer,
                'title': title,
                'content': content
            })
    
    # Check for orphaned entries
    ssot_nummers = set(matchable_technieken.keys())
    for nummer in existing:
        if nummer not in ssot_nummers:
            to_delete.append({
                'id': existing[nummer]['id'],
                'nummer': nummer,
                'title': existing[nummer].get('title', '')
            })
    
    # Report
    print("=" * 60)
    print("CHANGES DETECTED")
    print("=" * 60)
    print(f"Unchanged: {unchanged}")
    print(f"To insert: {len(to_insert)}")
    print(f"To update: {len(to_update)}")
    print(f"To delete: {len(to_delete)}")
    print()
    
    if to_insert:
        print("NEW TECHNIEKEN:")
        for item in to_insert[:5]:
            print(f"  + {item['nummer']}: {item['title']}")
        if len(to_insert) > 5:
            print(f"  ... and {len(to_insert) - 5} more")
        print()
    
    if to_update:
        print("UPDATED TECHNIEKEN:")
        for item in to_update[:5]:
            print(f"  ~ {item['nummer']}: {item['old_title']} -> {item['title']}")
        if len(to_update) > 5:
            print(f"  ... and {len(to_update) - 5} more")
        print()
    
    if to_delete:
        print("ORPHANED (to delete):")
        for item in to_delete[:5]:
            print(f"  - {item['nummer']}: {item['title']}")
        if len(to_delete) > 5:
            print(f"  ... and {len(to_delete) - 5} more")
        print()
    
    if dry_run:
        print("DRY RUN - No changes made")
        return True
    
    if not to_insert and not to_update and not to_delete:
        print("Nothing to do - SSOT and rag_documents are in sync!")
        return True
    
    # Execute changes
    print("=" * 60)
    print("EXECUTING CHANGES")
    print("=" * 60)
    
    # Insert new
    for item in to_insert:
        print(f"Inserting {item['nummer']}...")
        embedding = generate_embedding(item['content'])
        
        insert_data = {
            'title': item['title'],
            'content': item['content'],
            'doc_type': 'techniek',
            'techniek_id': item['nummer'],
            'source_type': 'ssot_sync',
            'created_at': datetime.utcnow().isoformat(),
        }
        if embedding:
            insert_data['embedding'] = embedding
        
        try:
            client.table('rag_documents').insert(insert_data).execute()
            print(f"  Inserted {item['nummer']}")
        except Exception as e:
            print(f"  ERROR inserting {item['nummer']}: {e}")
    
    # Update existing
    for item in to_update:
        print(f"Updating {item['nummer']}...")
        embedding = generate_embedding(item['content'])
        
        update_data = {
            'title': item['title'],
            'content': item['content'],
            'updated_at': datetime.utcnow().isoformat(),
        }
        if embedding:
            update_data['embedding'] = embedding
        
        try:
            client.table('rag_documents').update(update_data).eq('id', item['id']).execute()
            print(f"  Updated {item['nummer']}")
        except Exception as e:
            print(f"  ERROR updating {item['nummer']}: {e}")
    
    # Delete orphaned
    for item in to_delete:
        print(f"Deleting orphaned {item['nummer']}...")
        try:
            client.table('rag_documents').delete().eq('id', item['id']).execute()
            print(f"  Deleted {item['nummer']}")
        except Exception as e:
            print(f"  ERROR deleting {item['nummer']}: {e}")
    
    print()
    print("=" * 60)
    print("SYNC COMPLETE")
    print("=" * 60)
    return True

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Sync SSOT technieken to rag_documents')
    parser.add_argument('--dry-run', action='store_true', help='Show changes without executing')
    parser.add_argument('--force-all', action='store_true', help='Force update all technieken (regenerate embeddings)')
    args = parser.parse_args()
    
    success = sync_technieken(dry_run=args.dry_run, force_all=args.force_all)
    sys.exit(0 if success else 1)
