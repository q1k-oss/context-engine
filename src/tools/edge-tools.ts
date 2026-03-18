import { z } from 'zod';
import { eq, and, or, desc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { knowledgeEdges, knowledgeNodes, sessions } from '../db/schema/index.js';
import type { ToolDefinition, ToolContext } from './index.js';

async function verifySessionTenant(sessionId: string, context?: ToolContext): Promise<void> {
  if (!context?.tenantId) return;
  const session = await getDb().query.sessions.findFirst({
    where: and(eq(sessions.id, sessionId), eq(sessions.tenantId, context.tenantId)),
  });
  if (!session) throw new Error(`Session ${sessionId} not found or not accessible`);
}

const EdgeTypes = [
  'RELATES_TO', 'CAUSES', 'DEPENDS_ON', 'DECIDED_BY', 'CONSTRAINED_BY',
  'DERIVED_FROM', 'TEMPORALLY_PRECEDES', 'CO_OCCURS', 'SUPERSEDES', 'EVIDENCE_FOR',
] as const;

export const edgeTools: ToolDefinition[] = [
  {
    name: 'create_edge',
    description: 'Create a typed relationship between two knowledge nodes',
    parameters: z.object({
      sessionId: z.string().uuid().describe('Session ID'),
      sourceNodeId: z.string().uuid().describe('Source node ID'),
      targetNodeId: z.string().uuid().describe('Target node ID'),
      edgeType: z.enum(EdgeTypes).describe('Relationship type'),
      edgeData: z.record(z.unknown()).optional().describe('Arbitrary structured data for the edge'),
      weight: z.string().optional().describe('Edge weight 0.00-1.00 (default: 1.00)'),
    }),
    async execute(input, context?) {
      await verifySessionTenant(input.sessionId as string, context);
      const [edge] = await getDb()
        .insert(knowledgeEdges)
        .values({
          sessionId: input.sessionId as string,
          sourceNodeId: input.sourceNodeId as string,
          targetNodeId: input.targetNodeId as string,
          edgeType: input.edgeType as string,
          edgeData: (input.edgeData as Record<string, unknown>) ?? {},
          weight: (input.weight as string) ?? '1.00',
        })
        .returning();
      return edge!;
    },
  },
  {
    name: 'get_edge',
    description: 'Get an edge by ID with source and target node details',
    parameters: z.object({
      edgeId: z.string().uuid().describe('Edge ID to retrieve'),
    }),
    async execute(input, context?) {
      const edges = await getDb()
        .select({
          edge: knowledgeEdges,
          sourceName: knowledgeNodes.name,
          sourceType: knowledgeNodes.nodeType,
        })
        .from(knowledgeEdges)
        .innerJoin(knowledgeNodes, eq(knowledgeEdges.sourceNodeId, knowledgeNodes.id))
        .where(and(eq(knowledgeEdges.id, input.edgeId as string), eq(knowledgeEdges.isDeleted, false)));

      if (edges.length === 0) throw new Error(`Edge ${input.edgeId} not found`);

      const row = edges[0]!;
      await verifySessionTenant(row.edge.sessionId, context);

      const targetNode = await getDb()
        .select({ name: knowledgeNodes.name, nodeType: knowledgeNodes.nodeType })
        .from(knowledgeNodes)
        .where(eq(knowledgeNodes.id, row.edge.targetNodeId));

      return {
        ...row.edge,
        sourceNode: { name: row.sourceName, nodeType: row.sourceType },
        targetNode: targetNode[0] ? { name: targetNode[0].name, nodeType: targetNode[0].nodeType } : null,
      };
    },
  },
  {
    name: 'delete_edge',
    description: 'Soft-delete a relationship between nodes',
    parameters: z.object({
      edgeId: z.string().uuid().describe('Edge ID to delete'),
    }),
    async execute(input, context?) {
      const [edge] = await getDb()
        .update(knowledgeEdges)
        .set({ isDeleted: true })
        .where(and(eq(knowledgeEdges.id, input.edgeId as string), eq(knowledgeEdges.isDeleted, false)))
        .returning();
      if (!edge) throw new Error(`Edge ${input.edgeId} not found`);
      await verifySessionTenant(edge.sessionId, context);
      return edge;
    },
  },
  {
    name: 'list_edges',
    description: 'List edges for a session with optional filters for node and edge type',
    parameters: z.object({
      sessionId: z.string().uuid().describe('Session ID'),
      nodeId: z.string().uuid().optional().describe('Filter edges connected to this node'),
      edgeType: z.enum(EdgeTypes).optional().describe('Filter by edge type'),
      limit: z.number().int().min(1).max(200).optional().describe('Max results (default: 50)'),
      offset: z.number().int().min(0).optional().describe('Pagination offset (default: 0)'),
    }),
    async execute(input, context?) {
      await verifySessionTenant(input.sessionId as string, context);
      const conditions = [
        eq(knowledgeEdges.sessionId, input.sessionId as string),
        eq(knowledgeEdges.isDeleted, false),
      ];

      if (input.nodeId) {
        conditions.push(
          or(
            eq(knowledgeEdges.sourceNodeId, input.nodeId as string),
            eq(knowledgeEdges.targetNodeId, input.nodeId as string),
          )!,
        );
      }
      if (input.edgeType) {
        conditions.push(eq(knowledgeEdges.edgeType, input.edgeType as string));
      }

      return getDb()
        .select()
        .from(knowledgeEdges)
        .where(and(...conditions))
        .orderBy(desc(knowledgeEdges.createdAt))
        .limit((input.limit as number) ?? 50)
        .offset((input.offset as number) ?? 0);
    },
  },
];
