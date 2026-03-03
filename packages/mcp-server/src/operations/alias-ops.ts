import { eq, and, ilike } from 'drizzle-orm';
import { db, nodeAliases } from '../db.js';

export async function addAlias(params: {
  sessionId: string;
  nodeId: string;
  alias: string;
}) {
  const [alias] = await db
    .insert(nodeAliases)
    .values({
      sessionId: params.sessionId,
      nodeId: params.nodeId,
      alias: params.alias,
    })
    .returning();
  return alias!;
}

export async function listAliases(params: {
  sessionId: string;
  nodeId?: string;
  search?: string;
  limit?: number;
}) {
  const conditions = [eq(nodeAliases.sessionId, params.sessionId)];

  if (params.nodeId) {
    conditions.push(eq(nodeAliases.nodeId, params.nodeId));
  }
  if (params.search) {
    conditions.push(ilike(nodeAliases.alias, `%${params.search}%`));
  }

  return db
    .select()
    .from(nodeAliases)
    .where(and(...conditions))
    .limit(params.limit ?? 100);
}
