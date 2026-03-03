import { eq, and, or, desc } from 'drizzle-orm';
import { db, knowledgeEdges, knowledgeNodes } from '../db.js';

export async function createEdge(params: {
  sessionId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
  edgeData?: Record<string, unknown>;
  weight?: string;
}) {
  const [edge] = await db
    .insert(knowledgeEdges)
    .values({
      sessionId: params.sessionId,
      sourceNodeId: params.sourceNodeId,
      targetNodeId: params.targetNodeId,
      edgeType: params.edgeType,
      edgeData: params.edgeData ?? {},
      weight: params.weight ?? '1.00',
    })
    .returning();
  return edge!;
}

export async function getEdge(id: string) {
  const edges = await db
    .select({
      edge: knowledgeEdges,
      sourceName: knowledgeNodes.name,
      sourceType: knowledgeNodes.nodeType,
    })
    .from(knowledgeEdges)
    .innerJoin(knowledgeNodes, eq(knowledgeEdges.sourceNodeId, knowledgeNodes.id))
    .where(and(eq(knowledgeEdges.id, id), eq(knowledgeEdges.isDeleted, false)));

  if (edges.length === 0) return null;

  const row = edges[0]!;

  // Fetch target node details separately
  const targetNode = await db
    .select({ name: knowledgeNodes.name, nodeType: knowledgeNodes.nodeType })
    .from(knowledgeNodes)
    .where(eq(knowledgeNodes.id, row.edge.targetNodeId));

  return {
    ...row.edge,
    sourceNode: { name: row.sourceName, nodeType: row.sourceType },
    targetNode: targetNode[0] ? { name: targetNode[0].name, nodeType: targetNode[0].nodeType } : null,
  };
}

export async function deleteEdge(id: string) {
  const [edge] = await db
    .update(knowledgeEdges)
    .set({ isDeleted: true })
    .where(and(eq(knowledgeEdges.id, id), eq(knowledgeEdges.isDeleted, false)))
    .returning();
  return edge ?? null;
}

export async function listEdges(params: {
  sessionId: string;
  nodeId?: string;
  edgeType?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [
    eq(knowledgeEdges.sessionId, params.sessionId),
    eq(knowledgeEdges.isDeleted, false),
  ];

  if (params.nodeId) {
    conditions.push(
      or(
        eq(knowledgeEdges.sourceNodeId, params.nodeId),
        eq(knowledgeEdges.targetNodeId, params.nodeId),
      )!,
    );
  }
  if (params.edgeType) {
    conditions.push(eq(knowledgeEdges.edgeType, params.edgeType));
  }

  return db
    .select()
    .from(knowledgeEdges)
    .where(and(...conditions))
    .orderBy(desc(knowledgeEdges.createdAt))
    .limit(params.limit ?? 50)
    .offset(params.offset ?? 0);
}
