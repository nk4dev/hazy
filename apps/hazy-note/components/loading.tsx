/** Loading states, all using the design's motion vocabulary
 *  (`.pulse` breathing dot, `.skel` shimmer). */

/** A rotating ring for inline / button use. */
export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px] ${className}`}
    />
  );
}

/** Full-area loading: the accent "fog" dot that the capture flow uses. */
export function Loading({ label = "読み込み中" }: { label?: string }) {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 text-[13px] text-text/50">
      <span className="pulse h-[42px] w-[42px] rounded-[14px] bg-[radial-gradient(circle_at_32%_26%,var(--color-accent-400),var(--color-accent-700))] shadow-[0_0_30px_rgba(145,132,217,0.5)]" />
      {label}
    </div>
  );
}

/** A few shimmering lines — for text/document placeholders. */
export function SkeletonLines({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-[9px] ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, never reordered
          key={i}
          className="skel h-[10px]"
          style={{ width: `${[100, 82, 91, 68, 76][i % 5]}%` }}
        />
      ))}
    </div>
  );
}

/** Card-grid placeholder — matches the notes / library card layout. */
export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, never reordered
          key={i}
          className="flex flex-col gap-[10px] rounded-[10px] bg-surface p-[15px] shadow-[0_0_0_1px_var(--color-neutral-900)]"
        >
          <div className="skel h-[9px] w-[45%]" />
          <div className="skel h-[13px] w-[80%]" />
          <div className="skel h-[9px]" />
          <div className="skel h-[9px] w-[60%]" />
        </div>
      ))}
    </div>
  );
}
