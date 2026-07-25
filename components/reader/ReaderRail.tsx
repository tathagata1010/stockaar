"use client";

import { AgentPanel } from "@/components/agent/AgentPanel";
import type {
  ArticleContextInput,
  InsightInput,
  RelatedNewsInput,
} from "@/components/agent/AgentPanel";
import { PanelContextProvider } from "@/components/agent/PanelContext";

export function ReaderRail({
  insight,
  contextSymbol,
  articleContext,
  relatedNews,
}: {
  insight?: InsightInput | null;
  contextSymbol?: string;
  articleContext?: ArticleContextInput;
  relatedNews?: RelatedNewsInput[];
}) {
  return (
    <div className="surface flex h-full min-h-[620px] flex-col overflow-hidden shadow-soft">
      <PanelContextProvider>
        <AgentPanel
          contextSymbol={contextSymbol}
          articleContext={articleContext}
          relatedNews={relatedNews}
          insight={insight}
        />
      </PanelContextProvider>
    </div>
  );
}
