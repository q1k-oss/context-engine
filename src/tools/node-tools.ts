import { z } from 'zod';
import { eq, and, or, ilike, desc, gte, sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { knowledgeNodes, knowledgeEdges, nodeAliases, sessions } from '../db/schema/index.js';
import type { ToolDefinition, ToolContext } from './index.js';

const NodeTypes = ['Entity', 'Concept', 'Event', 'Intent', 'Decision', 'Artifact'] as const;

/**
 * Verify session belongs to the tenant (if tenantId is provided in context).
 * Throws if the session doesn't belong to the tenant.
 */
async function verifySessionTenant(sessionId: string, context?: ToolContext): Promise<void> {
  if (!context?.tenantId) return;
  const session = await getDb().query.sessions.findFirst({
    where: and(
      eq(sessions.id, sessionId),
      eq(sessions.tenantId, context.tenantId),
    ),
  });
  if (!session) {
    throw new Error(`Session ${sessionId} not found or not accessible`);
  }
}

export const nodeTools: ToolDefinition[] = [
  {
    name: 'create_node',
    description: 'Create a new knowledge graph node in a session',
    parameters: z.object({
      sessionId: z.string().uuid().describe('Session ID to add the node to'),
      name: z.string().min(1).describe('Node name'),
      nodeType: z.enum(NodeTypes).describe('Type of knowledge node'),
      graphData: z.record(z.unknown()).optional().describe('Arbitrary structured data for the node'),
      confidenceScore: z.string().optional().describe('Confidence score 0.00-1.00 (default: 1.00)'),
      priorityScore: z.string().optional().describe('Priority score 0.00-1.00 (default: 0.50)'),
      sourceMessageId: z.string().uuid().optional().describe('Message ID that produced this node'),
    }),
    async execute(input, context?) {
      await verifySessionTenant(input.sessionId as string, context);
      const [node] = await getDb()
        .insert(knowledgeNodes)
        .values({
          sessionId: input.sessionId as string,
          name: input.name as string,
          nodeType: input.nodeType as string,
          graphData: (input.graphData as Record<string, unknown>) ?? {},
          confidenceScore: (input.confidenceScore as string) ?? '1.00',
          priorityScore: (input.priorityScore as string) ?? '0.50',
          sourceMessageId: input.sourceMessageId as string | undefined,
        })
        .returning();
      return node!;
    },
  },
  {
    name: 'get_node',
    description: 'Get a knowledge node by ID, including its aliases',
    parameters: z.object({
      nodeId: z.string().uuid().describe('Node ID to retrieve'),
    }),
    async execute(input, context?) {
      const node = await getDb().query.knowledgeNodes.findFirst({
        where: and(
          eq(knowledgeNodes.id, input.nodeId as string),
          eq(knowledgeNodes.isDeleted, false),
        ),
        with: { aliases: true },
      });
      if (!node) throw new Error(`Node ${input.nodeId} not found`);
      await verifySessionTenant(node.sessionId, context);
      return node;
    },
  },
  {
    name: 'update_node',
    description: 'Partially update a knowledge node. Merges graphData with existing data and bumps version.',
    parameters: z.object({
      nodeId: z.string().uuid().describe('Node ID to update'),
      name: z.string().min(1).optional().describe('New node name'),
      nodeType: z.enum(NodeTypes).optional().describe('New node type'),
      graphData: z.record(z.unknown()).optional().describe('Data to merge into existing graphData'),
      confidenceScore: z.string().optional().describe('New confidence score'),
      priorityScore: z.string().optional().describe('New priority score'),
    }),
    async execute(input, context?) {
      const existing = await getDb().query.knowledgeNodes.findFirst({
        where: and(
          eq(knowledgeNodes.id, input.nodeId as string),
          eq(knowledgeNodes.isDeleted, false),
        ),
      });
      if (!existing) throw new Error(`Node ${input.nodeId} not found`);
      await verifySessionTenant(existing.sessionId, context);

      const mergedGraphData = input.graphData
        ? { ...(existing.graphData as Record<string, unknown>), ...(input.graphData as Record<string, unknown>) }
        : undefined;

      const updates: Record<string, unknown> = {
        version: existing.version + 1,
        updatedAt: new Date(),
      };
      if (input.name) updates.name = input.name as string;
      if (input.nodeType) updates.nodeType = input.nodeType as string;
      if (input.confidenceScore) updates.confidenceScore = input.confidenceScore as string;
      if (input.priorityScore) updates.priorityScore = input.priorityScore as string;
      if (mergedGraphData) updates.graphData = mergedGraphData;

      const [updated] = await getDb()
        .update(knowledgeNodes)
        .set(updates)
        .where(eq(knowledgeNodes.id, input.nodeId as string))
        .returning();
      return updated!;
    },
  },
  {
    name: 'delete_node',
    description: 'Soft-delete a knowledge node and all its connected edges',
    parameters: z.object({
      nodeId: z.string().uuid().describe('Node ID to delete'),
    }),
    async execute(input, context?) {
      const id = input.nodeId as string;
      const [node] = await getDb()
        .update(knowledgeNodes)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(and(eq(knowledgeNodes.id, id), eq(knowledgeNodes.isDeleted, false)))
        .returning();

      if (!node) throw new Error(`Node ${id} not found`);
      await verifySessionTenant(node.sessionId, context);

      await getDb()
        .update(knowledgeEdges)
        .set({ isDeleted: true })
        .where(
          and(
            eq(knowledgeEdges.isDeleted, false),
            or(
              eq(knowledgeEdges.sourceNodeId, id),
              eq(knowledgeEdges.targetNodeId, id),
            ),
          ),
        );

      return node;
    },
  },
  {
    name: 'list_nodes',
    description: 'List knowledge nodes for a session with optional filters for type and minimum priority',
    parameters: z.object({
      sessionId: z.string().uuid().describe('Session ID'),
      nodeType: z.enum(NodeTypes).optional().describe('Filter by node type'),
      minPriority: z.string().optional().describe('Minimum priority score (e.g. "0.30")'),
      limit: z.number().int().min(1).max(200).optional().describe('Max results (default: 50)'),
      offset: z.number().int().min(0).optional().describe('Pagination offset (default: 0)'),
    }),
    async execute(input, context?) {
      await verifySessionTenant(input.sessionId as string, context);
      const conditions = [
        eq(knowledgeNodes.sessionId, input.sessionId as string),
        eq(knowledgeNodes.isDeleted, false),
      ];

      if (input.nodeType) {
        conditions.push(eq(knowledgeNodes.nodeType, input.nodeType as string));
      }
      if (input.minPriority) {
        conditions.push(gte(knowledgeNodes.priorityScore, input.minPriority as string));
      }

      return getDb()
        .select()
        .from(knowledgeNodes)
        .where(and(...conditions))
        .orderBy(desc(knowledgeNodes.priorityScore))
        .limit((input.limit as number) ?? 50)
        .offset((input.offset as number) ?? 0);
    },
  },
  {
    name: 'search_nodes',
    description: 'Full-text search across node names, graphData, and aliases',
    parameters: z.object({
      sessionId: z.string().uuid().describe('Session ID to search within'),
      query: z.string().min(1).describe('Search query string'),
      limit: z.number().int().min(1).max(200).optional().describe('Max results (default: 50)'),
    }),
    async execute(input, context?) {
      await verifySessionTenant(input.sessionId as string, context);
      const pattern = `%${input.query}%`;
      const sessionId = input.sessionId as string;

      return getDb()
        .select()
        .from(knowledgeNodes)
        .where(
          and(
            eq(knowledgeNodes.sessionId, sessionId),
            eq(knowledgeNodes.isDeleted, false),
            or(
              ilike(knowledgeNodes.name, pattern),
              sql`${knowledgeNodes.graphData}::text ILIKE ${pattern}`,
              sql`${knowledgeNodes.id} IN (SELECT node_id FROM node_aliases WHERE alias ILIKE ${pattern} AND session_id = ${sessionId})`,
            ),
          ),
        )
        .orderBy(desc(knowledgeNodes.priorityScore))
        .limit((input.limit as number) ?? 50);
    },
  },
];
