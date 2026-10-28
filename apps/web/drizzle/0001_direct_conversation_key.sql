ALTER TABLE "conversation" ADD COLUMN "direct_key" text;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_direct_key_unique" UNIQUE("direct_key");