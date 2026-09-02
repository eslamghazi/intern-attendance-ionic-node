ALTER TYPE "public"."audit_event" ADD VALUE 'master_login';--> statement-breakpoint
ALTER TYPE "public"."audit_event" ADD VALUE 'staff_deleted';--> statement-breakpoint
ALTER TYPE "public"."audit_event" ADD VALUE 'outside_window';--> statement-breakpoint
ALTER TYPE "public"."audit_event" ADD VALUE 'checkout_blocked';--> statement-breakpoint
ALTER VIEW "public"."member_directory" SET (security_invoker = true);