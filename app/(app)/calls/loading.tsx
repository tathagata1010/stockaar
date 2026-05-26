import { PageHeaderSkeleton, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main>
      <PageHeaderSkeleton />
      <Skeleton className="mt-4 h-20" />
      <div className="mt-6 flex gap-2">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-20" />)}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
      </div>
    </main>
  );
}
