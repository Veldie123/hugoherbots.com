/**
 * Global Search API Service
 * Hybrid search: classic (text matching) + semantic (RAG embeddings)
 */

import { supabase } from '../utils/supabase/client';

export interface SearchResult {
  id: string;
  title: string;
  content?: string;
  type: 'techniek' | 'video' | 'training' | 'transcript' | 'webinar';
  techniek_id?: string;
  fase?: string;
  similarity?: number;
  url?: string;
  adminRoute?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  classic: SearchResult[];
  semantic: SearchResult[];
}

function getVideoProcessorUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3001';
  }
  // Use Vite proxy - requests go to same origin, proxy forwards to :3001
  return '';
}

/**
 * Perform hybrid search: classic + semantic
 */
export async function hybridSearch(query: string, limit: number = 10): Promise<SearchResponse> {
  if (!query || query.trim().length < 2) {
    return { results: [], classic: [], semantic: [] };
  }

  const trimmedQuery = query.trim();

  // Run both searches in parallel
  const [classicResults, semanticResults] = await Promise.all([
    classicSearch(trimmedQuery, limit),
    semanticSearch(trimmedQuery, limit)
  ]);

  // Merge and deduplicate results, prioritizing classic matches
  const seen = new Set<string>();
  const merged: SearchResult[] = [];

  // Add classic results first (exact matches are more relevant)
  for (const result of classicResults) {
    const key = `${result.type}-${result.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({ ...result, similarity: 1.0 });
    }
  }

  // Add semantic results that weren't in classic
  for (const result of semanticResults) {
    const key = `${result.type}-${result.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(result);
    }
  }

  return {
    results: merged.slice(0, limit),
    classic: classicResults,
    semantic: semanticResults
  };
}

/**
 * Classic text-based search on technieken and videos
 */
async function classicSearch(query: string, limit: number): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  try {
    // Search technieken
    const { data: technieken } = await supabase
      .from('technieken')
      .select('id, name, fase, categorie, beschrijving')
      .or(`name.ilike.%${query}%,id.ilike.%${query}%,beschrijving.ilike.%${query}%`)
      .limit(limit);

    if (technieken) {
      for (const t of technieken) {
        results.push({
          id: t.id,
          title: t.name,
          content: t.beschrijving?.substring(0, 100),
          type: 'techniek',
          techniek_id: t.id,
          fase: t.fase,
          url: `/technieken?techniek=${t.id}`,
          adminRoute: 'admin-techniques'
        });
      }
    }

    // Search videos (title, description, original_filename, ai_attractive_title, ai_summary)
    const { data: videos } = await supabase
      .from('videos')
      .select('id, title, description, techniek_id, original_filename, ai_attractive_title')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%,original_filename.ilike.%${query}%,ai_attractive_title.ilike.%${query}%,ai_summary.ilike.%${query}%`)
      .limit(limit);

    if (videos) {
      for (const v of videos) {
        results.push({
          id: v.id,
          title: v.ai_attractive_title || v.title,
          content: v.original_filename ? `${v.original_filename}${v.description ? ' · ' + v.description.substring(0, 80) : ''}` : v.description?.substring(0, 100),
          type: 'video',
          techniek_id: v.techniek_id,
          url: `/videos?video=${v.id}`,
          adminRoute: 'admin-videos'
        });
      }
    }

    // Search webinars/live sessions
    const { data: webinars } = await supabase
      .from('live_sessions')
      .select('id, title, description, status')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .in('status', ['scheduled', 'completed', 'live'])
      .limit(limit);

    if (webinars) {
      for (const w of webinars) {
        results.push({
          id: w.id,
          title: w.title,
          content: w.description?.substring(0, 100),
          type: 'webinar',
          url: `/live?session=${w.id}`,
          adminRoute: 'admin-live'
        });
      }
    }

  } catch (error) {
    console.warn('[Search] Classic search error:', error);
  }

  return results;
}

/**
 * Semantic search using RAG embeddings
 */
async function semanticSearch(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const baseUrl = getVideoProcessorUrl();
    const response = await fetch(`${baseUrl}/api/rag/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit })
    });

    if (!response.ok) {
      console.warn('[Search] Semantic search failed:', response.status);
      return [];
    }

    const data = await response.json();
    const ragResults = data.results || [];

    return ragResults.map((r: any) => {
      const route = getRouteForResult(r);
      return {
        id: r.id,
        title: r.title || 'Zonder titel',
        content: r.content?.substring(0, 100),
        type: mapDocType(r.doc_type),
        techniek_id: r.techniek_id,
        fase: r.fase,
        similarity: r.similarity,
        url: route.url,
        adminRoute: route.adminRoute
      };
    });

  } catch (error) {
    console.warn('[Search] Semantic search error:', error);
    return [];
  }
}

function mapDocType(docType: string): SearchResult['type'] {
  switch (docType) {
    case 'techniek':
    case 'epic_techniek':
      return 'techniek';
    case 'video_transcript':
      return 'transcript';
    case 'hugo_training':
      return 'training';
    default:
      return 'training';
  }
}

function getRouteForResult(result: any): { url: string; adminRoute: string } {
  const type = mapDocType(result.doc_type);
  
  if (type === 'techniek' && result.techniek_id) {
    return { 
      url: `/technieken?techniek=${result.techniek_id}`,
      adminRoute: 'admin-techniques'
    };
  }
  if (type === 'transcript' && result.source_id) {
    return { 
      url: `/videos?video=${result.source_id}`,
      adminRoute: 'admin-videos'
    };
  }
  if (type === 'training' && result.techniek_id) {
    return { 
      url: `/technieken?techniek=${result.techniek_id}`,
      adminRoute: 'admin-techniques'
    };
  }
  
  return { url: '/dashboard', adminRoute: 'admin-dashboard' };
}

export default { hybridSearch };
