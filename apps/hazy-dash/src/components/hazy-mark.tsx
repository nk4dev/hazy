export function HazyMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ filter: "drop-shadow(0 0 8px rgba(145,132,217,.5))" }}
      aria-hidden
    >
      <g>
        <polygon points="12,3 16.75,11.25 7.25,11.25" fill="#9184d9" />
        <polygon points="16.75,11.25 21.5,19.5 12,19.5" fill="#7a6cc9" />
        <polygon points="7.25,11.25 12,19.5 2.5,19.5" fill="#b5abfc" />
        <polygon
          points="7.25,11.25 16.75,11.25 12,19.5"
          fill="none"
          stroke="#9184d9"
          strokeWidth="1.1"
        />
      </g>
    </svg>
  );
}
