import { z } from 'zod';
import { eq, and, ilike } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { nodeAliases } from '../db/schema/index.js';
import type { ToolDefinition } from './index.js';

export const aliasTools: ToolDefinition[] = [
  {
    name: 'add_alias',
    description: 'Add an alternative name (alias) for a knowledge node',
    parameters: z.object({
      sessionId: z.string().uuid().describe('Session ID'),
      nodeId: z.string().uuid().describe('Node ID to add alias to'),
      alias: z.string().min(1).describe('Alternative name for the node'),
    }),
    async execute(input) {
      const [alias] = await getDb()
        .insert(nodeAliases)
        .values({
          sessionId: input.sessionId as string,
          nodeId: input.nodeId as string,
          alias: input.alias as string,
        })
        .returning();
      return alias!;
    },
  },
  {
    name: 'list_aliases',
    description: 'List or search node aliases in a session',
    parameters: z.object({
      sessionId: z.string().uuid().describe('Session ID'),
      nodeId: z.string().uuid().optional().describe('Filter aliases for a specific node'),
      search: z.string().optional().describe('Search aliases by name pattern'),
      limit: z.number().int().min(1).max(200).optional().describe('Max results (default: 100)'),
    }),
    async execute(input) {
      const conditions = [eq(nodeAliases.sessionId, input.sessionId as string)];

      if (input.nodeId) {
        conditions.push(eq(nodeAliases.nodeId, input.nodeId as string));
      }
      if (input.search) {
        conditions.push(ilike(nodeAliases.alias, `%${input.search}%`));
      }

      return getDb()
        .select()
        .from(nodeAliases)
        .where(and(...conditions))
        .limit((input.limit as number) ?? 100);
    },
  },
];
