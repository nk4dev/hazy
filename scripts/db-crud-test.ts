import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { resolveSslMode } from "../packages/db/src/connection-options";
import * as schema from "../packages/db/src/schema";
import { loadMonorepoEnv } from "./load-env";
import { maskDatabaseUrl } from "./migrate-all";

export function isLocalDatabaseUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}

function parseArgs(argv: string[]) {
  let allowRemote = false;
  let opEnv: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--allow-remote") allowRemote = true;
    else if (arg === "--op-env" && argv[i + 1]) opEnv = argv[++i];
    else if (arg.startsWith("--op-env=")) opEnv = arg.slice(9);
  }
  return { allowRemote, opEnv };
}

async function runStep(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    console.log(`  PASS  ${name} (${Date.now() - start}ms)`);
  } catch (err) {
    console.error(`  FAIL  ${name} (${Date.now() - start}ms)`);
    throw err;
  }
}

async function main() {
  const rawArgv = process.argv.slice(2);
  const { allowRemote, opEnv } = parseArgs(rawArgv);
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

  if (opEnv && !process.env.__HAZY_CRUD_TEST_OP_WRAPPED) {
    const forwarded = rawArgv.filter((a, idx) => {
      if (a === "--op-env") return false;
      if (idx > 0 && rawArgv[idx - 1] === "--op-env") return false;
      return !a.startsWith("--op-env=");
    });
    const proc = Bun.spawn(
      ["op", "run", `--env-file=${opEnv}`, "--", "bun", "scripts/db-crud-test.ts", ...forwarded],
      {
        cwd: repoRoot,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
        env: { ...process.env, __HAZY_CRUD_TEST_OP_WRAPPED: "1" },
      }
    );
    process.exit(await proc.exited);
  }

  loadMonorepoEnv(join(repoRoot, "packages/db"));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Pass --op-env .env.op or set DATABASE_URL.");
    process.exit(1);
  }

  if (!isLocalDatabaseUrl(databaseUrl) && !allowRemote) {
    console.error(
      `Refusing to run CRUD smoke test on remote DB (${maskDatabaseUrl(databaseUrl)}) without --allow-remote.`
    );
    process.exit(1);
  }

  console.log(`\n==> DB CRUD Smoke Test (${maskDatabaseUrl(databaseUrl)})`);
  const sql = postgres(databaseUrl, { max: 1, ssl: resolveSslMode(databaseUrl) });
  const db = drizzle(sql, { schema });

  const suffix = crypto.randomUUID().slice(0, 8);
  let tempUserId: string | null = null;
  let personalProfileId = "";
  let workProfileId = "";
  let workSavedUrlId = "";
  const sharedUrl = `https://example.com/hazy-smoke-${suffix}`;

  try {
    await runStep("1. Create temp user + 2 profiles (personal, work)", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({ email: `smoke-crud-${suffix}@hazy.local`, displayName: "CRUD Smoke User" })
        .returning();
      assert(user, "temp user created");
      tempUserId = user.id;

      const [personal] = await db
        .insert(schema.profiles)
        .values({ userId: user.id, slug: "personal", name: "Personal", isDefault: true, sortOrder: 0 })
        .returning();
      const [work] = await db
        .insert(schema.profiles)
        .values({ userId: user.id, slug: "work", name: "Work", isDefault: false, sortOrder: 1 })
        .returning();
      assert(personal && work, "both profiles created");
      personalProfileId = personal.id;
      workProfileId = work.id;
    });

    await runStep("2. Update & read work profile", async () => {
      const [updated] = await db
        .update(schema.profiles)
        .set({ name: "Work Updated", color: "#3b82f6", updatedAt: new Date() })
        .where(eq(schema.profiles.id, workProfileId))
        .returning();
      assert.equal(updated?.name, "Work Updated");
      assert.equal(updated?.color, "#3b82f6");
    });

    await runStep("3. Cross-profile same-URL isolation (saved_urls)", async () => {
      const uid = tempUserId!;
      const [pUrl] = await db
        .insert(schema.savedUrls)
        .values({
          userId: uid,
          profileId: personalProfileId,
          url: sharedUrl,
          normalizedUrl: sharedUrl,
          domain: "example.com",
          title: "Personal Title",
        })
        .returning();
      const [wUrl] = await db
        .insert(schema.savedUrls)
        .values({
          userId: uid,
          profileId: workProfileId,
          url: sharedUrl,
          normalizedUrl: sharedUrl,
          domain: "example.com",
          title: "Work Title",
        })
        .returning();
      assert(pUrl && wUrl && pUrl.id !== wUrl.id, "distinct rows per profile");
      workSavedUrlId = wUrl.id;

      await db
        .update(schema.savedUrls)
        .set({ title: "Work Title Edited", tags: ["work-tag"] })
        .where(eq(schema.savedUrls.id, workSavedUrlId));

      const pCheck = await db.query.savedUrls.findFirst({
        where: eq(schema.savedUrls.id, pUrl.id),
      });
      assert.equal(pCheck?.title, "Personal Title");
    });

    await runStep("4. Collections & Notes CRUD in work profile", async () => {
      const uid = tempUserId!;
      const [col] = await db
        .insert(schema.collections)
        .values({ userId: uid, profileId: workProfileId, name: "Work Docs" })
        .returning();
      assert(col);
      const [colUpd] = await db
        .update(schema.collections)
        .set({ name: "Work Docs v2" })
        .where(eq(schema.collections.id, col.id))
        .returning();
      assert.equal(colUpd?.name, "Work Docs v2");
      await db.delete(schema.collections).where(eq(schema.collections.id, col.id));

      const [note] = await db
        .insert(schema.notes)
        .values({ userId: uid, profileId: workProfileId, title: "Draft Note" })
        .returning();
      assert(note);
      await db
        .update(schema.notes)
        .set({ title: "Updated Note", status: "done" })
        .where(eq(schema.notes.id, note.id));
      await db.delete(schema.notes).where(eq(schema.notes.id, note.id));
    });

    await runStep("5. Blog connections & publications CRUD", async () => {
      const uid = tempUserId!;
      const [conn] = await db
        .insert(schema.blogConnections)
        .values({
          userId: uid,
          profileId: workProfileId,
          provider: "zenn",
          label: "Smoke Zenn",
          config: { owner: "smoke", repo: "zenn-content" },
          encryptedCredentials: "v1:dummy",
          webhookToken: `bw_smoke_${suffix}`,
        })
        .returning();
      assert(conn);

      const [pub] = await db
        .insert(schema.blogPublications)
        .values({
          userId: uid,
          profileId: workProfileId,
          connectionId: conn.id,
          savedUrlId: workSavedUrlId,
          externalId: `slug-${suffix}`,
          title: "Smoke Post",
          status: "draft",
        })
        .returning();
      assert(pub);

      const [pubUpd] = await db
        .update(schema.blogPublications)
        .set({ status: "published", publishedAt: new Date() })
        .where(eq(schema.blogPublications.id, pub.id))
        .returning();
      assert.equal(pubUpd?.status, "published");

      await db.delete(schema.blogPublications).where(eq(schema.blogPublications.id, pub.id));
      await db.delete(schema.blogConnections).where(eq(schema.blogConnections.id, conn.id));
    });

    await runStep("6. Delete work profile & verify cascade isolation", async () => {
      await db.delete(schema.profiles).where(eq(schema.profiles.id, workProfileId));
      const workUrls = await db.query.savedUrls.findMany({
        where: eq(schema.savedUrls.profileId, workProfileId),
      });
      const personalUrls = await db.query.savedUrls.findMany({
        where: and(
          eq(schema.savedUrls.userId, tempUserId!),
          eq(schema.savedUrls.profileId, personalProfileId)
        ),
      });
      assert.equal(workUrls.length, 0, "work profile data cascade-deleted");
      assert.equal(personalUrls.length, 1, "personal profile data preserved");
    });

    console.log("All DB CRUD smoke tests passed!\n");
  } finally {
    if (tempUserId) {
      await db.delete(schema.users).where(eq(schema.users.id, tempUserId));
    }
    await sql.end();
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
