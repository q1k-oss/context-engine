import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { contextDeltas, graphVersions } from '../db/schema/index.js';
import { graphBuilderService } from '../services/knowledge-graph/graph-builder.service.js';
import type { ToolDefinition } from './index.js';

export const graphTools: ToolDefinition[] = [
  {
    name: 'get_graph',
    description: 'Get the full knowledge graph for a session (all nodes and edges)',
    parameters: z.object({
      sessionId: z.string().uuid().describe('Session ID'),
    }),
    async execute(input) {
      return graphBuilderService.getGraph(input.sessionId as string);
    },
  },
  {
    name: 'get_prioritized_context',
    description: 'Get the highest-priority nodes and their connecting edges, suitable for injecting into LLM context',
    parameters: z.object({
      sessionId: z.string().uuid().describe('Session ID'),
      minPriority: z.number().min(0).max(1).optional().describe('Minimum priority threshold (default: 0.3)'),
    }),
    async execute(input) {
      return graphBuilderService.getPrioritizedContext(
        input.sessionId as string,
        input.minPriority as number | undefined,
      );
    },
  },
  {
    name: 'get_graph_version',
    description: 'Get a historical snapshot of the knowledge graph at a specific version',
    parameters: z.object({
      sessionId: z.string().uuid().describe('Session ID'),
      version: z.number().int().min(0).describe('Version number to retrieve'),
    }),
    async execute(input) {
      const snapshot = await getDb().query.graphVersions.findFirst({
        where: and(
          eq(graphVersions.sessionId, input.sessionId as string),
          eq(graphVersions.version, input.version as number),
        ),
      });
      if (!snapshot) throw new Error(`Graph version ${input.version} not found for session ${input.sessionId}`);
      return snapshot;
    },
  },
  {
    name: 'list_graph_versions',
    description: 'List all graph versions for a session with node/edge counts',
    parameters: z.object({
      sessionId: z.string().uuid().describe('Session ID'),
    }),
    async execute(input) {
      const versions = await getDb()
        .select()
        .from(graphVersions)
        .where(eq(graphVersions.sessionId, input.sessionId as string))
        .orderBy(desc(graphVersions.version));

      return versions.map((v) => {
        const snap = v.graphSnapshot as { nodes?: unknown[]; edges?: unknown[] } | null;
        return {
          id: v.id,
          sessionId: v.sessionId,
          version: v.version,
          createdAt: v.createdAt,
          nodeCount: snap?.nodes?.length ?? 0,
          edgeCount: snap?.edges?.length ?? 0,
        };
      });
    },
  },
  {
    name: 'get_context_deltas',
    description: 'Get the evolution timeline showing how the knowledge graph changed over time',
    parameters: z.object({
      sessionId: z.string().uuid().describe('Session ID'),
    }),
    async execute(input) {
      const deltas = await getDb().query.contextDeltas.findMany({
        where: eq(contextDeltas.sessionId, input.sessionId as string),
        orderBy: [desc(contextDeltas.versionTo)],
      });

      return deltas.map((d) => {
        const data = d.deltaData as {
          additions?: { nodes?: unknown[]; edges?: unknown[] };
          modifications?: { nodes?: unknown[]; priorities?: unknown[] };
          removals?: { nodeIds?: unknown[]; edgeIds?: unknown[] };
        };

        return {
          id: d.id,
          versionFrom: d.versionFrom,
          versionTo: d.versionTo,
          triggerMessageId: d.triggerMessageId,
          createdAt: d.createdAt,
          additions: (data?.additions?.nodes?.length ?? 0) + (data?.additions?.edges?.length ?? 0),
          modifications: (data?.modifications?.nodes?.length ?? 0) + (data?.modifications?.priorities?.length ?? 0),
          removals: (data?.removals?.nodeIds?.length ?? 0) + (data?.removals?.edgeIds?.length ?? 0),
        };
      });
    },
  },
  {
    name: 'repair_orphans',
    description: 'Find orphan nodes (no edges) and connect them to the graph using LLM-based semantic matching',
    parameters: z.object({
      sessionId: z.string().uuid().describe('Session ID'),
    }),
    async execute(input) {
      return graphBuilderService.repairOrphans(input.sessionId as string);
    },
  },
];
