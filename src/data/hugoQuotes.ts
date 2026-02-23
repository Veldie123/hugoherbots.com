/**
 * Hugo Herbots' Signature Sales Quotes
 * Typische uitspraken van Hugo - direct, krachtig, onvergetelijk
 */

export interface HugoQuote {
  text: string;
  context?: "motivation" | "closing" | "mindset" | "technique" | "objection" | "persistence" | "listening" | "value";
}

export const HUGO_QUOTES: HugoQuote[] = [
  { text: "Price is what you pay, value is what you get!", context: "value" },
  { text: "Durven te durven!", context: "motivation" },
  { text: "Contacten zijn contracten!", context: "closing" },
  { text: "Telling is not Selling!", context: "technique" },
  { text: "Succes is an attitude of mind!", context: "mindset" },
  { text: "ABC: Always Be Closing!", context: "closing" },
  { text: "Wie schrijft die blijft!", context: "technique" },
  { text: "Men kan morgen niet zeilen met de wind van vandaag!", context: "mindset" },
  { text: "Het ijzer smeden als het warm heeft!", context: "technique" },
  { text: "An objection is not a rejection!", context: "objection" },
  { text: "Never give up!", context: "persistence" },
  { text: "Buyers are liars!", context: "technique" },
  { text: "Verkoop begint wanneer de klant neen zegt!", context: "objection" },
  { text: "No pain, no change, no sales!", context: "mindset" },
  { text: "You are only as good as your last sale!", context: "motivation" },
  { text: "Sell the problem you solve, not the product you have!", context: "value" },
  { text: "Listen more, talk less, close faster!", context: "listening" },
  { text: "A No is just a hidden Yes!", context: "objection" },
  { text: "Will + Skill + Drill", context: "mindset" },
  { text: "KISS: Keep It Simple, Stupid!", context: "technique" },
  { text: "1 beeld zegt meer dan 1000 woorden", context: "technique" },
];

/**
 * Get a random Hugo quote
 */
export function getRandomQuote(): HugoQuote {
  return HUGO_QUOTES[Math.floor(Math.random() * HUGO_QUOTES.length)];
}

/**
 * Get quotes by context
 */
export function getQuotesByContext(context: HugoQuote["context"]): HugoQuote[] {
  return HUGO_QUOTES.filter(q => q.context === context);
}

/**
 * Get daily quote (deterministic based on date)
 */
export function getDailyQuote(): HugoQuote {
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  return HUGO_QUOTES[dayOfYear % HUGO_QUOTES.length];
}
