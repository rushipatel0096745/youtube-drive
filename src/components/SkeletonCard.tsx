export function SkeletonCard() {
  return (
    <div className="flex flex-col animate-pulse">
      <div
        className="aspect-video w-full rounded-xl"
        style={{ backgroundColor: "var(--c-card)" }}
      />
      <div className="mt-2.5 flex gap-3">
        <div
          className="w-9 h-9 rounded-full shrink-0"
          style={{ backgroundColor: "var(--c-card)" }}
        />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 rounded-full w-full" style={{ backgroundColor: "var(--c-card)" }} />
          <div className="h-3 rounded-full w-3/4" style={{ backgroundColor: "var(--c-card)" }} />
          <div className="h-2.5 rounded-full w-1/2" style={{ backgroundColor: "var(--c-card)" }} />
        </div>
      </div>
    </div>
  );
}
