CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"icon" varchar(32),
	"color" varchar(32),
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_user_slug_unique" UNIQUE("user_id","slug")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "profiles_user_id_idx" ON "profiles" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_user_default_unique" ON "profiles" USING btree ("user_id") WHERE "is_default" = true;
--> statement-breakpoint
ALTER TABLE "saved_urls" ADD COLUMN "profile_id" uuid;
--> statement-breakpoint
ALTER TABLE "read_later_state" ADD COLUMN "profile_id" uuid;
--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "profile_id" uuid;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "profile_id" uuid;
--> statement-breakpoint
ALTER TABLE "ask_threads" ADD COLUMN "profile_id" uuid;
--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "profile_id" uuid;
--> statement-breakpoint
ALTER TABLE "insight_profiles" ADD COLUMN "profile_id" uuid;
--> statement-breakpoint
ALTER TABLE "connect_codes" ADD COLUMN "profile_id" uuid;
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "profile_id" uuid;
--> statement-breakpoint
INSERT INTO "profiles" ("user_id", "slug", "name", "is_default", "sort_order")
SELECT "id", 'personal', 'Personal', true, 0 FROM "users"
ON CONFLICT ("user_id", "slug") DO NOTHING;
--> statement-breakpoint
UPDATE "saved_urls" t SET "profile_id" = p."id" FROM "profiles" p WHERE p."user_id" = t."user_id" AND p."is_default" = true AND t."profile_id" IS NULL;
--> statement-breakpoint
UPDATE "read_later_state" t SET "profile_id" = p."id" FROM "profiles" p WHERE p."user_id" = t."user_id" AND p."is_default" = true AND t."profile_id" IS NULL;
--> statement-breakpoint
UPDATE "collections" t SET "profile_id" = p."id" FROM "profiles" p WHERE p."user_id" = t."user_id" AND p."is_default" = true AND t."profile_id" IS NULL;
--> statement-breakpoint
UPDATE "projects" t SET "profile_id" = p."id" FROM "profiles" p WHERE p."user_id" = t."user_id" AND p."is_default" = true AND t."profile_id" IS NULL;
--> statement-breakpoint
UPDATE "ask_threads" t SET "profile_id" = p."id" FROM "profiles" p WHERE p."user_id" = t."user_id" AND p."is_default" = true AND t."profile_id" IS NULL;
--> statement-breakpoint
UPDATE "notes" t SET "profile_id" = p."id" FROM "profiles" p WHERE p."user_id" = t."user_id" AND p."is_default" = true AND t."profile_id" IS NULL;
--> statement-breakpoint
UPDATE "insight_profiles" t SET "profile_id" = p."id" FROM "profiles" p WHERE p."user_id" = t."user_id" AND p."is_default" = true AND t."profile_id" IS NULL;
--> statement-breakpoint
UPDATE "connect_codes" t SET "profile_id" = p."id" FROM "profiles" p WHERE p."user_id" = t."user_id" AND p."is_default" = true AND t."profile_id" IS NULL;
--> statement-breakpoint
UPDATE "api_tokens" t SET "profile_id" = p."id" FROM "profiles" p WHERE p."user_id" = t."user_id" AND p."is_default" = true AND t."profile_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "saved_urls" ALTER COLUMN "profile_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "read_later_state" ALTER COLUMN "profile_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "collections" ALTER COLUMN "profile_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "profile_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ask_threads" ALTER COLUMN "profile_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "profile_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "insight_profiles" ALTER COLUMN "profile_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "connect_codes" ALTER COLUMN "profile_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "api_tokens" ALTER COLUMN "profile_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "saved_urls" DROP CONSTRAINT IF EXISTS "saved_urls_user_normalized_unique";
--> statement-breakpoint
ALTER TABLE "saved_urls" ADD CONSTRAINT "saved_urls_profile_normalized_unique" UNIQUE("profile_id","normalized_url");
--> statement-breakpoint
ALTER TABLE "saved_urls" ADD CONSTRAINT "saved_urls_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "read_later_state" ADD CONSTRAINT "read_later_state_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ask_threads" ADD CONSTRAINT "ask_threads_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "insight_profiles" ADD CONSTRAINT "insight_profiles_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "connect_codes" ADD CONSTRAINT "connect_codes_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "saved_urls_profile_id_idx" ON "saved_urls" USING btree ("profile_id");
--> statement-breakpoint
CREATE INDEX "read_later_profile_id_idx" ON "read_later_state" USING btree ("profile_id");
--> statement-breakpoint
CREATE INDEX "collections_profile_id_idx" ON "collections" USING btree ("profile_id");
--> statement-breakpoint
CREATE INDEX "projects_profile_id_idx" ON "projects" USING btree ("profile_id");
--> statement-breakpoint
CREATE INDEX "ask_threads_profile_id_idx" ON "ask_threads" USING btree ("profile_id");
--> statement-breakpoint
CREATE INDEX "notes_profile_id_idx" ON "notes" USING btree ("profile_id");
--> statement-breakpoint
CREATE INDEX "insight_profiles_profile_id_idx" ON "insight_profiles" USING btree ("profile_id");
--> statement-breakpoint
CREATE INDEX "api_tokens_profile_idx" ON "api_tokens" USING btree ("profile_id");
