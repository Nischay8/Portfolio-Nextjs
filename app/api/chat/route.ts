import type { NextRequest } from "next/server";
import {
  GEMINI_FAST_MODEL,
  GEMINI_MAIN_MODEL,
  type ChatTone,
  TONE_INSTRUCTIONS,
  getGeminiClient,
} from "@/lib/gemini/client";
import { getPortfolioContext } from "@/lib/gemini/portfolio-context";
import {
  loadAiTwinPrompt,
  loadGuardrailFailPrompt,
  loadTopicFilterPrompt,
} from "@/lib/gemini/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequestBody = {
  messages: ClientMessage[];
  tone?: ChatTone;
};

function toGeminiContents(messages: ClientMessage[]) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

async function isOnTopic(latestUserMessage: string): Promise<boolean> {
  try {
    const ai = getGeminiClient();
    const systemInstruction = await loadTopicFilterPrompt();

    const response = await ai.models.generateContent({
      model: GEMINI_FAST_MODEL,
      contents: [{ role: "user", parts: [{ text: latestUserMessage }] }],
      config: {
        systemInstruction,
        temperature: 0,
        maxOutputTokens: 8,
      },
    });

    const text = (response.text ?? "").trim().toLowerCase();
    // Default to allowing on ambiguous output so users aren't unfairly blocked.
    if (text.startsWith("false")) return false;
    return true;
  } catch (error) {
    console.error("[chat] topic filter failed, allowing by default:", error);
    return true;
  }
}

function streamFromIterator(
  iterator: AsyncIterable<{ text?: string }>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of iterator) {
          const text = chunk.text;
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
      } catch (error) {
        console.error("[chat] stream error:", error);
        controller.enqueue(
          encoder.encode(
            "\n\nSorry, something went wrong while generating my response.",
          ),
        );
      } finally {
        controller.close();
      }
    },
  });
}

export async function POST(req: NextRequest) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { messages, tone = "clear" } = body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("messages array is required", { status: 400 });
  }

  const latestUser = [...messages].reverse().find((m) => m.role === "user");
  if (!latestUser?.content?.trim()) {
    return new Response("No user message found", { status: 400 });
  }

  let ai: ReturnType<typeof getGeminiClient>;
  try {
    ai = getGeminiClient();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gemini is not configured";
    return new Response(message, { status: 500 });
  }

  const onTopic = await isOnTopic(latestUser.content);

  const toneInstruction = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.clear;

  let systemInstruction: string;

  if (!onTopic) {
    const guardrailPrompt = await loadGuardrailFailPrompt();
    systemInstruction = `${guardrailPrompt}\n\n${toneInstruction}\n\nReply in first person as the portfolio owner. Politely decline the off-topic request and steer the user toward portfolio-relevant questions.`;
  } else {
    const [twinPrompt, portfolioContext] = await Promise.all([
      loadAiTwinPrompt(),
      getPortfolioContext(),
    ]);

    systemInstruction = [
      twinPrompt,
      "",
      "## Live Portfolio Data (authoritative source - use ONLY this data, never invent facts)",
      "",
      "Below is the current Sanity CMS data for the portfolio owner. Treat it as your personal knowledge and ground every answer in it. If a field is missing or empty, say you don't have that detail documented rather than guessing.",
      "",
      "```json",
      portfolioContext,
      "```",
      "",
      toneInstruction,
    ].join("\n");
  }

  let streamIterator: AsyncIterable<{ text?: string }>;
  try {
    streamIterator = await ai.models.generateContentStream({
      model: GEMINI_MAIN_MODEL,
      contents: toGeminiContents(messages),
      config: {
        systemInstruction,
        temperature: onTopic ? 0.7 : 0.3,
      },
    });
  } catch (error) {
    console.error("[chat] Gemini request failed:", error);
    return new Response(formatGeminiError(error), { status: 502 });
  }

  const stream = streamFromIterator(streamIterator);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

function formatGeminiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  // Try to pull the structured message out of the SDK's nested JSON error body.
  let inner: { code?: number; message?: string; status?: string } | undefined;
  try {
    const outer = JSON.parse(raw) as { error?: { message?: string } };
    if (outer?.error?.message) {
      const parsed = JSON.parse(outer.error.message) as {
        error?: typeof inner;
      };
      inner = parsed?.error;
    }
  } catch {
    // Not JSON — fall through.
  }

  const code = inner?.code;
  const status = inner?.status;
  const message = inner?.message ?? raw;

  if (code === 429 || status === "RESOURCE_EXHAUSTED") {
    if (/free_tier/i.test(message) && /gemini-2\.5-pro/i.test(message)) {
      return "Gemini quota exceeded: the free tier does not include gemini-2.5-pro. Set GEMINI_MODEL=gemini-2.5-flash in .env.local (or enable billing on your Google AI project to use Pro).";
    }
    return "Gemini quota exceeded. Please wait a minute and try again, or switch to a different model via GEMINI_MODEL in .env.local.";
  }

  if (code === 401 || code === 403 || status === "UNAUTHENTICATED" || status === "PERMISSION_DENIED") {
    return "Gemini rejected the API key. Double-check GEMINI_API_KEY in .env.local.";
  }

  if (code === 400 || status === "INVALID_ARGUMENT") {
    return `Gemini rejected the request: ${message}`;
  }

  return `Gemini request failed: ${message}`;
}
