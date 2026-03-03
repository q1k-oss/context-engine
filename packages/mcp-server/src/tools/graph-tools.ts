import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getGraph, getPrioritizedContext, getGraphVersion, listGraphVersions } from '../operations/graph-ops.js';

export function registerGraphTools(server: McpServer) {
  server.tool(
    'get_graph',
    'Get the full knowledge graph (all active nodes and edges) for a session',
    {
      sessionId: z.string().uuid().describe('Session ID'),
    },
    async ({ sessionId }) => {
      try {
        const graph = await getGraph(sessionId);
        return { content: [{ type: 'text', text: JSON.stringify(graph, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error getting graph: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    'get_prioritized_context',
    'Get the highest-priority nodes and their connecting edges — optimized for LLM context injection',
    {
      sessionId: z.string().uuid().describe('Session ID'),
      limit: z.number().int().min(1).max(100).optional().describe('Max nodes to return (default: 20)'),
      minPriority: z.string().optional().describe('Minimum priority threshold (e.g. "0.70")'),
    },
    async (params) => {
      try {
        const context = await getPrioritizedContext(params);
        return { content: [{ type: 'text', text: JSON.stringify(context, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error getting prioritized context: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    'get_graph_version',
    'Get a historical graph snapshot at a specific version number',
    {
      sessionId: z.string().uuid().describe('Session ID'),
      version: z.number().int().min(1).describe('Version number to retrieve'),
    },
    async ({ sessionId, version }) => {
      try {
        const snapshot = await getGraphVersion(sessionId, version);
        if (!snapshot) {
          return { content: [{ type: 'text', text: 'Graph version not found' }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(snapshot, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error getting graph version: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    'list_graph_versions',
    'List all graph version snapshots for a session with node/edge counts',
    {
      sessionId: z.string().uuid().describe('Session ID'),
    },
    async ({ sessionId }) => {
      try {
        const versions = await listGraphVersions(sessionId);
        return { content: [{ type: 'text', text: JSON.stringify({ count: versions.length, versions }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error listing graph versions: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );
}
