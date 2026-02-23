export interface ContentSuggestion {
  type: 'video' | 'slide' | 'webinar' | 'roleplay' | 'technique';
  reason: string;
  techniqueId?: string;
  priority: number;
}

export interface IntentResult {
  primaryIntent: 'chat' | 'learn' | 'practice' | 'review' | 'explore';
  contentSuggestions: ContentSuggestion[];
  shouldSuggestRoleplay: boolean;
  shouldSuggestVideo: boolean;
  shouldSuggestSlide: boolean;
  confidence: number;
}

const VIDEO_TRIGGERS = ['video', 'laten zien', 'voorbeeld', 'hoe ziet dat eruit', 'demonstratie', 'bekijken', 'filmpje', 'kijken'];
const SLIDE_TRIGGERS = ['slide', 'presentatie', 'samenvatting', 'overzicht', 'stappen', 'schema', 'diagram'];
const ROLEPLAY_TRIGGERS = ['oefenen', 'rollenspel', 'proberen', 'simulatie', 'praktijk', 'uitproberen', 'trainen'];
const WEBINAR_TRIGGERS = ['webinar', 'verdieping', 'workshop', 'training', 'masterclass', 'sessie'];
const STRUGGLE_TRIGGERS = ['moeilijk', 'snap niet', 'begrijp niet', 'lastig', 'help', 'probleem', 'lukt niet', 'weet niet', 'geen idee', 'uitleg'];
const LEARN_TRIGGERS = ['leer', 'uitleggen', 'wat is', 'hoe werkt', 'waarom', 'verschil', 'betekent', 'theorie'];
const REVIEW_TRIGGERS = ['herhalen', 'terugkijken', 'samenvatten', 'recap', 'opnieuw', 'nog een keer'];
const EXPLORE_TRIGGERS = ['andere techniek', 'volgende', 'meer', 'wat kan ik nog', 'welke technieken', 'alternatieven'];

const TECHNIQUE_PATTERN = /\b(\d\.\d)\b/;

function matchesTriggers(text: string, triggers: string[]): boolean {
  const lower = text.toLowerCase();
  return triggers.some(t => lower.includes(t));
}

function countTriggerMatches(text: string, triggers: string[]): number {
  const lower = text.toLowerCase();
  return triggers.filter(t => lower.includes(t)).length;
}

function extractTechniqueId(text: string): string | undefined {
  const match = text.match(TECHNIQUE_PATTERN);
  return match ? match[1] : undefined;
}

export function detectIntent(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  currentTechniqueId?: string,
  userContext?: { mastery?: Record<string, number>; recentActivity?: string[] }
): IntentResult {
  const suggestions: ContentSuggestion[] = [];
  let shouldSuggestRoleplay = false;
  let shouldSuggestVideo = false;
  let shouldSuggestSlide = false;
  let confidence = 0.5;

  const wantsVideo = matchesTriggers(userMessage, VIDEO_TRIGGERS);
  const wantsSlide = matchesTriggers(userMessage, SLIDE_TRIGGERS);
  const wantsRoleplay = matchesTriggers(userMessage, ROLEPLAY_TRIGGERS);
  const wantsWebinar = matchesTriggers(userMessage, WEBINAR_TRIGGERS);
  const isStruggling = matchesTriggers(userMessage, STRUGGLE_TRIGGERS);
  const wantsToLearn = matchesTriggers(userMessage, LEARN_TRIGGERS);
  const wantsReview = matchesTriggers(userMessage, REVIEW_TRIGGERS);
  const wantsExplore = matchesTriggers(userMessage, EXPLORE_TRIGGERS);

  const mentionedTechnique = extractTechniqueId(userMessage);
  const targetTechnique = mentionedTechnique || currentTechniqueId;

  let primaryIntent: IntentResult['primaryIntent'] = 'chat';

  if (wantsRoleplay) {
    primaryIntent = 'practice';
    shouldSuggestRoleplay = true;
    confidence = 0.9;
    suggestions.push({
      type: 'roleplay',
      reason: 'Gebruiker wil oefenen',
      techniqueId: targetTechnique,
      priority: 9,
    });
  }

  if (wantsVideo) {
    if (primaryIntent === 'chat') primaryIntent = 'learn';
    shouldSuggestVideo = true;
    confidence = Math.max(confidence, 0.85);
    suggestions.push({
      type: 'video',
      reason: 'Gebruiker vraagt om video',
      techniqueId: targetTechnique,
      priority: 8,
    });
  }

  if (wantsSlide) {
    if (primaryIntent === 'chat') primaryIntent = 'learn';
    shouldSuggestSlide = true;
    confidence = Math.max(confidence, 0.85);
    suggestions.push({
      type: 'slide',
      reason: 'Gebruiker vraagt om slides/overzicht',
      techniqueId: targetTechnique,
      priority: 7,
    });
  }

  if (wantsWebinar) {
    if (primaryIntent === 'chat') primaryIntent = 'learn';
    confidence = Math.max(confidence, 0.8);
    suggestions.push({
      type: 'webinar',
      reason: 'Gebruiker vraagt om webinar/verdieping',
      techniqueId: targetTechnique,
      priority: 6,
    });
  }

  if (isStruggling) {
    if (primaryIntent === 'chat') primaryIntent = 'learn';
    confidence = Math.max(confidence, 0.75);

    if (targetTechnique) {
      if (!shouldSuggestVideo) {
        shouldSuggestVideo = true;
        suggestions.push({
          type: 'video',
          reason: 'Gebruiker heeft moeite - video kan helpen',
          techniqueId: targetTechnique,
          priority: 7,
        });
      }
      if (!shouldSuggestSlide) {
        shouldSuggestSlide = true;
        suggestions.push({
          type: 'slide',
          reason: 'Gebruiker heeft moeite - overzicht kan helpen',
          techniqueId: targetTechnique,
          priority: 6,
        });
      }
    }
  }

  if (wantsToLearn && primaryIntent === 'chat') {
    primaryIntent = 'learn';
    confidence = Math.max(confidence, 0.7);
    if (targetTechnique) {
      suggestions.push({
        type: 'technique',
        reason: 'Gebruiker wil meer leren over techniek',
        techniqueId: targetTechnique,
        priority: 5,
      });
    }
  }

  if (wantsReview) {
    primaryIntent = 'review';
    confidence = Math.max(confidence, 0.7);
    if (targetTechnique) {
      suggestions.push({
        type: 'slide',
        reason: 'Gebruiker wil herhalen/samenvatten',
        techniqueId: targetTechnique,
        priority: 6,
      });
    }
  }

  if (wantsExplore) {
    primaryIntent = 'explore';
    confidence = Math.max(confidence, 0.7);
  }

  if (mentionedTechnique && suggestions.length === 0) {
    suggestions.push({
      type: 'technique',
      reason: `Techniek ${mentionedTechnique} genoemd in gesprek`,
      techniqueId: mentionedTechnique,
      priority: 4,
    });
  }

  if (userContext?.mastery && targetTechnique) {
    const masteryLevel = userContext.mastery[targetTechnique];
    if (masteryLevel !== undefined && masteryLevel < 3 && !shouldSuggestRoleplay) {
      suggestions.push({
        type: 'roleplay',
        reason: 'Laag beheersingsniveau - oefening aanbevolen',
        techniqueId: targetTechnique,
        priority: 3,
      });
    }
  }

  const recentMessages = conversationHistory.slice(-4);
  const repeatedStruggles = recentMessages.filter(
    m => m.role === 'user' && matchesTriggers(m.content, STRUGGLE_TRIGGERS)
  ).length;
  if (repeatedStruggles >= 2 && !shouldSuggestVideo) {
    shouldSuggestVideo = true;
    confidence = Math.max(confidence, 0.8);
    suggestions.push({
      type: 'video',
      reason: 'Herhaalde moeite gedetecteerd - visuele uitleg kan helpen',
      techniqueId: targetTechnique,
      priority: 8,
    });
  }

  suggestions.sort((a, b) => b.priority - a.priority);

  return {
    primaryIntent,
    contentSuggestions: suggestions,
    shouldSuggestRoleplay,
    shouldSuggestVideo,
    shouldSuggestSlide,
    confidence,
  };
}
