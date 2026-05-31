export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div 
      className={`skeleton ${className || ''}`} 
      style={{ 
        background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-loading 1.5s infinite linear',
        borderRadius: 4,
        minHeight: '1em',
        ...style 
      }} 
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="grid gap-12">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-12 p-12 border-b">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} style={{ flex: 1, height: 20 }} />
          ))}
        </div>
      ))}
    </div>
  );
}
