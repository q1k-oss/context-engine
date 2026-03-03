#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerNodeTools } from './tools/node-tools.js';
import { registerEdgeTools } from './tools/edge-tools.js';
import { registerGraphTools } from './tools/graph-tools.js';
import { registerAliasTools } from './tools/alias-tools.js';

const server = new McpServer({
  name: 'context-engine',
  version: '0.1.0',
});

// Register all tool groups
registerNodeTools(server);
registerEdgeTools(server);
registerGraphTools(server);
registerAliasTools(server);

// Start stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
