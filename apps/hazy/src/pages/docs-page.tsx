import { HazyMark } from "@repo/ui/components/hazy-mark";
import { Badge } from "@repo/ui/components/ui/badge";
import { Link } from "@/i18n/navigation";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

const METHOD_STYLES: Record<HttpMethod, string> = {
  GET: "border-primary/40 bg-primary/10 text-primary",
  POST: "border-transparent bg-primary text-primary-foreground",
  PATCH: "border-transparent bg-secondary text-secondary-foreground",
  DELETE: "border-destructive/30 bg-destructive/10 text-destructive",
};

function Method({ method }: { method: HttpMethod }) {
  return (
    <Badge variant="outline" className={`rounded font-mono text-[11px] ${METHOD_STYLES[method]}`}>
      {method}
    </Badge>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-muted/60 p-3 font-mono text-[12.5px] leading-relaxed text-foreground">
      <code>{children}</code>
    </pre>
  );
}

function Endpoint({
  id,
  method,
  path,
  status,
  children,
}: {
  id: string;
  method: HttpMethod;
  path: string;
  status?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-24 rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Method method={method} />
        <code className="font-mono text-[13px]">{path}</code>
        {status && <span className="text-[11px] text-muted-foreground">→ {status}</span>}
      </div>
      <div className="space-y-3 text-[13.5px] leading-relaxed text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12.5px] [&_code]:text-foreground [&_strong]:text-foreground">
        {children}
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <h2 className="text-xl font-medium tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

const TOC: { id: string; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "auth", label: "Authentication" },
  { id: "envelope", label: "Response envelope" },
  { id: "errors", label: "Errors" },
  { id: "models", label: "Data models" },
  { id: "items", label: "Saved items" },
  { id: "search", label: "Search" },
  { id: "read-later", label: "Read later" },
  { id: "collections", label: "Collections" },
  { id: "ask", label: "Ask (AI)" },
  { id: "me", label: "Current user" },
  { id: "versioning", label: "Versioning & rate limits" },
  { id: "i18n", label: "i18n" },
];

export function DocsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border px-6 py-3.5">
        <Link href="/library" className="flex items-center gap-2">
          <HazyMark size={20} />
          <span className="text-[17px] font-medium tracking-tight">Hazy</span>
        </Link>
        <span className="text-[13px] text-muted-foreground">API Docs</span>
        <Link href="/library" className="ml-auto text-[13px] text-primary hover:underline">
          Open app →
        </Link>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 px-6 py-10 lg:grid-cols-[200px_1fr]">
        <nav className="hidden lg:block">
          <div className="sticky top-10 space-y-1">
            {TOC.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block rounded px-2 py-1 text-[13px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-12">
          <div className="space-y-2">
            <h1 className="text-2xl font-medium tracking-tight">Hazy API</h1>
            <p className="max-w-[64ch] text-[14.5px] leading-relaxed text-muted-foreground">
              This is the public contract for{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">/api/v1/**</code>
              , the JSON API the Hazy web app itself runs on — stable enough to build any external
              client against (a smartphone app, a browser extension, a CLI) without access to this
              repository. There is no separate API-key system: external clients authenticate the
              same way the web app does, via a Clerk session token.
            </p>
          </div>

          <Section id="overview" title="Base URL">
            <Code>{`https://<deployed-host>/api/v1`}</Code>
            <p className="text-[13.5px] leading-relaxed text-muted-foreground">
              For local development,{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12.5px]">
                http://localhost:8787/v1
              </code>
              .
            </p>
          </Section>

          <Section id="auth" title="Authentication">
            <p>
              Auth is handled by <strong className="text-foreground">Clerk</strong>. There is no
              separate Hazy login system.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Attach the session token to every request:
                <Code>{`Authorization: Bearer <clerk_session_token>`}</Code>
              </li>
              <li>
                <strong className="text-foreground">First-request user sync</strong> — the backend
                lazily creates its internal <code>users</code> row (and default preferences) the
                first time an authenticated request reaches any endpoint.
              </li>
            </ul>
          </Section>

          <Section id="envelope" title="Response envelope">
            <p>
              <strong className="text-foreground">Success:</strong>
            </p>
            <Code>{`{ "data": { /* endpoint-specific payload */ } }`}</Code>
            <p>
              <strong className="text-foreground">Failure:</strong>
            </p>
            <Code>{`{ "error": { "code": "string_error_code", "message": "Human-readable message.", "details": {} } }`}</Code>
          </Section>

          <Section id="errors" title="Errors">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-[13.5px]">
                <thead>
                  <tr className="border-b border-border text-[12px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">error.code</th>
                    <th className="py-2 font-medium">Meaning</th>
                  </tr>
                </thead>
                <tbody className="[&_td]:py-2 [&_td]:pr-4 [&_td]:align-top [&_tr]:border-b [&_tr]:border-border/60">
                  <tr>
                    <td>400</td>
                    <td>
                      <code>validation_error</code>
                    </td>
                    <td>Request body/query failed validation.</td>
                  </tr>
                  <tr>
                    <td>401</td>
                    <td>
                      <code>unauthorized</code>
                    </td>
                    <td>Missing/invalid/expired Clerk session.</td>
                  </tr>
                  <tr>
                    <td>404</td>
                    <td>
                      <code>not_found</code>
                    </td>
                    <td>Resource doesn&apos;t exist or isn&apos;t owned by the caller.</td>
                  </tr>
                  <tr>
                    <td>503</td>
                    <td>
                      <code>service_not_configured</code>
                    </td>
                    <td>Required backend service isn&apos;t configured server-side.</td>
                  </tr>
                  <tr>
                    <td>500</td>
                    <td>
                      <code>internal_error</code>
                    </td>
                    <td>Unhandled server error.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="models" title="Data models">
            <Code>{`type SavedUrlDTO = {
  id: string;
  url: string;
  domain: string | null;
  title: string | null;
  description: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  summary: string | null;
  contentLanguage: string | null;
  estimatedReadMinutes: number | null;
  fetchStatus: "pending" | "success" | "error";
  fetchError: string | null;
  createdAt: string;
  updatedAt: string;
  readLaterStatus: "inbox" | "snoozed" | "read" | "archived" | null;
};`}</Code>
          </Section>

          <Section id="items" title="Saved items">
            <Endpoint id="items-post" method="POST" path="/items" status="200 or 201">
              <Code>{`{ "url": string }`}</Code>
            </Endpoint>
            <Endpoint id="items-list" method="GET" path="/items?cursor=&limit=&sort=">
              <p>
                Returns <code>PaginatedResponse&lt;SavedUrlDTO&gt;</code>.
              </p>
            </Endpoint>
          </Section>

          <Section id="search" title="Search">
            <Endpoint id="search-get" method="GET" path="/search?q=&limit=">
              <p>
                Returns <code>{`{ "query": string, "items": SavedUrlDTO[] }`}</code>.
              </p>
            </Endpoint>
          </Section>

          <Section id="read-later" title="Read later">
            <Endpoint id="read-later-get" method="GET" path="/read-later">
              <p>Buckets the user&apos;s inbox items by estimated reading time.</p>
            </Endpoint>
          </Section>

          <Section id="collections" title="Collections">
            <Endpoint id="collections-list" method="GET" path="/collections">
              <p>
                Returns <code>{`{ "items": CollectionDTO[] }`}</code>.
              </p>
            </Endpoint>
          </Section>

          <Section id="ask" title="Ask (AI)">
            <Endpoint id="ask-post" method="POST" path="/ask" status="201">
              <Code>{`{ "question": string, "answerLanguageOverride"?: "en" | "ja" }`}</Code>
            </Endpoint>
          </Section>

          <Section id="me" title="Current user / preferences">
            <Endpoint id="me-get" method="GET" path="/me">
              <p>Returns current user profile and preferences.</p>
            </Endpoint>
          </Section>

          <Section id="versioning" title="Versioning & rate limits">
            <p>Versioned under <code>/v1</code>.</p>
          </Section>

          <Section id="i18n" title="i18n">
            <p>Supports <code>en</code> and <code>ja</code> locales.</p>
          </Section>
        </div>
      </div>
    </div>
  );
}
