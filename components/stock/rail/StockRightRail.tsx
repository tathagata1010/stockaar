import { Suspense } from "react";
import { CompactCorpActions } from "./CompactCorpActions";
import { CompactScorecard } from "./CompactScorecard";
import { CompactShareholding } from "./CompactShareholding";
import { GuidanceCard } from "./GuidanceCard";

function RailSkeleton() {
  return <div className="h-32 animate-pulse rounded-2xl border border-border bg-card/50" />;
}

export function StockRightRail({
  symbol,
  exchange,
}: {
  symbol: string;
  exchange: "NSE" | "BSE";
}) {
  return (
    <div className="space-y-4">
      <Suspense fallback={<RailSkeleton />}>
        <GuidanceCard symbol={symbol} />
      </Suspense>
      <Suspense fallback={<RailSkeleton />}>
        <CompactScorecard symbol={symbol} exchange={exchange} />
      </Suspense>
      <Suspense fallback={<RailSkeleton />}>
        <CompactCorpActions symbol={symbol} exchange={exchange} />
      </Suspense>
      <Suspense fallback={<RailSkeleton />}>
        <CompactShareholding symbol={symbol} />
      </Suspense>
    </div>
  );
}
