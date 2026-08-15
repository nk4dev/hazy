import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { HazyMark } from "@/components/hazy-mark";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "API Docs — Hazy",
  description: "Public API reference for building external clients (mobile apps, extensions, etc.) against Hazy.",
};

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

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
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

export default function ApiDocsPage() {
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
              This is the public contract for <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">/api/v1/**</code>,
              the JSON API the Hazy web app itself runs on — stable enough to build any external
              client against (a smartphone app, a browser extension, a CLI) without access to this
              repository. There is no separate API-key system: external clients authenticate the same
              way the web app does, via a Clerk session token. A Markdown copy of this same reference
              lives at <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">docs/api.md</code> in the repo.
            </p>
          </div>

          <Section id="overview" title="Base URL">
            <Code>{`https://<deployed-host>/api/v1`}</Code>
            <p className="text-[13.5px] leading-relaxed text-muted-foreground">
              For local development,{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12.5px]">http://localhost:3000/api/v1</code>{" "}
              (use <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12.5px]">10.0.2.2</code> in place of{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12.5px]">localhost</code> from an Android
              emulator; a physical device needs the host machine&apos;s LAN IP).
            </p>
          </Section>

          <Section id="auth" title="Authentication">
            <p>
              Auth is handled by <strong className="text-foreground">Clerk</strong>. There is no
              separate Hazy login system.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Sign in via any Clerk client SDK (web, iOS, Android, Flutter, React Native, ...) for
                the same Clerk instance this deployment uses. Ask the operator for the Clerk{" "}
                <strong className="text-foreground">publishable key</strong>.
              </li>
              <li>
                Attach the resulting session token to every request:
                <Code>{`Authorization: Bearer <clerk_session_token>`}</Code>
              </li>
              <li>
                <strong className="text-foreground">First-request user sync</strong> — the backend
                lazily creates its internal <code>users</code> row (and default preferences) the
                first time an authenticated request reaches any endpoint. There is no separate
                &quot;register&quot; call.
              </li>
              <li>
                The entire <code>/api/v1/**</code> surface (aside from the Clerk webhook, see below)
                requires a signed-in session. A request without a valid token gets{" "}
                <code>401 unauthorized</code>.
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
            <p>
              <code>details</code> is optional. Always branch on the presence of <code>data</code> vs{" "}
              <code>error</code> in the body — status codes are also meaningful (see Errors), but the
              body shape is the source of truth.
            </p>
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
                    <td>
                      Request body/query failed validation (<code>details</code> has Zod&apos;s
                      flattened field errors), or a route-specific bad-state check — see the note on{" "}
                      <a href="#ask" className="text-primary hover:underline">
                        follow-up Ask messages
                      </a>{" "}
                      below for an example of the latter.
                    </td>
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
                    <td>
                      Resource doesn&apos;t exist, or exists but isn&apos;t owned by the caller — the
                      API never distinguishes the two.
                    </td>
                  </tr>
                  <tr>
                    <td>503</td>
                    <td>
                      <code>service_not_configured</code>
                    </td>
                    <td>
                      A required backend service isn&apos;t configured server-side (database, or the
                      AI provider for AI-only endpoints). Not something the client can fix.
                    </td>
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
            <p>
              Exact TypeScript DTOs the backend returns. A few endpoints intentionally return a raw
              database row instead of one of these DTOs — called out explicitly where that&apos;s the
              case.
            </p>
            <Code>{`type SavedUrlDTO = {
  id: string;                    // uuid
  url: string;
  domain: string | null;
  title: string | null;
  description: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  summary: string | null;        // AI-written summary, if generated
  contentLanguage: string | null;
  estimatedReadMinutes: number | null;
  fetchStatus: "pending" | "success" | "error";
  fetchError: string | null;
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
  readLaterStatus: "inbox" | "snoozed" | "read" | "archived" | null;
};

type PaginatedResponse<T> = {
  items: T[];
  nextCursor: string | null;     // pass back as ?cursor= to page forward
};

type CollectionDTO = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  itemCount: number;
  createdAt: string;
};

type AskCitationDTO = {
  savedUrlId: string;
  title: string | null;
  domain: string | null;
  url: string;
  faviconUrl: string | null;
  snippet: string;
  rank: number;                  // 1-based citation order
};

type AskMessageDTO = {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelId: string | null;
  usedFallback: boolean;
  createdAt: string;
  citations?: AskCitationDTO[];
};

type AskThreadDTO = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type AskResponseDTO = {
  thread: AskThreadDTO;
  message: AskMessageDTO;
  citations: AskCitationDTO[];
  meta: { sourceCount: number };
};`}</Code>
          </Section>

          <Section id="items" title="Saved items">
            <Endpoint id="items-post" method="POST" path="/items" status="200 (already saved) or 201 (new)">
              <p>
                Save a new URL (fetches metadata server-side; ~8s timeout, show a loading state).
                Idempotent — dedupes by normalized URL.
              </p>
              <Code>{`{ "url": string }`}</Code>
              <p>Returns <code>SavedUrlDTO</code>.</p>
            </Endpoint>
            <Endpoint id="items-list" method="GET" path="/items?cursor=&limit=&sort=">
              <p>
                Paginated list of saved items. Query (all optional): <code>cursor</code> (uuid, from
                the previous page&apos;s <code>nextCursor</code>), <code>limit</code> (1–100, default
                30), <code>sort</code> (<code>&quot;newest&quot; | &quot;oldest&quot;</code>, default
                &quot;newest&quot;).
              </p>
              <p>
                Returns <code>PaginatedResponse&lt;SavedUrlDTO&gt;</code>.
              </p>
            </Endpoint>
            <Endpoint id="items-get" method="GET" path="/items/:id">
              <p>
                Returns <code>SavedUrlDTO</code>.
              </p>
            </Endpoint>
            <Endpoint id="items-patch" method="PATCH" path="/items/:id">
              <p>Edit title/summary. Body (all optional):</p>
              <Code>{`{ "title"?: string | null,   // ≤500 chars
  "summary"?: string | null } // ≤4000 chars`}</Code>
              <p>Returns updated <code>SavedUrlDTO</code>.</p>
            </Endpoint>
            <Endpoint id="items-delete" method="DELETE" path="/items/:id">
              <p>
                Returns <code>{`{ "id": string }`}</code>.
              </p>
            </Endpoint>
            <Endpoint id="items-refetch" method="POST" path="/items/:id/refetch">
              <p>
                Re-fetch metadata for an already-saved URL (e.g. a &quot;retry&quot; button after{" "}
                <code>fetchStatus: &quot;error&quot;</code>). No body.
              </p>
              <p>Returns updated <code>SavedUrlDTO</code>.</p>
            </Endpoint>
            <Endpoint id="items-summarize" method="POST" path="/items/:id/summarize">
              <p>
                (Re)generate the AI summary. No body. Fails <code>503 service_not_configured</code> if
                no AI key is set server-side — unlike Ask, there&apos;s no non-AI fallback for this
                one.
              </p>
              <p>Returns updated <code>SavedUrlDTO</code>.</p>
            </Endpoint>
          </Section>

          <Section id="search" title="Search">
            <Endpoint id="search-get" method="GET" path="/search?q=&limit=">
              <p>
                Plain Postgres full-text keyword search over the caller&apos;s saved items. Works even
                with no AI configured. Query: <code>q</code> (required, non-empty),{" "}
                <code>limit</code> (1–50, default 20).
              </p>
              <p>
                Returns <code>{`{ "query": string, "items": SavedUrlDTO[] }`}</code>.
              </p>
            </Endpoint>
          </Section>

          <Section id="read-later" title="Read later">
            <p>
              Buckets the user&apos;s inbox items by estimated reading time, for a &quot;what can I
              read right now&quot; view.
            </p>
            <Endpoint id="read-later-get" method="GET" path="/read-later">
              <Code>{`{
  totalCount: number;
  totalMinutes: number;
  todaysThreeMinutes: number;
  todaysThree: SavedUrlDTO[];
  fiveMinutes: SavedUrlDTO[];
  sitDown: SavedUrlDTO[];
}`}</Code>
            </Endpoint>
            <Endpoint id="read-later-patch" method="PATCH" path="/read-later/:itemId">
              <p>
                Change an item&apos;s read-later status (<code>itemId</code> is a{" "}
                <code>savedUrls.id</code>).
              </p>
              <Code>{`{ "status": "inbox" | "snoozed" | "read" | "archived",
  "snoozedUntil"?: string /* ISO 8601 */ }`}</Code>
              <p>
                <strong className="text-foreground">Returns the raw read_later_state row</strong>, not
                a <code>SavedUrlDTO</code>:
              </p>
              <Code>{`{
  id: string; userId: string; savedUrlId: string;
  status: "inbox" | "snoozed" | "read" | "archived";
  snoozedUntil: string | null; markedReadAt: string | null;
  createdAt: string; updatedAt: string;
}`}</Code>
            </Endpoint>
            <Endpoint id="read-later-stats" method="GET" path="/read-later/stats">
              <p>7-day reading activity, for a small chart.</p>
              <Code>{`{
  days: { count: number; heightPct: number }[]; // 7 entries, oldest→newest
  readThisWeek: number;
  savedThisWeek: number;
}`}</Code>
            </Endpoint>
          </Section>

          <Section id="collections" title="Collections">
            <Endpoint id="collections-list" method="GET" path="/collections">
              <p>
                Returns <code>{`{ "items": CollectionDTO[] }`}</code>.
              </p>
            </Endpoint>
            <Endpoint id="collections-post" method="POST" path="/collections" status="201">
              <Code>{`{ "name": string,          // 1-255 chars
  "description"?: string, // ≤1000 chars
  "color"?: string }      // ≤32 chars`}</Code>
              <p>
                Returns <code>CollectionDTO</code>.
              </p>
            </Endpoint>
            <Endpoint id="collections-get" method="GET" path="/collections/:id">
              <p>
                A collection with its items (custom shape, not <code>CollectionDTO</code> — has{" "}
                <code>items</code> instead of <code>itemCount</code>):
              </p>
              <Code>{`{ id: string; name: string; description: string | null; color: string | null; items: SavedUrlDTO[] }`}</Code>
            </Endpoint>
            <Endpoint id="collections-patch" method="PATCH" path="/collections/:id">
              <Code>{`{ "name"?: string, "description"?: string | null, "color"?: string | null }`}</Code>
              <p>
                <strong className="text-foreground">Returns the raw collections row</strong> (no{" "}
                <code>itemCount</code> field, unlike <code>CollectionDTO</code>).
              </p>
            </Endpoint>
            <Endpoint id="collections-delete" method="DELETE" path="/collections/:id">
              <p>
                Items themselves are not deleted, only the collection. Returns{" "}
                <code>{`{ "id": string }`}</code>.
              </p>
            </Endpoint>
            <Endpoint id="collections-items-add" method="POST" path="/collections/:id/items" status="201">
              <p>Idempotent (adding the same item twice is a no-op).</p>
              <Code>{`{ "savedUrlId": string /* uuid */ }`}</Code>
              <p>
                Returns <code>{`{ "collectionId": string, "savedUrlId": string }`}</code>.
              </p>
            </Endpoint>
            <Endpoint id="collections-items-remove" method="DELETE" path="/collections/:id/items/:savedUrlId">
              <p>
                Returns <code>{`{ "collectionId": string, "savedUrlId": string }`}</code>.
              </p>
            </Endpoint>
          </Section>

          <Section id="ask" title="Ask (AI, citing the user's own saved items)">
            <Endpoint id="ask-post" method="POST" path="/ask" status="201">
              <p>Start a new thread with a question.</p>
              <Code>{`{ "question": string,   // 1-2000 chars
  "answerLanguageOverride"?: "en" | "ja" }`}</Code>
              <p>
                Returns <code>AskResponseDTO</code>. If AI isn&apos;t configured, or the AI call fails
                for any reason, this <strong className="text-foreground">does not error</strong> — it
                succeeds with <code>message.usedFallback: true</code> and plain keyword-match content
                instead of a synthesized answer.
              </p>
              <p>
                The model answers by searching the user&apos;s saved links itself (possibly several
                times per question), so:
              </p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  Latency is higher and more variable than a single LLM call — expect several seconds,
                  and show a real loading/thinking state.
                </li>
                <li>
                  <code>citations</code> is a variable-length list, not a small fixed count —
                  don&apos;t design the UI around a small number of chips.
                </li>
                <li>
                  <code>usedFallback: false</code> with empty <code>citations</code> is valid (the
                  model answered without needing, or without finding, a saved source).
                </li>
              </ul>
            </Endpoint>
            <Endpoint id="ask-threads-list" method="GET" path="/ask/threads">
              <p>
                The caller&apos;s threads, most recently updated first, capped at 50. Returns{" "}
                <code>{`{ "items": AskThreadDTO[] }`}</code>.
              </p>
            </Endpoint>
            <Endpoint id="ask-threads-get" method="GET" path="/ask/threads/:id">
              <p>A thread with its full message history.</p>
              <Code>{`{ thread: AskThreadDTO; messages: (AskMessageDTO & { citations: AskCitationDTO[] })[] }`}</Code>
            </Endpoint>
            <Endpoint id="ask-threads-delete" method="DELETE" path="/ask/threads/:id">
              <p>
                Returns <code>{`{ "id": string }`}</code>.
              </p>
            </Endpoint>
            <Endpoint id="ask-threads-messages" method="POST" path="/ask/threads/:id/messages" status="201">
              <p>
                Ask a follow-up in an existing thread. Body: same as <code>POST /ask</code>. Returns{" "}
                <code>AskResponseDTO</code>.
              </p>
              <p>
                If <code>:id</code> doesn&apos;t exist or isn&apos;t owned by the caller, this fails{" "}
                <strong className="text-foreground">400 validation_error</strong> (&quot;Thread not
                found&quot;) — not 404 like every other resource lookup in this API. Handle that case
                specifically if you route errors by status code.
              </p>
            </Endpoint>
          </Section>

          <Section id="me" title="Current user / preferences">
            <Endpoint id="me-get" method="GET" path="/me">
              <Code>{`{
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  preferences: {
    interfaceLocale: "en" | "ja";
    answerLanguageMode: "interface" | "source"; // "source" = answer in the saved page's language
    notifyReadLaterDigest: boolean;
    notifyWeeklyStats: boolean;
  };
}`}</Code>
            </Endpoint>
            <Endpoint id="me-patch" method="PATCH" path="/me">
              <p>Update preferences (not profile fields — those come from Clerk). Body (all optional):</p>
              <Code>{`{ "interfaceLocale"?: "en" | "ja",
  "answerLanguageMode"?: "interface" | "source",
  "notifyReadLaterDigest"?: boolean,
  "notifyWeeklyStats"?: boolean }`}</Code>
              <p>Returns the raw updated <code>user_preferences</code> row.</p>
            </Endpoint>
            <p className="text-[13px] text-muted-foreground">
              <code>POST /webhooks/clerk</code> is a server-to-server webhook Clerk calls directly —
              plain-text responses, no session token, not something any client app calls. Not
              documented here.
            </p>
          </Section>

          <Section id="versioning" title="Versioning & rate limits">
            <p>
              The API is unversioned beyond the <code>/v1</code> path prefix — there&apos;s no
              deprecation policy or version negotiation yet, and no rate limiting is currently
              enforced server-side. Both are worth revisiting before opening this up to untrusted
              third-party developers; as it stands, this contract is meant for clients the operator
              controls (their own mobile app, browser extension, etc.), not arbitrary external
              integrators.
            </p>
          </Section>

          <Section id="i18n" title="i18n">
            <p>
              The backend is locale-aware via <code>preferences.interfaceLocale</code> (
              <code>en</code> | <code>ja</code>) and <code>answerLanguageMode</code>. A client should:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Let the user pick a UI language independent of the device&apos;s system locale,
                matching the two supported values.
              </li>
              <li>
                Persist the choice via <code>PATCH /me</code> (<code>interfaceLocale</code>), not just
                locally, so it&apos;s consistent across every client the same user uses.
              </li>
              <li>
                Pass <code>answerLanguageOverride</code> on <code>/ask</code> calls only when the user
                explicitly overrides the answer language for that one question; otherwise omit it and
                let the backend use <code>answerLanguageMode</code>.
              </li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
