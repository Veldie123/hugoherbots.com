# Hugo RAG System - Implementatie Handleiding

## Wat is dit?

Dit pakket bevat Hugo's trainingsmateriaal in een formaat voor **Retrieval-Augmented Generation (RAG)**. Het laat je AI-systemen Hugo's verkooptechnieken "leren" door semantisch relevante fragmenten op te halen tijdens gesprekken.

## Inhoud van het pakket

```
hugo-rag-export/
├── README_RAG.md                    # Deze handleiding
├── data/
│   ├── epic_rag_corpus.json         # 943KB - Complete corpus als JSON array
│   └── documents_for_embedding.jsonl # 231KB - JSON Lines formaat voor indexering
└── server/
    └── rag-service.ts               # TypeScript RAG service met pgvector
```

## Bestandsformaten

### epic_rag_corpus.json
Complete JSON array met alle documenten:
```json
[
  {
    "id": "uuid",
    "type": "hugo_training",
    "source": "MVI_0606.m4a",
    "title": "MVI 0606",
    "content": "Volledige getranscribeerde tekst...",
    "word_count": 478,
    "techniek": null
  },
  ...
]
```

### documents_for_embedding.jsonl
**BELANGRIJK**: Dit is een JSON Lines bestand (.jsonl), NIET HTML!

Elke regel is een apart JSON object:
```
{"id": "uuid-1", "type": "hugo_training", "title": "...", "content": "...", "metadata": {...}}
{"id": "uuid-2", "type": "hugo_training", "title": "...", "content": "...", "metadata": {...}}
```

Als je browser/editor dit als HTML toont, open het met:
- VS Code / Cursor
- `cat` commando in terminal
- Teksteditor (niet browser)

## Vereisten

1. **PostgreSQL met pgvector extensie**
2. **OpenAI API key** (voor embeddings via `text-embedding-3-small`)
3. **Node.js 18+**

## Database Setup

### 1. Installeer pgvector extensie

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Maak de RAG tabel

```sql
CREATE TABLE IF NOT EXISTS rag_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    techniek_id TEXT,
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index voor snelle similarity search
CREATE INDEX IF NOT EXISTS rag_documents_embedding_idx 
ON rag_documents USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);
```

### 3. Maak de search functie

```sql
CREATE OR REPLACE FUNCTION match_rag_documents(
    query_embedding vector(1536),
    similarity_threshold float,
    match_count int,
    filter_doc_type text DEFAULT NULL,
    filter_techniek_id text DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    doc_type TEXT,
    title TEXT,
    content TEXT,
    techniek_id TEXT,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        rd.id,
        rd.doc_type,
        rd.title,
        rd.content,
        rd.techniek_id,
        1 - (rd.embedding <=> query_embedding) AS similarity
    FROM rag_documents rd
    WHERE 
        (filter_doc_type IS NULL OR rd.doc_type = filter_doc_type)
        AND (filter_techniek_id IS NULL OR rd.techniek_id = filter_techniek_id)
        AND 1 - (rd.embedding <=> query_embedding) > similarity_threshold
    ORDER BY rd.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
```

## Corpus Inladen

### Optie 1: Via rag-service.ts

```typescript
import { indexRagCorpus } from './rag-service';

// Index alle documenten uit epic_rag_corpus.json
await indexRagCorpus();
```

### Optie 2: Handmatig met Node.js script

```typescript
import OpenAI from 'openai';
import { Pool } from 'pg';
import * as fs from 'fs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function indexDocuments() {
    const corpus = JSON.parse(fs.readFileSync('data/epic_rag_corpus.json', 'utf-8'));
    
    for (const doc of corpus) {
        // Genereer embedding
        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: doc.content
        });
        const embedding = response.data[0].embedding;
        
        // Insert in database
        await pool.query(`
            INSERT INTO rag_documents (id, doc_type, title, content, techniek_id, embedding)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
                content = EXCLUDED.content,
                embedding = EXCLUDED.embedding
        `, [doc.id, doc.type, doc.title, doc.content, doc.techniek, `[${embedding.join(',')}]`]);
        
        console.log(`Indexed: ${doc.title}`);
    }
}
```

## Gebruik in je Applicatie

```typescript
import { searchRag } from './rag-service';

// Zoek relevante fragmenten voor een vraag
const results = await searchRag("Hoe doe ik de opening van een verkoopgesprek?", {
    limit: 5,
    threshold: 0.65,
    docType: 'hugo_training'  // optioneel filter
});

// Gebruik in prompt
const ragContext = results.documents
    .map(d => `[${d.title}]: ${d.content}`)
    .join('\n\n');

const systemPrompt = `
Je bent Hugo, een sales coach.

CONTEXT UIT TRAININGSMATERIAAL:
${ragContext}

Gebruik bovenstaande context om vragen te beantwoorden.
`;
```

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
OPENAI_API_KEY=sk-...
```

## NPM Dependencies

```json
{
  "dependencies": {
    "openai": "^4.x",
    "pg": "^8.x"
  }
}
```

Of voor Drizzle ORM:
```json
{
  "dependencies": {
    "openai": "^4.x",
    "drizzle-orm": "^0.29.x",
    "@neondatabase/serverless": "^0.9.x"
  }
}
```

## Troubleshooting

### "JSONL file looks like HTML"
Het bestand is correct JSON Lines formaat. Open het met een teksteditor, niet een browser.

Verificatie in terminal:
```bash
head -3 documents_for_embedding.jsonl
```

### pgvector niet beschikbaar
Op Replit/Neon is pgvector standaard beschikbaar. Run:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Embeddings kosten
- Model: `text-embedding-3-small`
- Kosten: ~$0.02 per 1M tokens
- Dit corpus: ~150K tokens = ~$0.003 om volledig te indexeren

## Document Types in Corpus

| Type | Beschrijving |
|------|-------------|
| `hugo_training` | Getranscribeerde trainingsvideos |
| `video_transcript` | Video transcripties |
| `methodology` | Methodologie documenten |
| `technique` | Techniek beschrijvingen |

## Vragen?

Contact via de Hugo Platform.
