function Block({ className = "" }) {
  return <div className={`skeleton-shimmer rounded-[14px] ${className}`} />;
}

export default function PageSkeleton() {
  return (
    <div>
      <Block className="h-[104px] rounded-2xl mb-6" />
      <div className="flex flex-wrap gap-4 mb-6">
        <Block className="h-[84px] flex-1 min-w-[200px]" />
        <Block className="h-[84px] flex-1 min-w-[200px]" />
        <Block className="h-[84px] flex-1 min-w-[200px]" />
      </div>
      <Block className="h-[320px]" />
    </div>
  );
}
