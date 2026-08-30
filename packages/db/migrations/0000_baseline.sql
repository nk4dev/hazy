CREATE TYPE "public"."answer_language_mode" AS ENUM('interface', 'source');--> statement-breakpoint
CREATE TYPE "public"."ask_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."fetch_status" AS ENUM('pending', 'success', 'error');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('en', 'ja');--> statement-breakpoint
CREATE TYPE "public"."read_later_status" AS ENUM('inbox', 'snoozed', 'read', 'archived');--> statement-breakpoint
CREATE TABLE "ask_message_citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"saved_url_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"snippet" text
);
--> statement-breakpoint
CREATE TABLE "ask_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"role" "ask_role" NOT NULL,
	"content" text NOT NULL,
	"model_id" varchar(255),
	"used_fallback" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ask_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"saved_url_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_items_collection_saved_url_unique" UNIQUE("saved_url_id","collection_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"color" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"summary" text,
	"summary_updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "read_later_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"saved_url_id" uuid NOT NULL,
	"status" "read_later_status" DEFAULT 'inbox' NOT NULL,
	"snoozed_until" timestamp with time zone,
	"marked_read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "read_later_user_saved_url_unique" UNIQUE("user_id","saved_url_id")
);
--> statement-breakpoint
CREATE TABLE "saved_urls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"domain" varchar(255),
	"title" text,
	"description" text,
	"favicon_url" text,
	"og_image_url" text,
	"summary" text,
	"extracted_text" text,
	"content_language" varchar(8),
	"estimated_read_minutes" integer,
	"fetch_status" "fetch_status" DEFAULT 'pending' NOT NULL,
	"fetch_error" text,
	"search_vector" "tsvector",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	CONSTRAINT "saved_urls_user_normalized_unique" UNIQUE("user_id","normalized_url")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"interface_locale" "locale" DEFAULT 'en' NOT NULL,
	"answer_language_mode" "answer_language_mode" DEFAULT 'interface' NOT NULL,
	"notify_read_later_digest" boolean DEFAULT true NOT NULL,
	"notify_weekly_stats" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" varchar(191) NOT NULL,
	"email" varchar(320),
	"display_name" varchar(255),
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
ALTER TABLE "ask_message_citations" ADD CONSTRAINT "ask_message_citations_message_id_ask_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ask_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_message_citations" ADD CONSTRAINT "ask_message_citations_saved_url_id_saved_urls_id_fk" FOREIGN KEY ("saved_url_id") REFERENCES "public"."saved_urls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_messages" ADD CONSTRAINT "ask_messages_thread_id_ask_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."ask_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_threads" ADD CONSTRAINT "ask_threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_saved_url_id_saved_urls_id_fk" FOREIGN KEY ("saved_url_id") REFERENCES "public"."saved_urls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "read_later_state" ADD CONSTRAINT "read_later_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "read_later_state" ADD CONSTRAINT "read_later_state_saved_url_id_saved_urls_id_fk" FOREIGN KEY ("saved_url_id") REFERENCES "public"."saved_urls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_urls" ADD CONSTRAINT "saved_urls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ask_citations_message_id_idx" ON "ask_message_citations" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "ask_messages_thread_id_idx" ON "ask_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "ask_threads_user_id_idx" ON "ask_threads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "collections_user_id_idx" ON "collections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "read_later_user_status_idx" ON "read_later_state" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "saved_urls_search_vector_idx" ON "saved_urls" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "saved_urls_tags_idx" ON "saved_urls" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "saved_urls_user_id_idx" ON "saved_urls" USING btree ("user_id");