import { GoogleGenAI } from "@google/genai";

let cached: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (cached) return cached;

  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) environment variable. Add it to .env.local.",
    );
  }

  cached = new GoogleGenAI({ apiKey });
  return cached;
}

// Default to Flash because gemini-2.5-pro has NO free-tier quota (daily limit is 0).
// If your API key is on a paid plan, override with GEMINI_MODEL=gemini-2.5-pro.
export const GEMINI_MAIN_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
export const GEMINI_FAST_MODEL =
  process.env.GEMINI_FAST_MODEL ?? "gemini-2.5-flash-lite";

export type ChatTone = "crisp" | "clear" | "chatty";

export const TONE_INSTRUCTIONS: Record<ChatTone, string> = {
  crisp:
    "Tone: Crisp. Be brief, direct, factual. Maximum 2-3 short sentences. Get straight to the point.",
  clear:
    "Tone: Clear. Be professional, organized, and helpful. Balanced responses of 4-6 sentences.",
  chatty:
    "Tone: Chatty. Be friendly, conversational, and personable. Talk like an enthusiastic colleague. Slightly longer responses are fine, and feel free to ask follow-up questions.",
};
