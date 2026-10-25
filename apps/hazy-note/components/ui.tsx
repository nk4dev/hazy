import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variantClass: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
};

export function Button({
  variant = "secondary",
  icon,
  block,
  className = "",
  children,
  ...rest
}: {
  variant?: Variant;
  icon?: boolean;
  block?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`btn ${variantClass[variant]} ${icon ? "btn-icon" : ""} ${
        block ? "btn-block" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "secondary",
  block,
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  block?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`btn ${variantClass[variant]} ${block ? "btn-block" : ""} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Tag({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: "accent" | "neutral" | "outline";
  children: ReactNode;
  className?: string;
}) {
  return <span className={`tag tag-${tone} ${className}`}>{children}</span>;
}

export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`text-[11px] tracking-[0.1em] uppercase text-text/40 ${className}`}>
      {children}
    </div>
  );
}

/** Native radio segmented control. */
export function Seg<T extends string>({
  name,
  value,
  onChange,
  options,
  className = "",
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={`seg ${className}`}>
      {options.map((o) => (
        <label className="seg-opt" key={o.value}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
