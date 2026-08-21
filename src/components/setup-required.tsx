import type { CoreService } from "@/lib/env";

const SERVICE_INFO: Record<CoreService, { label: string; vars: string[]; signupUrl: string }> = {
  database: {
    label: "Postgres database (any provider — Neon is a free option)",
    vars: ["DATABASE_URL"],
    signupUrl: "https://neon.tech",
  },
  clerk: {
    label: "Clerk (authentication)",
    vars: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"],
    signupUrl: "https://clerk.com",
  },
};

export function SetupRequired({
  missing,
  title,
  description,
  restartHint,
}: {
  missing: CoreService[];
  title: string;
  description: string;
  restartHint: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-lg bg-card p-8 shadow-[var(--shadow-lg,0_0_0_1px_var(--border))]">
        <h1 className="mb-2 text-2xl font-medium text-foreground">{title}</h1>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{description}</p>
        <ul className="mb-6 flex flex-col gap-4">
          {missing.map((service) => {
            const info = SERVICE_INFO[service];
            return (
              <li key={service} className="rounded-md bg-secondary p-4 text-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{info.label}</span>
                  <a
                    href={info.signupUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    {info.signupUrl.replace("https://", "")}
                  </a>
                </div>
                <div className="flex flex-col gap-1">
                  {info.vars.map((v) => (
                    <code
                      key={v}
                      className="rounded bg-background px-2 py-1 font-mono text-xs text-muted-foreground"
                    >
                      {v}
                    </code>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">{restartHint}</p>
      </div>
    </div>
  );
}
