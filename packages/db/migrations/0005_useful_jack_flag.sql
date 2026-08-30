ALTER TABLE "notes" ADD COLUMN "body" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL;