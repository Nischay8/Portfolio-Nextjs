import { promises as fs } from "node:fs";
import path from "node:path";

const PROMPTS_DIR = path.join(process.cwd(), "prompts");

const cache = new Map<string, string>();

async function readPrompt(fileName: string): Promise<string> {
  const cached = cache.get(fileName);
  if (cached) return cached;

  const filePath = path.join(PROMPTS_DIR, fileName);
  const content = await fs.readFile(filePath, "utf-8");
  cache.set(fileName, content);
  return content;
}

export const loadAiTwinPrompt = () => readPrompt("ai_twin_with_sanity_mcp.txt");
export const loadTopicFilterPrompt = () => readPrompt("topic_filter_prompt.txt");
export const loadGuardrailFailPrompt = () => readPrompt("guardrail_fail_agent.txt");
