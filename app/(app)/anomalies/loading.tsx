import { PageHeaderSkeleton, TableSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main>
      <PageHeaderSkeleton />
      <div className="mt-8 space-y-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i}>
            <div className="mb-3 h-5 w-56 animate-pulse rounded bg-border/50" />
            <TableSkeleton rows={4} />
          </div>
        ))}
      </div>
    </main>
  );
}
