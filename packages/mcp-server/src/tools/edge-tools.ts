import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createEdge, getEdge, deleteEdge, listEdges } from '../operations/edge-ops.js';

const edgeTypes = [
  'RELATES_TO', 'CAUSES', 'DEPENDS_ON', 'DECIDED_BY', 'CONSTRAINED_BY',
  'DERIVED_FROM', 'TEMPORALLY_PRECEDES', 'CO_OCCURS', 'SUPERSEDES', 'EVIDENCE_FOR',
] as const;

export function registerEdgeTools(server: McpServer) {
  server.tool(
    'create_edge',
    'Create a typed relationship (edge) between two knowledge nodes',
    {
      sessionId: z.string().uuid().describe('Session ID'),
      sourceNodeId: z.string().uuid().describe('Source node ID'),
      targetNodeId: z.string().uuid().describe('Target node ID'),
      edgeType: z.enum(edgeTypes).describe('Relationship type'),
      edgeData: z.record(z.unknown()).optional().describe('Flexible edge properties (context, strength, properties)'),
      weight: z.string().optional().describe('Edge weight 0.00-1.00 (default: 1.00)'),
    },
    async (params) => {
      try {
        const edge = await createEdge(params);
        return { content: [{ type: 'text', text: JSON.stringify(edge, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error creating edge: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    'get_edge',
    'Get an edge by ID with source and target node details',
    {
      id: z.string().uuid().describe('Edge ID'),
    },
    async ({ id }) => {
      try {
        const edge = await getEdge(id);
        if (!edge) {
          return { content: [{ type: 'text', text: 'Edge not found' }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(edge, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error getting edge: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    'delete_edge',
    'Soft-delete an edge (relationship) between two nodes',
    {
      id: z.string().uuid().describe('Edge ID to delete'),
    },
    async ({ id }) => {
      try {
        const edge = await deleteEdge(id);
        if (!edge) {
          return { content: [{ type: 'text', text: 'Edge not found' }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ deleted: true, edge }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error deleting edge: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    'list_edges',
    'List edges for a session, optionally filtered by node ID or edge type',
    {
      sessionId: z.string().uuid().describe('Session ID'),
      nodeId: z.string().uuid().optional().describe('Filter edges connected to this node (source or target)'),
      edgeType: z.enum(edgeTypes).optional().describe('Filter by relationship type'),
      limit: z.number().int().min(1).max(200).optional().describe('Max results (default: 50)'),
      offset: z.number().int().min(0).optional().describe('Pagination offset (default: 0)'),
    },
    async (params) => {
      try {
        const edges = await listEdges(params);
        return { content: [{ type: 'text', text: JSON.stringify({ count: edges.length, edges }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error listing edges: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );
}
