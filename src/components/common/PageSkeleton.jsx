function Block({ className = "" }) {
  return <div className={`skeleton-shimmer rounded-[14px] ${className}`} />;
}

function CardsSkeleton() {
  return (
    <>
      <div className="flex flex-wrap gap-4 mb-6">
        <Block className="h-[84px] flex-1 min-w-[200px]" />
        <Block className="h-[84px] flex-1 min-w-[200px]" />
        <Block className="h-[84px] flex-1 min-w-[200px]" />
      </div>
      <Block className="h-[320px]" />
    </>
  );
}

function TableSkeleton() {
  return (
    <>
      <Block className="h-10 w-[360px] mb-4" />
      <Block className="h-[420px]" />
    </>
  );
}

export default function PageSkeleton({ variant = "cards" }) {
  return (
    <div>
      <div className="skeleton-shimmer-header rounded-2xl h-[104px] mb-6" />
      {variant === "table" ? <TableSkeleton /> : <CardsSkeleton />}
    </div>
  );
}
