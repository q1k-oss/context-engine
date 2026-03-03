import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { addAlias, listAliases } from '../operations/alias-ops.js';

export function registerAliasTools(server: McpServer) {
  server.tool(
    'add_alias',
    'Add an alternative name (alias) for a knowledge node — used for entity resolution and deduplication',
    {
      sessionId: z.string().uuid().describe('Session ID'),
      nodeId: z.string().uuid().describe('Node ID to add the alias to'),
      alias: z.string().min(1).describe('Alternative name for the node'),
    },
    async (params) => {
      try {
        const alias = await addAlias(params);
        return { content: [{ type: 'text', text: JSON.stringify(alias, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error adding alias: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    'list_aliases',
    'List or search aliases for a node or across a session',
    {
      sessionId: z.string().uuid().describe('Session ID'),
      nodeId: z.string().uuid().optional().describe('Filter aliases for a specific node'),
      search: z.string().optional().describe('Search pattern to filter aliases'),
      limit: z.number().int().min(1).max(500).optional().describe('Max results (default: 100)'),
    },
    async (params) => {
      try {
        const aliases = await listAliases(params);
        return { content: [{ type: 'text', text: JSON.stringify({ count: aliases.length, aliases }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error listing aliases: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );
}
