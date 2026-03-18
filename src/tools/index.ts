import { z } from 'zod';
import { nodeTools } from './node-tools.js';
import { edgeTools } from './edge-tools.js';
import { graphTools } from './graph-tools.js';
import { aliasTools } from './alias-tools.js';

/**
 * Context passed to tool execution from the hosting platform.
 * When integrated into a controlplane, this carries tenant/conversation scoping.
 */
export interface ToolContext {
  /** Tenant ID for multi-tenant isolation */
  tenantId?: string;
  /** Conversation ID for session binding */
  conversationId?: string;
  /** Agent ID if executed by a specific agent */
  agentId?: string;
  /** Arbitrary additional context from the host platform */
  [key: string]: unknown;
}

export interface ToolDefinition {
  /** Tool name (e.g. 'create_node') */
  name: string;
  /** Short description of what the tool does */
  description: string;
  /** Optional longer description for LLM prompts */
  promptDescription?: string;
  /** Zod schema defining the tool's input parameters */
  parameters: z.ZodObject<any>;
  /** Execute the tool with validated input and optional platform context */
  execute: (input: Record<string, unknown>, context?: ToolContext) => Promise<unknown>;
}

/**
 * All Context Engine tools combined.
 * Import and register these directly with any LLM tool-use system.
 *
 * ```ts
 * import { contextEngineTools } from '@q1k-oss/context-engine/tools';
 * ```
 */
export const contextEngineTools: ToolDefinition[] = [
  ...nodeTools,
  ...edgeTools,
  ...graphTools,
  ...aliasTools,
];

export { nodeTools } from './node-tools.js';
export { edgeTools } from './edge-tools.js';
export { graphTools } from './graph-tools.js';
export { aliasTools } from './alias-tools.js';
