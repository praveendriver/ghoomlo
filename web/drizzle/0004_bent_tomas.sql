ALTER TABLE "fare_alerts" ALTER COLUMN "break_label" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fare_alerts" ADD COLUMN "travel_start" date;--> statement-breakpoint
ALTER TABLE "fare_alerts" ADD COLUMN "travel_end" date;--> statement-breakpoint
ALTER TABLE "fare_watch_signups" ADD COLUMN "windows" jsonb DEFAULT '[]'::jsonb NOT NULL;