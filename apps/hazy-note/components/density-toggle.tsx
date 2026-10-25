"use client";

import { useEffect, useState } from "react";
import { Seg } from "./ui";

type Density = "cozy" | "compact";

const KEY = "hazy-note:density";

/** Applied pre-paint by the inline script in app/layout.tsx; this keeps it in sync. */
function apply(d: Density) {
  document.documentElement.classList.toggle("density-compact", d === "compact");
  try {
    localStorage.setItem(KEY, d);
  } catch {
    /* private mode — the class still applies for this session */
  }
}

/** 「行間を詰める」 — a cozy / compact display-density switch, persisted locally. */
export function DensityToggle() {
  const [density, setDensity] = useState<Density>("cozy");

  useEffect(() => {
    setDensity(document.documentElement.classList.contains("density-compact") ? "compact" : "cozy");
  }, []);

  return (
    <Seg
      name="density"
      value={density}
      onChange={(d) => {
        setDensity(d);
        apply(d);
      }}
      options={[
        { value: "cozy", label: "標準" },
        { value: "compact", label: "詰める" },
      ]}
    />
  );
}
