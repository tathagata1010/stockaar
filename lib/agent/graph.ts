import { createReactAgent } from "@langchain/langgraph/prebuilt";

import type { ModelConfig } from "@/lib/ai/models";

import { makeLLM } from "./llm";
import { buildAgentTools } from "./tools";

// NOTE: excludeTools is intentionally IGNORED. Earlier we tried to strip tools
// whose data preflight already fetched, to save tokens. But reasoning models
// (Groq gpt-oss-120b) infer tool names from the prompt context and try to call
// them anyway — Groq then rejects with "tool call validation failed: attempted
// to call tool 'X' which was not in request.tools" and the whole turn fails.
// Keeping every tool callable lets Redis-cached preflight data dedupe repeats
// with zero API cost instead.
export function makeAgent(ctx: { userId: string | null; excludeTools?: Set<string>; modelConfig?: ModelConfig }) {
  const tools = buildAgentTools(ctx);
  return createReactAgent({
    llm: makeLLM({ config: ctx.modelConfig }),
    tools,
  });
}
