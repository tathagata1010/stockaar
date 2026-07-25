import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";

import { trip } from "@/lib/ai/circuit-breaker";
import { modelId } from "@/lib/ai/models";

import { makeAgent } from "./graph";
import { pickAgentModel } from "./llm";
import { buildSystemMessage, type ArticleContext } from "./prompt";
import { runPreflight, formatBundleForLLM, type PreflightEvent } from "./preflight";
import { pickPreflightKinds, PREFLIGHT_KIND_TOOL } from "./route";
import { ACTION_EXECUTED_KEY, ACTION_PROPOSED_KEY } from "./tools";
import type { TurnRecorder } from "@/lib/ai/response-cache";

type StreamOpts = {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  contextSymbol?: string;
  articleContext?: ArticleContext;
  planTier: "free" | "pro";
  userId: string | null;
  recorder?: TurnRecorder;
};

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function istNow(): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

// LangChain wraps tool return values into a ToolMessage whose `.content` is a
// stringified JSON. Unwrap once to reach the actual payload — the raw object
// is not on the outer shape.
function unwrapToolContent(output: unknown): string | null {
  if (output == null) return null;
  if (typeof output === "string") return output;
  if (typeof output !== "object") return null;
  const anyOut = output as { content?: unknown; kwargs?: { content?: unknown } };
  if (typeof anyOut.content === "string") return anyOut.content;
  if (typeof anyOut.kwargs?.content === "string") return anyOut.kwargs.content;
  return null;
}

// Preview string surfaced to the UI as a tool_end payload. Falls back to a
// JSON.stringify of the outer object when no ToolMessage content is found.
function toolPreview(raw: string | null, output: unknown): string {
  if (raw != null) return raw.slice(0, 400);
  try {
    return JSON.stringify(output).slice(0, 400);
  } catch {
    return String(output).slice(0, 400);
  }
}

function extractAction(raw: string | null): { event: "action_executed" | "action_proposed"; payload: unknown } | null {
  if (!raw) return null;
  // Fast path — skip JSON.parse on every read tool result (99% of tool calls).
  if (!raw.includes(ACTION_EXECUTED_KEY) && !raw.includes(ACTION_PROPOSED_KEY)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed == null || typeof parsed !== "object") return null;
  const rec = parsed as Record<string, unknown>;
  if (rec[ACTION_EXECUTED_KEY]) {
    return { event: "action_executed", payload: rec[ACTION_EXECUTED_KEY] };
  }
  if (rec[ACTION_PROPOSED_KEY]) {
    return { event: "action_proposed", payload: rec[ACTION_PROPOSED_KEY] };
  }
  return null;
}

export function streamAgent(opts: StreamOpts): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const ist = istNow();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 8000);

      const emit = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseFrame(event, data)));
        opts.recorder?.push(event, data);
      };

      try {
        // Phase 1 — preflight. When we have a context symbol, we deterministically
        // fetch the standard signal bundle (quote, fundamentals, news, guidance,
        // flows, peers, technicals, scorecard) IN PARALLEL and inject it as a
        // system-context block before the LLM sees the question. This guarantees
        // fresh data and kills the "1 tool empty → hallucinate the template"
        // failure mode. The UI sees each fetch as a tool_start / tool_end pair
        // so users can watch the agent working.
        let preflightBlock = "";
        const excludeTools = new Set<string>();
        if (opts.contextSymbol) {
          const kinds = pickPreflightKinds(opts.message);
          for (const k of kinds) excludeTools.add(PREFLIGHT_KIND_TOOL[k]);
          emit("phase", { name: "preflight", message: `Fetching fresh signal for ${opts.contextSymbol}…` });
          const onPreflightEvent = (ev: PreflightEvent) => {
            if (ev.kind === "start") {
              emit("tool_start", { name: ev.name, args: ev.args });
            } else {
              emit("tool_end", { name: ev.name, preview: ev.preview });
            }
          };
          const bundle = await runPreflight(opts.contextSymbol, ist, onPreflightEvent, kinds);
          preflightBlock = formatBundleForLLM(bundle);
        }

        // Phase 2 — LLM. Pick a model whose CB is closed (walks the fallback
        // chain if the primary is tripped).
        const agentCfg = await pickAgentModel("agent");
        emit("phase", { name: "thinking", message: "Reasoning & exploring the web…" });

        const system = buildSystemMessage({
          ist,
          contextSymbol: opts.contextSymbol,
          planTier: opts.planTier,
          articleContext: opts.articleContext,
        });

        const articleBlock = opts.articleContext
          ? new SystemMessage(
              `Article the user is currently reading:\nTitle: ${opts.articleContext.title}\nPublisher: ${opts.articleContext.publisher ?? "unknown"}\nURL: ${opts.articleContext.url}\n\n${opts.articleContext.body}`,
            )
          : null;

        const messages = [
          system,
          ...(articleBlock ? [articleBlock] : []),
          ...(preflightBlock ? [new SystemMessage(preflightBlock)] : []),
          ...(opts.history ?? []).map((m) =>
            m.role === "user"
              ? new HumanMessage(m.content)
              : new AIMessage(m.content.slice(0, 4000)),
          ),
          new HumanMessage(opts.message),
        ];

        const agent = makeAgent({ userId: opts.userId, excludeTools, modelConfig: agentCfg });
        const events = agent.streamEvents(
          { messages },
          { version: "v2", recursionLimit: 12 },
        );

        try {
          for await (const ev of events) {
            if (ev.event === "on_chat_model_stream") {
              const chunk = ev.data?.chunk;
              const text =
                typeof chunk?.content === "string"
                  ? chunk.content
                  : Array.isArray(chunk?.content)
                    ? chunk.content
                        .map((c: { text?: string }) => c.text ?? "")
                        .join("")
                    : "";
              if (text) emit("delta", { text });
            } else if (ev.event === "on_tool_start") {
              emit("tool_start", { name: ev.name, args: ev.data?.input });
            } else if (ev.event === "on_tool_end") {
              const output = ev.data?.output;
              const raw = unwrapToolContent(output);
              const action = extractAction(raw);
              if (action) {
                emit(action.event, action.payload);
                // Write-action turns must never be cached — the response
                // describes a mutation that already happened and replaying it
                // would misrepresent state on subsequent asks.
                if (action.event === "action_executed") opts.recorder?.poison();
              }
              emit("tool_end", { name: ev.name, preview: toolPreview(raw, output) });
            }
          }
        } catch (streamErr) {
          // Mid-stream provider failure. If it looks like 429, trip the CB so
          // the user's retry routes to the next model. LangChain can't swap
          // providers mid-turn, so we surface an error frame and let the
          // client re-ask.
          const msg = streamErr instanceof Error ? streamErr.message : String(streamErr);
          if (/\b429\b|rate.?limit|too many|tpm|rpm/i.test(msg)) {
            await trip(modelId(agentCfg));
          }
          throw streamErr;
        }

        emit("done", { ok: true });
        opts.recorder?.finalize();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        emit("error", { message: msg });
        opts.recorder?.poison();
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });
}
