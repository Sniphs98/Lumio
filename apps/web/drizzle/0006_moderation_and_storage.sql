CREATE TABLE "ban" (
	"user_id" text PRIMARY KEY NOT NULL,
	"banned_by_id" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instance" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "instance" ADD COLUMN "upload_quota_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "instance" ADD COLUMN "member_upload_quota" bigint DEFAULT 5368709120 NOT NULL;--> statement-breakpoint
ALTER TABLE "instance" ADD COLUMN "guest_upload_quota" bigint DEFAULT 1073741824 NOT NULL;--> statement-breakpoint
ALTER TABLE "ban" ADD CONSTRAINT "ban_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ban" ADD CONSTRAINT "ban_banned_by_id_user_id_fk" FOREIGN KEY ("banned_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;