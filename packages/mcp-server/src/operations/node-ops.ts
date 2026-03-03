import { eq, and, or, ilike, desc, gte, sql } from 'drizzle-orm';
import { db, knowledgeNodes, knowledgeEdges, nodeAliases } from '../db.js';

export async function createNode(params: {
  sessionId: string;
  nodeType: string;
  name: string;
  graphData?: Record<string, unknown>;
  confidenceScore?: string;
  priorityScore?: string;
  sourceMessageId?: string;
}) {
  const [node] = await db
    .insert(knowledgeNodes)
    .values({
      sessionId: params.sessionId,
      nodeType: params.nodeType,
      name: params.name,
      graphData: params.graphData ?? {},
      confidenceScore: params.confidenceScore ?? '1.00',
      priorityScore: params.priorityScore ?? '0.50',
      sourceMessageId: params.sourceMessageId,
    })
    .returning();
  return node!;
}

export async function getNode(id: string) {
  const node = await db.query.knowledgeNodes.findFirst({
    where: and(eq(knowledgeNodes.id, id), eq(knowledgeNodes.isDeleted, false)),
    with: { aliases: true },
  });
  return node ?? null;
}

export async function updateNode(
  id: string,
  data: {
    name?: string;
    nodeType?: string;
    graphData?: Record<string, unknown>;
    confidenceScore?: string;
    priorityScore?: string;
  },
) {
  const existing = await db.query.knowledgeNodes.findFirst({
    where: and(eq(knowledgeNodes.id, id), eq(knowledgeNodes.isDeleted, false)),
  });
  if (!existing) return null;

  const mergedGraphData = data.graphData
    ? { ...(existing.graphData as Record<string, unknown>), ...data.graphData }
    : undefined;

  const [updated] = await db
    .update(knowledgeNodes)
    .set({
      ...(data.name && { name: data.name }),
      ...(data.nodeType && { nodeType: data.nodeType }),
      ...(data.confidenceScore && { confidenceScore: data.confidenceScore }),
      ...(data.priorityScore && { priorityScore: data.priorityScore }),
      ...(mergedGraphData && { graphData: mergedGraphData }),
      version: existing.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(knowledgeNodes.id, id))
    .returning();
  return updated!;
}

export async function deleteNode(id: string) {
  const [node] = await db
    .update(knowledgeNodes)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(and(eq(knowledgeNodes.id, id), eq(knowledgeNodes.isDeleted, false)))
    .returning();

  if (!node) return null;

  // Soft-delete connected edges
  await db
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
}

export async function listNodes(params: {
  sessionId: string;
  nodeType?: string;
  minPriority?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [
    eq(knowledgeNodes.sessionId, params.sessionId),
    eq(knowledgeNodes.isDeleted, false),
  ];

  if (params.nodeType) {
    conditions.push(eq(knowledgeNodes.nodeType, params.nodeType));
  }
  if (params.minPriority) {
    conditions.push(gte(knowledgeNodes.priorityScore, params.minPriority));
  }

  return db
    .select()
    .from(knowledgeNodes)
    .where(and(...conditions))
    .orderBy(desc(knowledgeNodes.priorityScore))
    .limit(params.limit ?? 50)
    .offset(params.offset ?? 0);
}

export async function searchNodes(params: {
  sessionId: string;
  query: string;
  limit?: number;
}) {
  const pattern = `%${params.query}%`;
  return db
    .select()
    .from(knowledgeNodes)
    .where(
      and(
        eq(knowledgeNodes.sessionId, params.sessionId),
        eq(knowledgeNodes.isDeleted, false),
        or(
          ilike(knowledgeNodes.name, pattern),
          sql`${knowledgeNodes.graphData}::text ILIKE ${pattern}`,
          sql`${knowledgeNodes.id} IN (SELECT node_id FROM node_aliases WHERE alias ILIKE ${pattern} AND session_id = ${params.sessionId})`,
        ),
      ),
    )
    .orderBy(desc(knowledgeNodes.priorityScore))
    .limit(params.limit ?? 50);
}
