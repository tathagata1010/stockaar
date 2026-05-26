import { PageHeaderSkeleton, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main>
      <Skeleton className="h-4 w-32" />
      <div className="mt-4 flex justify-between gap-4">
        <div className="flex-1">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-64" />
          <Skeleton className="mt-4 h-12 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <Skeleton className="mt-8 h-80" />
      <Skeleton className="mt-6 h-40" />
      <Skeleton className="mt-6 h-32" />
      <Skeleton className="mt-6 h-48" />
    </main>
  );
}
