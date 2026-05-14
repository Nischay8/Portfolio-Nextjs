"use client";

import {
  Box,
  Briefcase,
  Loader2,
  RotateCcw,
  Send,
  SquareCode,
  User,
  X,
} from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CHAT_PROFILE_QUERYResult } from "@/sanity.types";
import { Button } from "../ui/button";
import { useSidebar } from "../ui/sidebar";

type ChatRole = "user" | "assistant";

type Message = {
  id: string;
  role: ChatRole;
  content: string;
};

type Tone = "crisp" | "clear" | "chatty";

const TONES: { id: Tone; label: string; description: string }[] = [
  { id: "crisp", label: "Crisp", description: "Concise and factual" },
  { id: "clear", label: "Clear", description: "Focused and helpful" },
  { id: "chatty", label: "Chatty", description: "Conversational companion" },
];

type StarterPrompt = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  prompt: string;
};

const STARTER_PROMPTS: StarterPrompt[] = [
  {
    icon: Briefcase,
    label: "What's your experience?",
    prompt: "Tell me about your professional experience and previous roles",
  },
  {
    icon: SquareCode,
    label: "What skills do you have?",
    prompt:
      "What technologies and programming languages do you specialize in?",
  },
  {
    icon: Box,
    label: "What have you built?",
    prompt: "Show me some of your most interesting projects",
  },
  {
    icon: User,
    label: "Who are you?",
    prompt: "Tell me more about yourself and your background",
  },
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function Chat({
  profile,
}: {
  profile: CHAT_PROFILE_QUERYResult | null;
}) {
  const { toggleSidebar } = useSidebar();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [tone, setTone] = useState<Tone>("clear");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const firstName = profile?.firstName ?? null;
  const lastName = profile?.lastName ?? null;
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  const greeting = fullName
    ? `Hi! I'm ${fullName}. Ask me anything about my work, experience, or projects.`
    : "Hi there! Ask me anything about my work, experience, or projects.";

  const headerTitle = `Chat with ${firstName ?? "Me"}`;

  // Total character count across all messages so the scroll effect re-runs
  // on every streaming chunk, not just when new messages are appended.
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || totalChars === 0) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [totalChars]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function sendMessage(rawText: string) {
    const text = rawText.trim();
    if (!text || isStreaming) return;

    setError(null);
    const userMessage: Message = { id: uid(), role: "user", content: text };
    const assistantId = uid();
    const placeholder: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
    };

    const nextMessages = [...messages, userMessage];
    setMessages([...nextMessages, placeholder]);
    setInput("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tone,
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => "");
        throw new Error(errText || `Request failed with ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: buffer } : m,
          ),
        );
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  m.content ||
                  "Sorry, I couldn't generate a response. Please try again.",
              }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function clearChat() {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setInput("");
    setError(null);
    setIsStreaming(false);
  }

  const showStartScreen = messages.length === 0;
  const canClear = messages.length > 0 || isStreaming;

  return (
    <div className="flex h-full w-full flex-col bg-white text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Close chat"
          className="rounded-md p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <X className="size-4" />
        </button>
        <h2 className="text-sm font-semibold tracking-tight">{headerTitle}</h2>
        <button
          type="button"
          onClick={clearChat}
          disabled={!canClear}
          aria-label="Clear chat"
          title="Clear chat"
          className="rounded-md p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-500"
        >
          <RotateCcw className="size-4" />
        </button>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        {showStartScreen ? (
          <StartScreen greeting={greeting} onPick={(p) => sendMessage(p)} />
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                role={m.role}
                content={m.content}
                isStreaming={
                  isStreaming &&
                  m.role === "assistant" &&
                  m.id === messages.at(-1)?.id
                }
              />
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-neutral-200 bg-white px-4 pt-3 pb-2">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {TONES.map((t) => {
            const active = tone === t.id;
            return (
              <button
                key={t.id}
                type="button"
                title={t.description}
                onClick={() => setTone(t.id)}
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  active
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
                ].join(" ")}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything…"
            rows={1}
            disabled={isStreaming}
            className="min-h-[40px] max-h-40 flex-1 resize-none rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-400 disabled:opacity-60"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isStreaming}
            aria-label="Send message"
          >
            {isStreaming ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </form>

        {error ? (
          <p className="mt-2 text-xs text-red-600">{error}</p>
        ) : (
          <p className="mt-2 text-[11px] leading-snug text-neutral-500">
            Disclaimer: This is my AI-powered twin. It may not be 100% accurate
            and should be verified for accuracy.
          </p>
        )}
      </div>
    </div>
  );
}

function StartScreen({
  greeting,
  onPick,
}: {
  greeting: string;
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 py-6 text-center">
      <p className="max-w-sm text-sm text-neutral-600">{greeting}</p>
      <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
        {STARTER_PROMPTS.map(({ icon: Icon, label, prompt }) => (
          <button
            key={label}
            type="button"
            onClick={() => onPick(prompt)}
            className="group flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-left text-sm transition hover:border-neutral-300 hover:bg-neutral-50"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-neutral-100 text-neutral-600 transition group-hover:bg-neutral-900 group-hover:text-white">
              <Icon className="size-4" />
            </span>
            <span className="font-medium text-neutral-800">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  isStreaming,
}: {
  role: ChatRole;
  content: string;
  isStreaming: boolean;
}) {
  const isUser = role === "user";
  return (
    <li className={["flex", isUser ? "justify-end" : "justify-start"].join(" ")}>
      <div
        className={[
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-neutral-900 text-white"
            : "bg-neutral-100 text-neutral-900",
        ].join(" ")}
      >
        {content || (isStreaming ? <TypingDots /> : null)}
        {isStreaming && content ? (
          <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-neutral-500" />
        ) : null}
      </div>
    </li>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="size-1.5 animate-bounce rounded-full bg-neutral-500 [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-neutral-500 [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-neutral-500" />
    </span>
  );
}

export default Chat;
