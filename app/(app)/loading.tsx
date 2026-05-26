import { PageHeaderSkeleton, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main>
      <PageHeaderSkeleton />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="mt-8 space-y-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </main>
  );
}
