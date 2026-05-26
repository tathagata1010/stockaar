import { PageHeaderSkeleton, Skeleton, TableSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main>
      <PageHeaderSkeleton />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <TableSkeleton rows={5} />
        <TableSkeleton rows={5} />
      </div>
    </main>
  );
}
