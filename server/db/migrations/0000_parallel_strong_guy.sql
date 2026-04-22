CREATE TYPE "public"."field_type" AS ENUM('text', 'number', 'chinese', 'date', 'singleChoice');--> statement-breakpoint
CREATE TYPE "public"."operation_action" AS ENUM('create', 'read', 'update', 'delete', 'login', 'logout');--> statement-breakpoint
CREATE TYPE "public"."table_type" AS ENUM('full', 'partial');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'classLeader', 'admin', 'superAdmin');--> statement-breakpoint
CREATE TABLE "dynamic_field_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"table_id" text NOT NULL,
	"user_id" text NOT NULL,
	"field_key" text NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	CONSTRAINT "dynamic_field_values_table_user_field_unique" UNIQUE("table_id","user_id","field_key")
);
--> statement-breakpoint
CREATE TABLE "dynamic_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"table_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" "field_type" NOT NULL,
	"limit" integer,
	"options" jsonb
);
--> statement-breakpoint
CREATE TABLE "dynamic_table_rows" (
	"id" serial PRIMARY KEY NOT NULL,
	"table_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "dynamic_table_rows_table_id_user_id_unique" UNIQUE("table_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "dynamic_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_by" text NOT NULL,
	"type" "table_type" DEFAULT 'partial' NOT NULL,
	CONSTRAINT "dynamic_tables_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "operation_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"operator_id" text NOT NULL,
	"operator_name" text NOT NULL,
	"action" "operation_action" NOT NULL,
	"target" text NOT NULL,
	"detail" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"class_name" text NOT NULL,
	"gender" text NOT NULL,
	"password_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_accounts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"class_name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"password_hash" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"lock_until" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "dynamic_field_values" ADD CONSTRAINT "dynamic_field_values_table_id_dynamic_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."dynamic_tables"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "dynamic_fields" ADD CONSTRAINT "dynamic_fields_table_id_dynamic_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."dynamic_tables"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "dynamic_table_rows" ADD CONSTRAINT "dynamic_table_rows_table_id_dynamic_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."dynamic_tables"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "session_tokens" ADD CONSTRAINT "session_tokens_user_id_user_accounts_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_accounts"("user_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "dynamic_field_values_table_user_idx" ON "dynamic_field_values" USING btree ("table_id","user_id");--> statement-breakpoint
CREATE INDEX "dynamic_field_values_user_idx" ON "dynamic_field_values" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dynamic_fields_table_id_idx" ON "dynamic_fields" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "dynamic_table_rows_table_id_idx" ON "dynamic_table_rows" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "dynamic_table_rows_user_id_idx" ON "dynamic_table_rows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "operation_logs_timestamp_idx" ON "operation_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "operation_logs_action_idx" ON "operation_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "session_tokens_user_id_idx" ON "session_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_tokens_expires_at_idx" ON "session_tokens" USING btree ("expires_at");