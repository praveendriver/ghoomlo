CREATE TABLE "fare_alert_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid NOT NULL,
	"signup_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fare_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"break_label" text NOT NULL,
	"price_inr" integer NOT NULL,
	"seen_on" date NOT NULL,
	"source" text NOT NULL,
	"target_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fare_alerts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fare_watch_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"home_city" text NOT NULL,
	"school" text NOT NULL,
	"board" text,
	"breaks" jsonb NOT NULL,
	"wishlist" jsonb NOT NULL,
	"travellers" integer,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fare_watch_signups_email_unique" UNIQUE("email"),
	CONSTRAINT "fare_watch_signups_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "fare_alert_clicks" ADD CONSTRAINT "fare_alert_clicks_alert_id_fare_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."fare_alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fare_alert_clicks" ADD CONSTRAINT "fare_alert_clicks_signup_id_fare_watch_signups_id_fk" FOREIGN KEY ("signup_id") REFERENCES "public"."fare_watch_signups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fare_alert_clicks_alert_idx" ON "fare_alert_clicks" USING btree ("alert_id");