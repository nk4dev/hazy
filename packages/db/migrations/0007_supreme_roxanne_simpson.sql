CREATE TABLE "insight_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"profile" text DEFAULT '' NOT NULL,
	"themes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"leanings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blind_spots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"next_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"llm" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "insight_profiles" ADD CONSTRAINT "insight_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_profiles" ADD CONSTRAINT "insight_profiles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "insight_profiles_user_id_idx" ON "insight_profiles" USING btree ("user_id");