import { PageHeaderSkeleton, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main>
      <PageHeaderSkeleton />
      <div className="mt-6 grid gap-4 lg:grid-cols-[400px_1fr]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </main>
  );
}
