import { PageHeaderSkeleton, TableSkeleton, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main>
      <PageHeaderSkeleton />
      <Skeleton className="mt-6 h-48" />
      <div className="mt-6">
        <TableSkeleton rows={8} />
      </div>
    </main>
  );
}
