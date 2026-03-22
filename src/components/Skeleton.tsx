export function Skeleton({ width = 'w-full', height = 'h-4', className = '' }: { width?: string; height?: string; className?: string }) {
  return <div className={`${width} ${height} ${className} bg-gray-200 rounded-lg animate-pulse`} />;
}

export function TimelineCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm mb-2">
      <div className="w-1 h-12 bg-gray-200 rounded animate-pulse" />
      <div className="w-8 h-8 bg-gray-200 rounded-xl animate-pulse" />
      <div className="flex-1 space-y-2">
        <Skeleton width="w-3/4" height="h-4" />
        <Skeleton width="w-1/2" height="h-3" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return <div className="rounded-2xl p-4 bg-gray-100 animate-pulse h-32" />;
}
