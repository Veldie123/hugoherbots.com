/**
 * Speech Humanizer Service v2 — ElevenLabs v3 Ready
 * 
 * Post-processor that transforms clean AI text into natural-sounding speech
 * for audio/video modes.
 * 
 * Dual-mode design:
 * - v2.5 (current LiveKit path): Natural pauses, hesitations, emphasis via
 *   punctuation and Dutch filler words. No emotion tags.
 * - v3 (future, when LiveKit supports it): Adds official ElevenLabs v3 audio
 *   tags: [laughs], [whispers], [sighs], [excited] based on coaching context.
 * 
 * NOTE: This is ONLY used for audio/video output, not chat mode.
 */

type CoachingContext = 
  | 'encouragement'
  | 'correction'
  | 'roleplay_setup'
  | 'roleplay_in_character'
  | 'reflection'
  | 'explanation'
  | 'challenge'
  | 'debrief'
  | 'greeting'
  | 'neutral';

interface HumanizerConfig {
  hesitationRate: number;
  breathingThreshold: number;
  language: 'nl' | 'en';
  useEmotionTags: boolean;
}

const DEFAULT_CONFIG: HumanizerConfig = {
  hesitationRate: 0.12,
  breathingThreshold: 80,
  language: 'nl',
  useEmotionTags: false,
};

const DUTCH_HESITATIONS = [
  'euh',
  'uhm',
  'nou',
  'even kijken',
  'laat me even denken',
  'hmm',
];

const ENGLISH_HESITATIONS = [
  'uh',
  'um',
  'well',
  'let me think',
  'hmm',
];

const EMPHASIS_PHRASES = [
  'heel belangrijk',
  'let op',
  'cruciaal',
  'de sleutel is',
  'onthoud',
  'het belangrijkste',
  'de kern is',
  'essentieel',
  'perfect',
  'uitstekend',
  'precies',
];

const ENCOURAGEMENT_PATTERNS = [
  /goed gedaan/i, /uitstekend/i, /perfect/i, /precies/i,
  /heel goed/i, /geweldig/i, /fantastisch/i, /top/i,
  /mooi zo/i, /sterke/i, /prima/i, /knap/i,
  /dat klopt/i, /exact/i, /helemaal goed/i,
  /je bent op de goede weg/i, /dat is een sterke/i,
];

const CORRECTION_PATTERNS = [
  /let op/i, /pas op/i, /niet helemaal/i, /probeer/i,
  /in plaats van/i, /beter zou zijn/i, /tip:/i,
  /wat je beter/i, /je zou kunnen/i, /denk eraan/i,
  /let erop/i, /vermijd/i, /een valkuil/i,
];

const ROLEPLAY_SETUP_PATTERNS = [
  /laten we oefenen/i, /stel je voor/i, /in dit scenario/i,
  /je bent nu/i, /de klant is/i, /begin maar/i,
  /roleplay/i, /oefening/i, /simulatie/i,
  /laten we een gesprek/i, /ik speel de klant/i,
];

const REFLECTION_PATTERNS = [
  /wat denk je/i, /hoe voelde/i, /wat viel je op/i,
  /als je terugkijkt/i, /wat zou je anders/i,
  /wat heb je geleerd/i, /wat neem je mee/i,
  /sta even stil/i, /reflecteer/i,
];

const CHALLENGE_PATTERNS = [
  /maar wat als/i, /stel dat de klant/i, /hoe zou je/i,
  /wat doe je als/i, /de klant zegt/i, /bezwaar/i,
  /moeilijke situatie/i, /uitdaging/i,
];

const GREETING_PATTERNS = [
  /^hoi/i, /^hallo/i, /^hey/i, /^welkom/i,
  /^goedemorgen/i, /^goedemiddag/i, /^goedenavond/i,
  /leuk je te/i, /fijn dat je er bent/i,
];

function detectCoachingContext(text: string): CoachingContext {
  if (GREETING_PATTERNS.some(p => p.test(text))) return 'greeting';
  if (ROLEPLAY_SETUP_PATTERNS.some(p => p.test(text))) return 'roleplay_setup';
  if (REFLECTION_PATTERNS.some(p => p.test(text))) return 'reflection';
  if (CHALLENGE_PATTERNS.some(p => p.test(text))) return 'challenge';

  const encouragementScore = ENCOURAGEMENT_PATTERNS.filter(p => p.test(text)).length;
  const correctionScore = CORRECTION_PATTERNS.filter(p => p.test(text)).length;

  if (encouragementScore >= 2) return 'encouragement';
  if (correctionScore >= 2) return 'correction';
  if (encouragementScore > 0 && correctionScore > 0) return 'debrief';
  if (encouragementScore > 0) return 'encouragement';
  if (correctionScore > 0) return 'correction';

  if (text.length > 200) return 'explanation';
  return 'neutral';
}

/**
 * Add official ElevenLabs v3 emotion tags based on coaching context.
 * Only uses documented v3 tags: [laughs], [whispers], [sighs], [excited]
 * These are ONLY injected when useEmotionTags is true (v3 model active).
 */
function addEmotionTags(text: string, context: CoachingContext): string {
  let result = text;

  switch (context) {
    case 'encouragement':
      result = result.replace(
        /(goed gedaan|uitstekend|perfect|precies|heel goed|geweldig|fantastisch|mooi zo|knap|prima)/gi,
        '[excited] $1'
      );
      break;

    case 'correction':
      result = `[sighs] ${result}`;
      break;

    case 'roleplay_setup':
      result = `[excited] ${result}`;
      break;

    case 'reflection':
      break;

    case 'debrief':
      const sentences = result.split(/(?<=[.!?])\s+/);
      result = sentences.map(s => {
        if (ENCOURAGEMENT_PATTERNS.some(p => p.test(s))) {
          return `[excited] ${s}`;
        }
        return s;
      }).join(' ');
      break;

    case 'greeting':
    case 'challenge':
    case 'explanation':
    case 'roleplay_in_character':
    case 'neutral':
    default:
      break;
  }

  return result;
}

function addHesitations(text: string, cfg: HumanizerConfig): string {
  const hesitations = cfg.language === 'nl' ? DUTCH_HESITATIONS : ENGLISH_HESITATIONS;
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  return sentences.map((sentence, index) => {
    if (index === 0 || sentence.length < 30) return sentence;
    
    if (Math.random() < cfg.hesitationRate) {
      const hesitation = hesitations[Math.floor(Math.random() * hesitations.length)];
      return `${hesitation}... ${sentence}`;
    }
    
    return sentence;
  }).join(' ');
}

function addBreathingMarks(text: string, cfg: HumanizerConfig): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  return sentences.map(sentence => {
    if (sentence.length > cfg.breathingThreshold) {
      const breakPoints = [', ', ' en ', ' maar ', ' of ', ' want '];
      for (const bp of breakPoints) {
        const idx = sentence.indexOf(bp);
        if (idx > 20 && idx < sentence.length - 20) {
          return sentence.slice(0, idx + bp.length) + '... ' + sentence.slice(idx + bp.length);
        }
      }
    }
    return sentence;
  }).join(' ');
}

function addEmphasisPlain(text: string): string {
  let result = text;
  for (const phrase of EMPHASIS_PHRASES) {
    const regex = new RegExp(`\\b(${phrase})\\b`, 'gi');
    result = result.replace(regex, '— $1 —');
  }
  return result;
}

function addSentencePauses(text: string): string {
  return text.replace(/\. ([A-Z])/g, (match, letter) => {
    if (Math.random() < 0.1) {
      return `. — ${letter}`;
    }
    return match;
  });
}

/**
 * Main humanizer function.
 * 
 * For v2.5 models (current): Uses natural pauses, hesitations, emphasis.
 *   Emotion tags are OFF by default — they would leak as audible text.
 * 
 * For v3 models (future): Also injects official v3 audio tags
 *   [laughs], [whispers], [sighs], [excited] based on coaching context.
 */
export function humanizeSpeechPlainText(text: string, config: Partial<HumanizerConfig> = {}): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  if (!text || text.trim().length === 0) return text;
  
  const context = detectCoachingContext(text);
  console.log(`[SpeechHumanizer] Context: ${context}, emotionTags: ${cfg.useEmotionTags}, length: ${text.length}`);
  
  let result = text;
  
  if (cfg.useEmotionTags) {
    result = addEmotionTags(result, context);
  }
  
  result = addHesitations(result, cfg);
  result = addBreathingMarks(result, cfg);
  result = addEmphasisPlain(result);
  result = addSentencePauses(result);
  
  return result;
}

/**
 * Light humanization — minimal processing, no emotion tags
 */
export function humanizeSpeechLight(text: string): string {
  return humanizeSpeechPlainText(text, {
    hesitationRate: 0,
    useEmotionTags: false,
  });
}

/**
 * Heavy humanization — more natural, casual coaching conversations
 */
export function humanizeSpeechNatural(text: string): string {
  return humanizeSpeechPlainText(text, {
    hesitationRate: 0.22,
    breathingThreshold: 60,
    useEmotionTags: false,
  });
}

/**
 * Backward-compatible export — delegates to humanizeSpeechPlainText
 */
export function humanizeSpeech(
  text: string,
  config: Partial<HumanizerConfig> = {}
): string {
  return humanizeSpeechPlainText(text, config);
}

/**
 * Check if ElevenLabs model supports v3 emotion audio tags
 */
export function supportsEmotionTags(model: string): boolean {
  return model === 'eleven_v3' || model === 'eleven_v3_conversational';
}

/**
 * Check if ElevenLabs model supports SSML
 */
export function supportsSSML(model: string): boolean {
  const ssmlSupportedModels = [
    'eleven_multilingual_v2',
    'eleven_monolingual_v1',
  ];
  return ssmlSupportedModels.includes(model);
}

/**
 * Get the right humanizer function for a given TTS model.
 * - v3 models: enables emotion tags ([laughs], [excited], etc.)
 * - v2.5 models: plain text only (pauses, hesitations, emphasis)
 */
export function getHumanizerForModel(model: string): (text: string) => string {
  if (supportsEmotionTags(model)) {
    return (text) => humanizeSpeechPlainText(text, { useEmotionTags: true });
  }
  return (text) => humanizeSpeechPlainText(text, { useEmotionTags: false });
}

export { detectCoachingContext };
export type { CoachingContext, HumanizerConfig };
