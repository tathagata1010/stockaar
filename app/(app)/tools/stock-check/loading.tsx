import { PageHeaderSkeleton, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main>
      <PageHeaderSkeleton />
      <Skeleton className="mt-6 h-14" />
      <Skeleton className="mt-6 h-80" />
    </main>
  );
}
