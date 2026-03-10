import { pgTable, uuid, varchar, text, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sessions } from './sessions.js';

/**
 * Files table - stores uploaded file metadata and extracted content
 */
export const files = pgTable('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  fileSize: integer('file_size').notNull(),
  storagePath: text('storage_path').notNull(),
  extractedContent: jsonb('extracted_content'), // Content extracted by Gemini
  processingStatus: varchar('processing_status', { length: 20 }).default('pending').notNull(), // pending, processing, completed, failed
  processingError: text('processing_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_files_session').on(table.sessionId),
  index('idx_files_status').on(table.processingStatus),
]);

/**
 * Relations for files
 */
export const filesRelations = relations(files, ({ one }) => ({
  session: one(sessions, {
    fields: [files.sessionId],
    references: [sessions.id],
  }),
}));

export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
