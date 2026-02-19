CREATE TABLE "node_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"alias" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "node_aliases" ADD CONSTRAINT "node_aliases_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_aliases" ADD CONSTRAINT "node_aliases_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_aliases_session_alias" ON "node_aliases" USING btree ("session_id","alias");--> statement-breakpoint
CREATE INDEX "idx_aliases_node" ON "node_aliases" USING btree ("node_id");