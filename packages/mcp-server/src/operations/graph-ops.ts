import { eq, and, desc } from 'drizzle-orm';
import { db, knowledgeNodes, knowledgeEdges, graphVersions } from '../db.js';

export async function getGraph(sessionId: string) {
  const [nodes, edges] = await Promise.all([
    db
      .select()
      .from(knowledgeNodes)
      .where(
        and(
          eq(knowledgeNodes.sessionId, sessionId),
          eq(knowledgeNodes.isDeleted, false),
        ),
      )
      .orderBy(desc(knowledgeNodes.priorityScore)),
    db
      .select()
      .from(knowledgeEdges)
      .where(
        and(
          eq(knowledgeEdges.sessionId, sessionId),
          eq(knowledgeEdges.isDeleted, false),
        ),
      ),
  ]);

  return { sessionId, nodes, edges, nodeCount: nodes.length, edgeCount: edges.length };
}

export async function getPrioritizedContext(params: {
  sessionId: string;
  limit?: number;
  minPriority?: string;
}) {
  const conditions = [
    eq(knowledgeNodes.sessionId, params.sessionId),
    eq(knowledgeNodes.isDeleted, false),
  ];

  const nodes = await db
    .select()
    .from(knowledgeNodes)
    .where(and(...conditions))
    .orderBy(desc(knowledgeNodes.priorityScore))
    .limit(params.limit ?? 20);

  // Filter by minPriority in application layer for decimal comparison safety
  const filtered = params.minPriority
    ? nodes.filter((n) => parseFloat(n.priorityScore) >= parseFloat(params.minPriority!))
    : nodes;

  // Get edges connecting these nodes
  const nodeIds = new Set(filtered.map((n) => n.id));
  const edges = await db
    .select()
    .from(knowledgeEdges)
    .where(
      and(
        eq(knowledgeEdges.sessionId, params.sessionId),
        eq(knowledgeEdges.isDeleted, false),
      ),
    );

  const relevantEdges = edges.filter(
    (e) => nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId),
  );

  return { nodes: filtered, edges: relevantEdges, nodeCount: filtered.length, edgeCount: relevantEdges.length };
}

export async function getGraphVersion(sessionId: string, version: number) {
  const snapshot = await db.query.graphVersions.findFirst({
    where: and(
      eq(graphVersions.sessionId, sessionId),
      eq(graphVersions.version, version),
    ),
  });
  return snapshot ?? null;
}

export async function listGraphVersions(sessionId: string) {
  const versions = await db
    .select()
    .from(graphVersions)
    .where(eq(graphVersions.sessionId, sessionId))
    .orderBy(desc(graphVersions.version));

  return versions.map((v) => ({
    id: v.id,
    sessionId: v.sessionId,
    version: v.version,
    createdAt: v.createdAt,
    // Include stats from snapshot if available
    stats: (() => {
      const snap = v.graphSnapshot as { nodes?: unknown[]; edges?: unknown[] } | null;
      return snap
        ? { nodeCount: snap.nodes?.length ?? 0, edgeCount: snap.edges?.length ?? 0 }
        : null;
    })(),
  }));
}
