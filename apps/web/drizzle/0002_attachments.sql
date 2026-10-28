ALTER TABLE "attachment" ALTER COLUMN "message_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attachment" ALTER COLUMN "size" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN "uploader_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN "channel_id" uuid;--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "instance" ADD COLUMN "max_upload_size" bigint DEFAULT 2147483648 NOT NULL;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_uploader_id_user_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_channel_id_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachment_message_idx" ON "attachment" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "attachment_uploader_idx" ON "attachment" USING btree ("uploader_id");--> statement-breakpoint
ALTER TABLE "attachment" DROP COLUMN "url";