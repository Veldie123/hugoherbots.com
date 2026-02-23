import { getOpenAI } from '../openai-client';

export interface CompanyProfile {
  bedrijfsnaam: string;
  website?: string;
  samenvatting: string;
  producten_diensten: string[];
  doelgroep: string;
  usps: string[];
  positionering: string;
  tone_of_voice: string;
}

export async function analyzeCompanyWebsite(
  websiteUrl: string,
  bedrijfsnaam?: string
): Promise<CompanyProfile | null> {
  try {
    let url = websiteUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    console.log(`[website-analyzer] Fetching: ${url}`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    let pageContent = '';
    try {
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HugoCoach/1.0)',
          'Accept': 'text/html,application/xhtml+xml'
        }
      });
      clearTimeout(timeout);
      
      if (!response.ok) {
        console.warn(`[website-analyzer] HTTP ${response.status} for ${url}`);
        return buildMinimalProfile(bedrijfsnaam || url);
      }
      
      const html = await response.text();
      pageContent = extractTextFromHtml(html).substring(0, 8000);
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      console.warn(`[website-analyzer] Fetch failed: ${fetchErr.message}`);
      return buildMinimalProfile(bedrijfsnaam || url);
    }
    
    if (!pageContent || pageContent.length < 50) {
      return buildMinimalProfile(bedrijfsnaam || url);
    }
    
    const openai = getOpenAI();
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Je bent een bedrijfsanalist. Analyseer de volgende websitetekst en maak een beknopt bedrijfsprofiel.
Antwoord in JSON met deze structuur:
{
  "bedrijfsnaam": "naam",
  "samenvatting": "2-3 zinnen over het bedrijf",
  "producten_diensten": ["product1", "product2"],
  "doelgroep": "beschrijving doelgroep",
  "usps": ["usp1", "usp2"],
  "positionering": "hoe positioneert het bedrijf zich",
  "tone_of_voice": "formeel/informeel/professioneel/etc"
}`
        },
        {
          role: 'user',
          content: `Website: ${url}\n${bedrijfsnaam ? `Bedrijf: ${bedrijfsnaam}\n` : ''}\nContent:\n${pageContent}`
        }
      ],
      max_completion_tokens: 800,
      response_format: { type: 'json_object' }
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) return buildMinimalProfile(bedrijfsnaam || url);
    
    const parsed = JSON.parse(content) as CompanyProfile;
    parsed.website = url;
    if (bedrijfsnaam) parsed.bedrijfsnaam = bedrijfsnaam;
    
    console.log(`[website-analyzer] Profile created for: ${parsed.bedrijfsnaam}`);
    return parsed;
    
  } catch (error: any) {
    console.error('[website-analyzer] Error:', error.message);
    return buildMinimalProfile(bedrijfsnaam || websiteUrl);
  }
}

function extractTextFromHtml(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return text;
}

function buildMinimalProfile(name: string): CompanyProfile {
  return {
    bedrijfsnaam: name,
    samenvatting: `Bedrijfsinformatie nog niet beschikbaar.`,
    producten_diensten: [],
    doelgroep: '',
    usps: [],
    positionering: '',
    tone_of_voice: ''
  };
}

export function formatCompanyProfileForPrompt(profile: CompanyProfile): string {
  const parts: string[] = [];
  parts.push(`Bedrijf: ${profile.bedrijfsnaam}`);
  if (profile.website) parts.push(`Website: ${profile.website}`);
  if (profile.samenvatting) parts.push(`Over: ${profile.samenvatting}`);
  if (profile.producten_diensten.length > 0) {
    parts.push(`Producten/Diensten: ${profile.producten_diensten.join(', ')}`);
  }
  if (profile.doelgroep) parts.push(`Doelgroep: ${profile.doelgroep}`);
  if (profile.usps.length > 0) {
    parts.push(`USP's: ${profile.usps.join(', ')}`);
  }
  if (profile.positionering) parts.push(`Positionering: ${profile.positionering}`);
  return parts.join('\n');
}
