CREATE TYPE "public"."note_status" AS ENUM('draft', 'done');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('article', 'pdf', 'video', 'thread');--> statement-breakpoint
CREATE TABLE "compare_boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"collection_id" uuid,
	"sources" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"axes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"candidate_axes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_snapshots" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"isolated" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"collection_id" uuid,
	"title" text NOT NULL,
	"status" "note_status" DEFAULT 'draft' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "tone" varchar(16) DEFAULT 'neutral' NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_urls" ADD COLUMN "kind" "source_kind" DEFAULT 'article' NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_urls" ADD COLUMN "points" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_urls" ADD COLUMN "suggested_tags" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_urls" ADD COLUMN "duration_label" text;--> statement-breakpoint
ALTER TABLE "saved_urls" ADD COLUMN "quote_candidates" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_urls" ADD COLUMN "related_note_id" uuid;--> statement-breakpoint
ALTER TABLE "compare_boards" ADD CONSTRAINT "compare_boards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compare_boards" ADD CONSTRAINT "compare_boards_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_snapshots" ADD CONSTRAINT "graph_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compare_boards_user_id_idx" ON "compare_boards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notes_user_id_idx" ON "notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notes_collection_id_idx" ON "notes" USING btree ("collection_id");--> statement-breakpoint
ALTER TABLE "saved_urls" ADD CONSTRAINT "saved_urls_related_note_id_notes_id_fk" FOREIGN KEY ("related_note_id") REFERENCES "public"."notes"("id") ON DELETE set null ON UPDATE no action;