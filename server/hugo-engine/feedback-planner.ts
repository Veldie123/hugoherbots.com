import Anthropic from "@anthropic-ai/sdk";

interface FeedbackPlanInput {
  id: number;
  description: string;
  pageUrl: string;
  elements: Array<{ selector: string; tagName: string; textContent: string }>;
  screenshotUrl?: string;
}

export async function generateFeedbackPlan(input: FeedbackPlanInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  const client = new Anthropic({ apiKey });
  const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

  // Include screenshot as visual context if available
  if (input.screenshotUrl) {
    try {
      const imgResponse = await fetch(input.screenshotUrl);
      if (imgResponse.ok) {
        const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: imgBuffer.toString("base64"),
          },
        });
      }
    } catch (err) {
      console.warn("[FeedbackPlanner] Could not fetch screenshot:", (err as Error).message);
    }
  }

  const elementsDescription = input.elements.length > 0
    ? input.elements.map(e => `  - <${e.tagName}> "${e.textContent}" (selector: ${e.selector})`).join("\n")
    : "  (geen elementen geselecteerd)";

  content.push({
    type: "text",
    text: `Je bent een frontend developer voor het HugoHerbots.com platform (React + Tailwind CSS v4 + Vite).

Een gebruiker heeft UI feedback ingediend via de feedback widget:

**Pagina:** ${input.pageUrl}
**Beschrijving:** "${input.description}"
**Geselecteerde elementen:**
${elementsDescription}

${input.screenshotUrl ? "De screenshot hierboven toont exact wat de gebruiker ziet." : "Er is geen screenshot beschikbaar."}

Analyseer de feedback en genereer een concreet uitvoerbaar plan:

1. **Wat wil de gebruiker?** — Interpreteer de beschrijving in combinatie met de screenshot en elementen.
2. **Welke bestanden moeten gewijzigd worden?** — Geef exacte bestandspaden (bijv. \`src/components/HH/VideosPage.tsx\`).
3. **Wat moet er precies veranderen?** — Beschrijf de wijziging zo specifiek mogelijk (welke CSS class, welke prop, welke tekst).
4. **Hoe verifiëren?** — Hoe controleer je dat de fix correct is?

Belangrijk:
- Het project gebruikt \`hh-*\` design tokens (zie \`src/styles/globals.css\`). Nooit hardcoded kleuren.
- Components staan in \`src/components/HH/\`.
- Interface taal is Nederlands.

Antwoord in het Nederlands. Wees bondig maar specifiek.`,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{ role: "user", content }],
  });

  const textBlock = response.content.find(b => b.type === "text");
  return textBlock ? textBlock.text : "Kon geen plan genereren.";
}
