/**
 * Voice Adapter — OpenAI ↔ Claude format bridge
 *
 * ElevenLabs Conversational AI sends OpenAI Chat Completions format.
 * We translate to/from our V3 agent format.
 */
import type { V3StreamEvent } from "./agent";

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Extract the latest user message from OpenAI-format messages array.
 * ElevenLabs may include system messages — we skip those.
 */
export function extractUserMessage(messages: OpenAIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user" && messages[i].content?.trim()) {
      return messages[i].content.trim();
    }
  }
  return "";
}

/**
 * Clean text for TTS — strip markdown and formatting that sounds bad when spoken.
 * Adapted from livekit-agent.ts cleanTextForTTS.
 */
export function cleanTextForVoice(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/\.{2,}/g, ".");
  cleaned = cleaned.replace(/[—–]/g, ", ");
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1"); // **bold** → bold
  cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");     // *italic* → italic
  cleaned = cleaned.replace(/#{1,6}\s*/g, "");          // # headings → text
  cleaned = cleaned.replace(/```[\s\S]*?```/g, "");     // code blocks → remove
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1");        // inline code → text
  cleaned = cleaned.replace(/^\s*[-*]\s+/gm, "");       // bullet points → text
  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, "");      // numbered lists → text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // [link](url) → link text
  cleaned = cleaned.replace(/\n{2,}/g, ". ");
  cleaned = cleaned.replace(/\n/g, " ");
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  return cleaned.trim();
}

/**
 * Convert V3 stream events to OpenAI SSE format.
 * ElevenLabs expects: data: {"choices":[{"delta":{"content":"..."}}]}\n\n
 */
export async function* claudeStreamToOpenaiSSE(
  v3Stream: AsyncGenerator<V3StreamEvent>
): AsyncGenerator<string> {
  const id = `chatcmpl-${Date.now()}`;

  for await (const event of v3Stream) {
    switch (event.type) {
      case "token": {
        const cleaned = cleanTextForVoice(event.content || "");
        if (cleaned) {
          yield `data: ${JSON.stringify({
            id,
            object: "chat.completion.chunk",
            choices: [{
              index: 0,
              delta: { content: cleaned },
              finish_reason: null,
            }],
          })}\n\n`;
        }
        break;
      }
      case "thinking":
      case "tool_start":
      case "tool_result":
        // Don't send internal events to ElevenLabs
        break;
      case "done":
        yield `data: ${JSON.stringify({
          id,
          object: "chat.completion.chunk",
          choices: [{
            index: 0,
            delta: {},
            finish_reason: "stop",
          }],
        })}\n\n`;
        yield "data: [DONE]\n\n";
        break;
      case "error":
        // Send error as text so Hugo says something
        yield `data: ${JSON.stringify({
          id,
          object: "chat.completion.chunk",
          choices: [{
            index: 0,
            delta: { content: "Sorry, er ging even iets mis. Kun je dat herhalen?" },
            finish_reason: null,
          }],
        })}\n\n`;
        yield `data: ${JSON.stringify({
          id,
          object: "chat.completion.chunk",
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        })}\n\n`;
        yield "data: [DONE]\n\n";
        break;
    }
  }
}
