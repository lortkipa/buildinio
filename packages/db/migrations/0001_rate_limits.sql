CREATE TABLE "rate_limit_counter" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_limit_counter_reset_at_idx" ON "rate_limit_counter" USING btree ("reset_at");