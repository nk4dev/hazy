"use client";

import { useState } from "react";
import { Globe } from "lucide-react";

export function Favicon({
  src,
  domain,
  size = 18,
}: {
  src: string | null;
  domain: string | null;
  size?: number;
}) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded bg-secondary text-muted-foreground"
        style={{ width: size + 2, height: size + 2 }}
        title={domain ?? undefined}
      >
        <Globe style={{ width: size * 0.6, height: size * 0.6 }} />
      </div>
    );
  }

  return (
    // Arbitrary external favicons at unknown, tiny sizes aren't worth
    // next/image's overhead here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded"
      onError={() => setErrored(true)}
    />
  );
}
