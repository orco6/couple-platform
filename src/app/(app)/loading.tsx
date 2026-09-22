import { Skeleton, LoadingState } from '@/core/ui/components/States';

export default function Loading() {
  return (
    <div>
      <Skeleton className="mb-2 h-7 w-40" />
      <Skeleton className="mb-8 h-4 w-64" />
      <LoadingState rows={6} />
    </div>
  );
}
