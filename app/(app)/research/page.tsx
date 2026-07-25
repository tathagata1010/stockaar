import { Disclaimer } from "@/components/Disclaimer";
import { AgentPanel } from "@/components/agent/AgentPanel";

export const dynamic = "force-dynamic";

export default function ResearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Research Agent</h1>
        <p className="mt-1 text-sm text-slate-400">
          Ask about any Indian stock. Pulls fresh news, filings, guidance, FII/DII flows,
          fundamentals, and peer comps — with citations.
        </p>
      </div>
      <AgentPanel />
      <Disclaimer />
    </div>
  );
}
