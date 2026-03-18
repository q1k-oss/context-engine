// SDK initializer
export { initContextEngine, getConfig } from './config.js';
export type { ContextEngineConfig } from './config.js';

// App factory
export { createApp } from './app.js';
export type { CreateAppOptions } from './app.js';

// Routes
export { chatRouter } from './routes/chat.routes.js';
export { filesRouter } from './routes/files.routes.js';
export { graphRouter } from './routes/graph.routes.js';

// Middleware
export { errorHandler, AppError } from './middleware/error-handler.js';

// Database
export { getDb } from './db/index.js';
export {
  sessions, messages, knowledgeNodes, knowledgeEdges,
  contextDeltas, graphVersions, nodeAliases, files,
  sessionsRelations, messagesRelations, knowledgeNodesRelations,
  knowledgeEdgesRelations, nodeAliasesRelations, filesRelations,
} from './db/schema/index.js';

// Services
export { chatOrchestratorService } from './services/chat/chat-orchestrator.service.js';
export { fileProcessorService } from './services/files/file-processor.service.js';
export { claudeClientService } from './services/llm/claude-client.service.js';
export { geminiClientService } from './services/llm/gemini-client.service.js';
export { graphBuilderService } from './services/knowledge-graph/graph-builder.service.js';
export { entityExtractorService } from './services/knowledge-graph/entity-extractor.service.js';
export { relationshipInferrerService } from './services/knowledge-graph/relationship-inferrer.service.js';
export { priorityCalculatorService } from './services/knowledge-graph/priority-calculator.service.js';
export { domainExtractorService } from './services/knowledge-graph/domain-extractor.service.js';
export { ageClientService } from './services/graph/age-client.service.js';

// Tools
export { contextEngineTools, nodeTools, edgeTools, graphTools, aliasTools } from './tools/index.js';
export type { ToolDefinition, ToolContext } from './tools/index.js';

// Types (re-export everything from types, which is the canonical source)
export * from './types/index.js';
