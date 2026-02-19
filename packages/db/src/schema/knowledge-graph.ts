import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  decimal,
  integer,
  boolean,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sessions } from './sessions';
import { messages } from './messages';

/**
 * Knowledge nodes table - stores entities, concepts, events, etc.
 * Uses JSONB for flexible graph_data storage
 */
export const knowledgeNodes = pgTable('knowledge_nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  nodeType: varchar('node_type', { length: 50 }).notNull(), // Entity, Concept, Event, Intent, Decision, Artifact
  name: varchar('name', { length: 255 }).notNull(),
  graphData: jsonb('graph_data').default({}).notNull(), // Flexible JSONB for properties
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }).default('1.00').notNull(),
  priorityScore: decimal('priority_score', { precision: 3, scale: 2 }).default('0.50').notNull(),
  sourceMessageId: uuid('source_message_id').references(() => messages.id),
  version: integer('version').default(1).notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // B-Tree index for efficient priority-based queries
  index('idx_nodes_session_priority').on(table.sessionId, table.priorityScore),
  // GIN index for JSONB queries
  index('idx_nodes_graph_data').using('gin', table.graphData),
]);

/**
 * Knowledge edges table - stores relationships between nodes
 */
export const knowledgeEdges = pgTable('knowledge_edges', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  sourceNodeId: uuid('source_node_id').references(() => knowledgeNodes.id).notNull(),
  targetNodeId: uuid('target_node_id').references(() => knowledgeNodes.id).notNull(),
  edgeType: varchar('edge_type', { length: 50 }).notNull(), // RELATES_TO, CAUSES, DEPENDS_ON, etc.
  edgeData: jsonb('edge_data').default({}).notNull(),
  weight: decimal('weight', { precision: 3, scale: 2 }).default('1.00').notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_edges_session').on(table.sessionId),
  index('idx_edges_source').on(table.sourceNodeId),
  index('idx_edges_target').on(table.targetNodeId),
]);

/**
 * Context deltas table - tracks changes between graph versions
 */
export const contextDeltas = pgTable('context_deltas', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  versionFrom: integer('version_from').notNull(),
  versionTo: integer('version_to').notNull(),
  triggerMessageId: uuid('trigger_message_id').references(() => messages.id),
  deltaData: jsonb('delta_data').notNull(), // {additions, modifications, removals}
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_deltas_session_version').on(table.sessionId, table.versionTo),
]);

/**
 * Graph versions table - stores full graph snapshots
 */
export const graphVersions = pgTable('graph_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  version: integer('version').notNull(),
  graphSnapshot: jsonb('graph_snapshot').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('unique_session_version').on(table.sessionId, table.version),
]);

/**
 * Node aliases table - tracks alternative names for entities
 * Used for entity resolution / deduplication
 */
export const nodeAliases = pgTable('node_aliases', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  nodeId: uuid('node_id').references(() => knowledgeNodes.id, { onDelete: 'cascade' }).notNull(),
  alias: varchar('alias', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_aliases_session_alias').on(table.sessionId, table.alias),
  index('idx_aliases_node').on(table.nodeId),
]);

export type NodeAlias = typeof nodeAliases.$inferSelect;
export type NewNodeAlias = typeof nodeAliases.$inferInsert;

/**
 * Relations for knowledge nodes
 */
export const knowledgeNodesRelations = relations(knowledgeNodes, ({ one, many }) => ({
  session: one(sessions, {
    fields: [knowledgeNodes.sessionId],
    references: [sessions.id],
  }),
  sourceMessage: one(messages, {
    fields: [knowledgeNodes.sourceMessageId],
    references: [messages.id],
  }),
  outgoingEdges: many(knowledgeEdges, { relationName: 'sourceNode' }),
  incomingEdges: many(knowledgeEdges, { relationName: 'targetNode' }),
  aliases: many(nodeAliases),
}));

export const nodeAliasesRelations = relations(nodeAliases, ({ one }) => ({
  node: one(knowledgeNodes, {
    fields: [nodeAliases.nodeId],
    references: [knowledgeNodes.id],
  }),
  session: one(sessions, {
    fields: [nodeAliases.sessionId],
    references: [sessions.id],
  }),
}));

/**
 * Relations for knowledge edges
 */
export const knowledgeEdgesRelations = relations(knowledgeEdges, ({ one }) => ({
  session: one(sessions, {
    fields: [knowledgeEdges.sessionId],
    references: [sessions.id],
  }),
  sourceNode: one(knowledgeNodes, {
    fields: [knowledgeEdges.sourceNodeId],
    references: [knowledgeNodes.id],
    relationName: 'sourceNode',
  }),
  targetNode: one(knowledgeNodes, {
    fields: [knowledgeEdges.targetNodeId],
    references: [knowledgeNodes.id],
    relationName: 'targetNode',
  }),
}));

export type KnowledgeNode = typeof knowledgeNodes.$inferSelect;
export type NewKnowledgeNode = typeof knowledgeNodes.$inferInsert;
export type KnowledgeEdge = typeof knowledgeEdges.$inferSelect;
export type NewKnowledgeEdge = typeof knowledgeEdges.$inferInsert;
export type ContextDelta = typeof contextDeltas.$inferSelect;
export type NewContextDelta = typeof contextDeltas.$inferInsert;
export type GraphVersion = typeof graphVersions.$inferSelect;
export type NewGraphVersion = typeof graphVersions.$inferInsert;
