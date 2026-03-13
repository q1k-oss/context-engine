import { z } from 'zod';
import { nodeTools } from './node-tools.js';
import { edgeTools } from './edge-tools.js';
import { graphTools } from './graph-tools.js';
import { aliasTools } from './alias-tools.js';

export interface ToolDefinition {
  /** Tool name (e.g. 'create_node') */
  name: string;
  /** Short description of what the tool does */
  description: string;
  /** Optional longer description for LLM prompts */
  promptDescription?: string;
  /** Zod schema defining the tool's input parameters */
  parameters: z.ZodObject<any>;
  /** Execute the tool with validated input */
  execute: (input: Record<string, unknown>) => Promise<unknown>;
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
