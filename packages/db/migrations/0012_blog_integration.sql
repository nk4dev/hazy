CREATE TYPE "public"."blog_provider" AS ENUM('microcms', 'qiita', 'zenn');
--> statement-breakpoint
CREATE TYPE "public"."blog_post_status" AS ENUM('draft', 'published', 'archived');
--> statement-breakpoint
CREATE TABLE "blog_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"provider" "blog_provider" NOT NULL,
	"label" varchar(120) NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"encrypted_credentials" text NOT NULL,
	"webhook_token" varchar(96) NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_connections_webhook_token_unique" UNIQUE("webhook_token")
);
--> statement-breakpoint
CREATE TABLE "blog_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"note_id" uuid,
	"saved_url_id" uuid,
	"external_id" text NOT NULL,
	"external_slug" text,
	"external_url" text,
	"title" text NOT NULL,
	"status" "blog_post_status" DEFAULT 'draft' NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"content_hash" varchar(64),
	"published_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_publications_connection_external_unique" UNIQUE("connection_id","external_id")
);
--> statement-breakpoint
ALTER TABLE "blog_connections" ADD CONSTRAINT "blog_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "blog_connections" ADD CONSTRAINT "blog_connections_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "blog_publications" ADD CONSTRAINT "blog_publications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "blog_publications" ADD CONSTRAINT "blog_publications_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "blog_publications" ADD CONSTRAINT "blog_publications_connection_id_blog_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."blog_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "blog_publications" ADD CONSTRAINT "blog_publications_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "blog_publications" ADD CONSTRAINT "blog_publications_saved_url_id_saved_urls_id_fk" FOREIGN KEY ("saved_url_id") REFERENCES "public"."saved_urls"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "blog_connections_user_profile_idx" ON "blog_connections" USING btree ("user_id","profile_id");
--> statement-breakpoint
CREATE INDEX "blog_connections_profile_idx" ON "blog_connections" USING btree ("profile_id");
--> statement-breakpoint
CREATE INDEX "blog_publications_profile_idx" ON "blog_publications" USING btree ("profile_id");
--> statement-breakpoint
CREATE INDEX "blog_publications_note_idx" ON "blog_publications" USING btree ("note_id");
--> statement-breakpoint
CREATE INDEX "blog_publications_connection_idx" ON "blog_publications" USING btree ("connection_id");
