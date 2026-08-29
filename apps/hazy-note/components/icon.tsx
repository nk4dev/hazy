import type { CSSProperties } from "react";

/** Phosphor icon (regular weight web font, loaded in globals.css). */
export function Icon({
  name,
  size,
  className = "",
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <i className={`ph ph-${name} ${className}`} style={{ fontSize: size, ...style }} aria-hidden />
  );
}
