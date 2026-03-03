import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createNode, getNode, updateNode, deleteNode, listNodes, searchNodes } from '../operations/node-ops.js';

export function registerNodeTools(server: McpServer) {
  server.tool(
    'create_node',
    'Insert a knowledge node (Entity/Concept/Event/Intent/Decision/Artifact) into the graph',
    {
      sessionId: z.string().uuid().describe('Session ID to add the node to'),
      nodeType: z.enum(['Entity', 'Concept', 'Event', 'Intent', 'Decision', 'Artifact']).describe('Type of knowledge node'),
      name: z.string().min(1).describe('Name of the node'),
      graphData: z.record(z.unknown()).optional().describe('Flexible JSONB properties (description, aliases, properties, metadata)'),
      confidenceScore: z.string().optional().describe('Confidence score 0.00-1.00 (default: 1.00)'),
      priorityScore: z.string().optional().describe('Priority score 0.00-1.00 (default: 0.50)'),
      sourceMessageId: z.string().uuid().optional().describe('ID of the message that triggered this node creation'),
    },
    async (params) => {
      try {
        const node = await createNode(params);
        return { content: [{ type: 'text', text: JSON.stringify(node, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error creating node: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    'get_node',
    'Get a knowledge node by ID, including its aliases',
    {
      id: z.string().uuid().describe('Node ID'),
    },
    async ({ id }) => {
      try {
        const node = await getNode(id);
        if (!node) {
          return { content: [{ type: 'text', text: 'Node not found' }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(node, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error getting node: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    'update_node',
    'Partial update of a knowledge node — merges graphData and bumps version',
    {
      id: z.string().uuid().describe('Node ID to update'),
      name: z.string().min(1).optional().describe('New name'),
      nodeType: z.enum(['Entity', 'Concept', 'Event', 'Intent', 'Decision', 'Artifact']).optional().describe('New node type'),
      graphData: z.record(z.unknown()).optional().describe('Properties to merge into existing graphData'),
      confidenceScore: z.string().optional().describe('New confidence score 0.00-1.00'),
      priorityScore: z.string().optional().describe('New priority score 0.00-1.00'),
    },
    async ({ id, ...data }) => {
      try {
        const node = await updateNode(id, data);
        if (!node) {
          return { content: [{ type: 'text', text: 'Node not found' }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(node, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error updating node: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    'delete_node',
    'Soft-delete a knowledge node and its connected edges',
    {
      id: z.string().uuid().describe('Node ID to delete'),
    },
    async ({ id }) => {
      try {
        const node = await deleteNode(id);
        if (!node) {
          return { content: [{ type: 'text', text: 'Node not found' }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ deleted: true, node }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error deleting node: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    'list_nodes',
    'List knowledge nodes for a session with optional filters (type, priority) and pagination',
    {
      sessionId: z.string().uuid().describe('Session ID'),
      nodeType: z.enum(['Entity', 'Concept', 'Event', 'Intent', 'Decision', 'Artifact']).optional().describe('Filter by node type'),
      minPriority: z.string().optional().describe('Minimum priority score (e.g. "0.70")'),
      limit: z.number().int().min(1).max(200).optional().describe('Max results (default: 50)'),
      offset: z.number().int().min(0).optional().describe('Pagination offset (default: 0)'),
    },
    async (params) => {
      try {
        const nodes = await listNodes(params);
        return { content: [{ type: 'text', text: JSON.stringify({ count: nodes.length, nodes }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error listing nodes: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    'search_nodes',
    'Full-text search across node names, graphData properties, and aliases',
    {
      sessionId: z.string().uuid().describe('Session ID to search within'),
      query: z.string().min(1).describe('Search query string'),
      limit: z.number().int().min(1).max(200).optional().describe('Max results (default: 50)'),
    },
    async (params) => {
      try {
        const nodes = await searchNodes(params);
        return { content: [{ type: 'text', text: JSON.stringify({ count: nodes.length, nodes }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error searching nodes: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );
}
