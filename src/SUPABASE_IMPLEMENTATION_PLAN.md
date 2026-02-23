# Supabase Implementation Plan
## HugoHerbots.ai Backend Architecture

**Strategy**: Hybrid approach
- **Express server** = Orchestrator & session engine
- **Supabase** = Auth + Storage + Postgres + Vector Search

---

## Phase 1: Supabase Auth (Priority 1)

### 1.1 Setup Supabase Project
```bash
# Create new Supabase project at supabase.com
# Get API keys: anon key + service role key
```

### 1.2 Install Dependencies
```bash
npm install @supabase/supabase-js
```

### 1.3 Create Supabase Client Utilities
**File**: `/utils/supabase/client.ts`
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 1.4 Auth Implementation

#### Login Flow (`/components/HH/Login.tsx`)
```typescript
import { supabase } from '../../utils/supabase/client'

// Email/Password login
const { data, error } = await supabase.auth.signInWithPassword({
  email: email,
  password: password,
})

// Social login (Google/Microsoft)
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google', // or 'azure' for Microsoft
})
```

#### Signup Flow (`/components/HH/Signup.tsx`)
```typescript
// Email/Password signup
const { data, error } = await supabase.auth.signUp({
  email: email,
  password: password,
  options: {
    data: {
      first_name: firstName,
      last_name: lastName,
      company: company,
    }
  }
})
```

#### Session Management
```typescript
// Check active session
const { data: { session } } = await supabase.auth.getSession()

// Listen to auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') navigate('dashboard')
  if (event === 'SIGNED_OUT') navigate('login')
})

// Logout
await supabase.auth.signOut()
```

### 1.5 Protected Routes
**File**: `/utils/auth/ProtectedRoute.tsx`
```typescript
import { useEffect, useState } from 'react'
import { supabase } from '../supabase/client'

export function ProtectedRoute({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div>Loading...</div>
  if (!session) return <Login />
  return children
}
```

### 1.6 Update Components
- [ ] `Login.tsx` - Replace mock login with Supabase auth
- [ ] `Signup.tsx` - Replace mock signup with Supabase auth
- [ ] `Settings.tsx` - Connect profile updates to Supabase
- [ ] `UserMenu.tsx` - Get user data from Supabase session
- [ ] `App.tsx` - Add auth state management

---

## Phase 2: Supabase Storage (Priority 2)

### 2.1 Create Storage Buckets
```sql
-- In Supabase SQL Editor
-- Bucket for session transcripts
INSERT INTO storage.buckets (id, name, public) 
VALUES ('session-transcripts', 'session-transcripts', false);

-- Bucket for audio uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('audio-uploads', 'audio-uploads', false);

-- Bucket for user avatars
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true);

-- Bucket for resources (PDFs, videos, etc.)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('resources', 'resources', false);
```

### 2.2 Storage Policies (RLS)
```sql
-- Users can only access their own session transcripts
CREATE POLICY "Users can view own transcripts"
ON storage.objects FOR SELECT
USING (bucket_id = 'session-transcripts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own transcripts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'session-transcripts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can access their own audio uploads
CREATE POLICY "Users can manage own audio"
ON storage.objects FOR ALL
USING (bucket_id = 'audio-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Public read for avatars
CREATE POLICY "Avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Resources accessible by authenticated users
CREATE POLICY "Auth users can view resources"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'resources');
```

### 2.3 Upload Utilities
**File**: `/utils/supabase/storage.ts`
```typescript
import { supabase } from './client'

// Upload session transcript
export async function uploadTranscript(
  userId: string,
  sessionId: string,
  transcript: any
) {
  const filePath = `${userId}/${sessionId}.json`
  
  const { data, error } = await supabase.storage
    .from('session-transcripts')
    .upload(filePath, JSON.stringify(transcript), {
      contentType: 'application/json',
      upsert: true,
    })

  return { data, error }
}

// Upload audio file
export async function uploadAudio(
  userId: string,
  sessionId: string,
  audioBlob: Blob
) {
  const filePath = `${userId}/${sessionId}.webm`
  
  const { data, error } = await supabase.storage
    .from('audio-uploads')
    .upload(filePath, audioBlob, {
      contentType: 'audio/webm',
      upsert: false,
    })

  return { data, error }
}

// Upload user avatar
export async function uploadAvatar(userId: string, file: File) {
  const fileExt = file.name.split('.').pop()
  const filePath = `${userId}.${fileExt}`
  
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      upsert: true,
    })

  if (error) return { data: null, error }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath)

  return { data: publicUrl, error: null }
}

// Download transcript
export async function downloadTranscript(userId: string, sessionId: string) {
  const filePath = `${userId}/${sessionId}.json`
  
  const { data, error } = await supabase.storage
    .from('session-transcripts')
    .download(filePath)

  if (error) return { data: null, error }
  
  const transcript = await data.text()
  return { data: JSON.parse(transcript), error: null }
}

// Get signed URL for private file
export async function getSignedUrl(bucket: string, path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)

  return { data, error }
}
```

### 2.4 Update Components
- [ ] `Settings.tsx` - Avatar upload to Supabase Storage
- [ ] `RolePlay.tsx` - Upload audio recordings
- [ ] `AdminSessionTranscripts.tsx` - Store/retrieve transcripts
- [ ] `Resources.tsx` - Download resources from Storage
- [ ] `AdminResourceLibrary.tsx` - Upload resources to Storage

---

## Phase 3: Postgres Database (Priority 3)

### 3.1 Database Schema

```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  role TEXT, -- 'user' | 'admin' | 'team_admin'
  company TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Workspaces/Teams
CREATE TABLE public.workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users ON DELETE CASCADE,
  plan TEXT DEFAULT 'starter', -- 'starter' | 'pro' | 'team'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace members
CREATE TABLE public.workspace_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'owner' | 'admin' | 'member'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- Role-play sessions
CREATE TABLE public.sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces ON DELETE CASCADE,
  scenario_id UUID,
  status TEXT DEFAULT 'in_progress', -- 'in_progress' | 'completed' | 'abandoned'
  duration_seconds INTEGER DEFAULT 0,
  score INTEGER,
  transcript_url TEXT,
  audio_url TEXT,
  phase TEXT, -- 'preparation' | 'discovery' | 'proposal' | 'closing'
  techniques_detected JSONB DEFAULT '[]'::jsonb,
  feedback JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON public.sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Scenarios
CREATE TABLE public.scenarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'discovery' | 'objections' | 'closing' | 'custom'
  difficulty TEXT DEFAULT 'beginner', -- 'beginner' | 'intermediate' | 'advanced'
  created_by UUID REFERENCES auth.users,
  workspace_id UUID REFERENCES public.workspaces, -- NULL = public scenario
  flow_data JSONB NOT NULL, -- Scenario builder JSON
  techniques_required TEXT[] DEFAULT '{}',
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Video content
CREATE TABLE public.video_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  phase INTEGER, -- -1, 1, 2, 3, 4
  technique_id TEXT,
  video_url TEXT NOT NULL,
  duration_seconds INTEGER,
  transcript TEXT,
  order_index INTEGER DEFAULT 0,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User progress tracking
CREATE TABLE public.user_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  video_id UUID REFERENCES public.video_content ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  last_watched_at TIMESTAMPTZ,
  UNIQUE(user_id, video_id)
);

-- Help articles
CREATE TABLE public.help_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  status TEXT DEFAULT 'draft', -- 'draft' | 'published' | 'archived'
  author_id UUID REFERENCES auth.users,
  views INTEGER DEFAULT 0,
  helpful INTEGER DEFAULT 0,
  not_helpful INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resources
CREATE TABLE public.resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  type TEXT NOT NULL, -- 'pdf' | 'video' | 'spreadsheet' | 'document' | 'presentation'
  file_url TEXT NOT NULL,
  file_size TEXT,
  downloads INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  author_id UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 Database Functions

```sql
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scenarios_updated_at BEFORE UPDATE ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_article_views(article_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.help_articles
  SET views = views + 1
  WHERE id = article_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment download count
CREATE OR REPLACE FUNCTION increment_resource_downloads(resource_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.resources
  SET downloads = downloads + 1
  WHERE id = resource_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3.3 Database Utilities
**File**: `/utils/supabase/database.ts`
```typescript
import { supabase } from './client'

// Profile operations
export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  return { data, error }
}

export async function updateProfile(userId: string, updates: any) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  return { data, error }
}

// Session operations
export async function createSession(session: any) {
  const { data, error } = await supabase
    .from('sessions')
    .insert(session)
    .select()
    .single()

  return { data, error }
}

export async function getUserSessions(userId: string, limit = 10) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return { data, error }
}

export async function updateSession(sessionId: string, updates: any) {
  const { data, error } = await supabase
    .from('sessions')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single()

  return { data, error }
}

// Scenario operations
export async function getScenarios(filters?: any) {
  let query = supabase.from('scenarios').select('*')
  
  if (filters?.category) {
    query = query.eq('category', filters.category)
  }
  
  if (filters?.difficulty) {
    query = query.eq('difficulty', filters.difficulty)
  }
  
  const { data, error } = await query.order('created_at', { ascending: false })

  return { data, error }
}

// Help article operations
export async function getArticles(filters?: any) {
  let query = supabase.from('help_articles').select('*').eq('status', 'published')
  
  if (filters?.category && filters.category !== 'all') {
    query = query.eq('category', filters.category)
  }
  
  const { data, error } = await query.order('created_at', { ascending: false })

  return { data, error }
}

export async function getArticleBySlug(slug: string) {
  const { data, error } = await supabase
    .from('help_articles')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  // Increment view count
  if (data) {
    await supabase.rpc('increment_article_views', { article_id: data.id })
  }

  return { data, error }
}

// Resource operations
export async function getResources(filters?: any) {
  let query = supabase.from('resources').select('*')
  
  if (filters?.category && filters.category !== 'all') {
    query = query.eq('category', filters.category)
  }
  
  if (filters?.type && filters.type !== 'all') {
    query = query.eq('type', filters.type)
  }
  
  const { data, error } = await query.order('created_at', { ascending: false })

  return { data, error }
}
```

---

## Phase 4: Vector Search with pgvector (Priority 4)

### 4.1 Enable pgvector Extension
```sql
-- In Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4.2 Add Vector Columns
```sql
-- Add embeddings to sessions for semantic search
ALTER TABLE public.sessions
ADD COLUMN embedding vector(1536); -- OpenAI ada-002 dimension

-- Add embeddings to help articles
ALTER TABLE public.help_articles
ADD COLUMN embedding vector(1536);

-- Create vector indexes for fast similarity search
CREATE INDEX sessions_embedding_idx ON public.sessions
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX articles_embedding_idx ON public.help_articles
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### 4.3 Vector Search Functions
```sql
-- Semantic search for similar sessions
CREATE OR REPLACE FUNCTION search_similar_sessions(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.8,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  scenario_id uuid,
  score integer,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.scenario_id,
    s.score,
    1 - (s.embedding <=> query_embedding) as similarity
  FROM public.sessions s
  WHERE 1 - (s.embedding <=> query_embedding) > match_threshold
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Semantic search for help articles
CREATE OR REPLACE FUNCTION search_help_articles(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  excerpt text,
  slug text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.title,
    a.excerpt,
    a.slug,
    1 - (a.embedding <=> query_embedding) as similarity
  FROM public.help_articles a
  WHERE a.status = 'published'
    AND 1 - (a.embedding <=> query_embedding) > match_threshold
  ORDER BY a.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 4.4 Vector Search Utilities
**File**: `/utils/supabase/vectorSearch.ts`
```typescript
import { supabase } from './client'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
})

// Generate embedding from text
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  })
  
  return response.data[0].embedding
}

// Search similar sessions
export async function searchSimilarSessions(query: string, matchCount = 10) {
  const embedding = await generateEmbedding(query)
  
  const { data, error } = await supabase.rpc('search_similar_sessions', {
    query_embedding: embedding,
    match_threshold: 0.8,
    match_count: matchCount,
  })

  return { data, error }
}

// Search help articles
export async function searchHelpArticles(query: string, matchCount = 5) {
  const embedding = await generateEmbedding(query)
  
  const { data, error } = await supabase.rpc('search_help_articles', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: matchCount,
  })

  return { data, error }
}

// Store session with embedding
export async function storeSessionWithEmbedding(session: any, transcriptText: string) {
  const embedding = await generateEmbedding(transcriptText)
  
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      ...session,
      embedding,
    })
    .select()
    .single()

  return { data, error }
}
```

---

## Phase 5: Express Server Integration

### 5.1 Express Server Setup
**File**: `/server/index.ts`
```typescript
import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'

const app = express()
const PORT = process.env.PORT || 3001

// Supabase Admin Client (uses service role key)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Full admin access
)

app.use(cors())
app.use(express.json())

// Middleware to verify user auth
async function authenticateUser(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  req.user = user
  next()
}

// Session routes
app.post('/api/sessions/start', authenticateUser, async (req, res) => {
  const { scenario_id, workspace_id } = req.body
  
  // Create session in Supabase
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .insert({
      user_id: req.user.id,
      workspace_id,
      scenario_id,
      status: 'in_progress',
    })
    .select()
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json(data)
})

app.post('/api/sessions/:id/process', authenticateUser, async (req, res) => {
  const { id } = req.params
  const { audio_blob, transcript } = req.body

  // 1. Upload audio to Supabase Storage
  const audioPath = `${req.user.id}/${id}.webm`
  const { error: uploadError } = await supabaseAdmin.storage
    .from('audio-uploads')
    .upload(audioPath, audio_blob)

  if (uploadError) {
    return res.status(500).json({ error: uploadError.message })
  }

  // 2. Process transcript with OpenAI
  // 3. Detect techniques
  // 4. Generate feedback
  // 5. Calculate score

  // 6. Update session in Supabase
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .update({
      status: 'completed',
      transcript_url: audioPath,
      score: 85, // calculated score
      feedback: {}, // generated feedback
      techniques_detected: [], // detected techniques
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json(data)
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
```

---

## Environment Variables

```env
# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # Server-side only!

# OpenAI
VITE_OPENAI_API_KEY=sk-...

# HeyGen
VITE_HEYGEN_API_KEY=...

# Server
PORT=3001
NODE_ENV=development
```

---

## Migration Checklist

### Auth
- [ ] Create Supabase project
- [ ] Set up auth providers (Email, Google, Microsoft)
- [ ] Create `/utils/supabase/client.ts`
- [ ] Update Login component
- [ ] Update Signup component
- [ ] Add auth state management to App.tsx
- [ ] Create ProtectedRoute wrapper
- [ ] Update UserMenu with real user data

### Storage
- [ ] Create storage buckets
- [ ] Set up RLS policies
- [ ] Create `/utils/supabase/storage.ts`
- [ ] Update Settings avatar upload
- [ ] Update RolePlay audio recording
- [ ] Update AdminResourceLibrary file uploads

### Database
- [ ] Run database schema SQL
- [ ] Create database functions
- [ ] Create `/utils/supabase/database.ts`
- [ ] Update Dashboard to fetch real data
- [ ] Update MySessions to fetch real sessions
- [ ] Update Analytics to calculate from real data
- [ ] Connect AdminHelpCenter to database
- [ ] Connect AdminResourceLibrary to database

### Vector Search
- [ ] Enable pgvector extension
- [ ] Add embedding columns
- [ ] Create vector search functions
- [ ] Create `/utils/supabase/vectorSearch.ts`
- [ ] Add semantic search to HelpCenter
- [ ] Add similar session recommendations

### Express Server
- [ ] Set up Express server
- [ ] Add auth middleware
- [ ] Create session processing endpoints
- [ ] Integrate HeyGen API
- [ ] Integrate OpenAI API
- [ ] Add technique detection logic

---

## Testing Strategy

1. **Local Development**
   - Use Supabase local dev (optional)
   - Test auth flows
   - Test file uploads
   - Test database CRUD

2. **Staging Environment**
   - Deploy to staging Supabase project
   - Test with real HeyGen/OpenAI APIs
   - Performance testing
   - Load testing

3. **Production Deployment**
   - Deploy to production Supabase project
   - Monitor error rates
   - Set up logging/alerts
   - Backup strategy

---

## Next Steps

1. ✅ Remove "Training voorkeuren" from Settings (DONE)
2. 📝 Create Supabase project
3. 🔑 Set up Auth (Login/Signup)
4. 📦 Set up Storage (File uploads)
5. 💾 Set up Database (Tables + RLS)
6. 🔍 Add Vector Search
7. 🚀 Deploy Express server

Wil je dat ik begin met stap 2 (Supabase project setup) of heb je eerst vragen over de architectuur?
