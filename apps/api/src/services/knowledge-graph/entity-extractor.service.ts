import { claudeClientService } from '../llm/claude-client.service.js';
import { domainExtractorService } from './domain-extractor.service.js';
import {
  WorkflowExtractionPrompt,
  ExtractionConfig,
  ValidRelationships,
  isValidNodeType,
  isValidEdgeType,
  isValidRelationship,
  meetsConfidenceThreshold,
  type ExtractedNode,
  type ExtractedEdge,
  type WorkflowExtractionResult,
  type WorkflowNodeType,
  type WorkflowEdgeType,
  type DomainGraph,
} from '@context-engine/shared';

/**
 * Workflow-Focused Entity Extractor Service
 * Conservative extraction for accurate context graphs
 */
export const entityExtractorService = {
  /**
   * Extract workflow elements from a message using conservative rules
   */
  async extractWorkflow(
    content: string,
    existingNodes: Array<{ name: string; type: string }>,
    conversationContext?: string
  ): Promise<WorkflowExtractionResult> {
    // Build the extraction prompt with context
    const existingNodesList = existingNodes.length > 0
      ? `\nEXISTING NODES IN GRAPH:\n${existingNodes.map(n => `- ${n.name} (${n.type})`).join('\n')}`
      : '\nNo existing nodes in graph yet.';

    const contextSection = conversationContext
      ? `\nCONVERSATION CONTEXT:\n${conversationContext}`
      : '';

    const fullPrompt = `${WorkflowExtractionPrompt}
${existingNodesList}
${contextSection}

MESSAGE TO ANALYZE:
"${content}"

Extract ONLY what is explicitly stated. Return JSON:`;

    try {
      const response = await claudeClientService.createCompletion({
        systemPrompt: 'You are a precise extraction system. Output only valid JSON.',
        messages: [{ role: 'user', content: fullPrompt }],
        relevantNodes: [],
        relevantEdges: [],
      });

      // Parse the JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { nodes: [], edges: [] };
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        nodes?: Array<{
          name: string;
          type: string;
          confidence: number;
          source: string;
          properties?: Record<string, unknown>;
        }>;
        edges?: Array<{
          from: string;
          to: string;
          type: string;
          confidence: number;
          source: string;
        }>;
      };

      // Validate and filter nodes
      const validNodes = this.validateNodes(parsed.nodes || [], existingNodes);

      // Validate and filter edges
      const validEdges = this.validateEdges(parsed.edges || [], validNodes, existingNodes);

      return {
        nodes: validNodes,
        edges: validEdges,
      };
    } catch (error) {
      console.error('Workflow extraction failed:', error);
      return { nodes: [], edges: [] };
    }
  },

  /**
   * Validate extracted nodes against schema and confidence thresholds
   */
  validateNodes(
    nodes: Array<{
      name: string;
      type: string;
      confidence: number;
      source: string;
      properties?: Record<string, unknown>;
    }>,
    existingNodes: Array<{ name: string; type: string }>
  ): ExtractedNode[] {
    const validated: ExtractedNode[] = [];
    const existingNames = new Set(existingNodes.map(n => n.name.toLowerCase()));

    for (const node of nodes) {
      // Check confidence threshold
      if (!meetsConfidenceThreshold(node.confidence)) {
        continue;
      }

      // Validate node type
      if (!isValidNodeType(node.type)) {
        continue;
      }

      // Check for duplicates (fuzzy match)
      const nameLower = node.name.toLowerCase();
      if (existingNames.has(nameLower)) {
        continue;
      }

      // Check if source quote is provided (required for conservative extraction)
      if (!node.source || node.source.trim().length === 0) {
        continue;
      }

      // Limit extractions per message
      if (validated.length >= ExtractionConfig.maxEntitiesPerMessage) {
        break;
      }

      validated.push({
        name: node.name,
        type: node.type as WorkflowNodeType,
        confidence: node.confidence,
        source: node.source,
        properties: node.properties,
      });
    }

    return validated;
  },

  /**
   * Validate extracted edges against schema and relationship rules
   */
  validateEdges(
    edges: Array<{
      from: string;
      to: string;
      type: string;
      confidence: number;
      source: string;
    }>,
    newNodes: ExtractedNode[],
    existingNodes: Array<{ name: string; type: string }>
  ): ExtractedEdge[] {
    const validated: ExtractedEdge[] = [];

    // Build a map of all nodes (existing + new)
    const allNodes = new Map<string, WorkflowNodeType>();
    for (const node of existingNodes) {
      if (isValidNodeType(node.type)) {
        allNodes.set(node.name.toLowerCase(), node.type as WorkflowNodeType);
      }
    }
    for (const node of newNodes) {
      allNodes.set(node.name.toLowerCase(), node.type);
    }

    for (const edge of edges) {
      // Check confidence threshold
      if (!meetsConfidenceThreshold(edge.confidence, true)) {
        continue;
      }

      // Validate edge type
      if (!isValidEdgeType(edge.type)) {
        continue;
      }

      // Check if both nodes exist
      const fromType = allNodes.get(edge.from.toLowerCase());
      const toType = allNodes.get(edge.to.toLowerCase());

      if (!fromType || !toType) {
        continue;
      }

      // Validate relationship is allowed by schema
      if (!isValidRelationship(edge.type as WorkflowEdgeType, fromType, toType)) {
        continue;
      }

      // Check if source quote is provided
      if (!edge.source || edge.source.trim().length === 0) {
        continue;
      }

      // Limit relationships per message
      if (validated.length >= ExtractionConfig.maxRelationshipsPerMessage) {
        break;
      }

      validated.push({
        from: edge.from,
        to: edge.to,
        type: edge.type as WorkflowEdgeType,
        confidence: edge.confidence,
        source: edge.source,
      });
    }

    return validated;
  },

  /**
   * Legacy extract method for backward compatibility
   * Maps to new workflow extraction
   */
  async extract(
    content: string,
    existingNodes: Array<{ name: string; type: string }>
  ): Promise<{
    entities: Array<{ name: string; confidence: number; properties: Record<string, unknown> }>;
    concepts: Array<{ name: string; confidence: number; properties: Record<string, unknown> }>;
    events: Array<{ name: string; confidence: number; properties: Record<string, unknown> }>;
    intents: Array<{ name: string; confidence: number; properties: Record<string, unknown> }>;
    decisions: Array<{ name: string; confidence: number; properties: Record<string, unknown> }>;
    artifacts: Array<{ name: string; confidence: number; properties: Record<string, unknown> }>;
  }> {
    const workflow = await this.extractWorkflow(content, existingNodes);

    // Map workflow nodes to legacy format
    const result = {
      entities: [] as Array<{ name: string; confidence: number; properties: Record<string, unknown> }>,
      concepts: [] as Array<{ name: string; confidence: number; properties: Record<string, unknown> }>,
      events: [] as Array<{ name: string; confidence: number; properties: Record<string, unknown> }>,
      intents: [] as Array<{ name: string; confidence: number; properties: Record<string, unknown> }>,
      decisions: [] as Array<{ name: string; confidence: number; properties: Record<string, unknown> }>,
      artifacts: [] as Array<{ name: string; confidence: number; properties: Record<string, unknown> }>,
    };

    for (const node of workflow.nodes) {
      const mapped = {
        name: node.name,
        confidence: node.confidence,
        properties: {
          source: node.source,
          workflowType: node.type,
          ...node.properties,
        },
      };

      // Map workflow types to legacy types
      switch (node.type) {
        case 'Goal':
        case 'Task':
          result.intents.push(mapped);
          break;
        case 'Decision':
          result.decisions.push(mapped);
          break;
        case 'Constraint':
        case 'Fact':
          result.concepts.push(mapped);
          break;
        case 'Resource':
          result.entities.push(mapped);
          break;
        case 'State':
          result.events.push(mapped);
          break;
      }
    }

    return result;
  },

  /**
   * Extract intents from user messages (workflow-aware)
   */
  async extractIntents(
    userMessage: string
  ): Promise<Array<{ name: string; confidence: number; properties: Record<string, unknown> }>> {
    // Use workflow extraction for more accurate intent detection
    const workflow = await this.extractWorkflow(userMessage, []);

    const intents: Array<{ name: string; confidence: number; properties: Record<string, unknown> }> = [];

    // Extract goals and tasks as intents
    for (const node of workflow.nodes) {
      if (node.type === 'Goal' || node.type === 'Task') {
        intents.push({
          name: node.name,
          confidence: node.confidence,
          properties: {
            type: node.type.toLowerCase(),
            source: node.source,
            ...node.properties,
          },
        });
      }
    }

    return intents;
  },

  /**
   * Extract decisions from assistant messages (workflow-aware)
   */
  async extractDecisions(
    assistantMessage: string
  ): Promise<Array<{ name: string; confidence: number; properties: Record<string, unknown> }>> {
    // Use workflow extraction for more accurate decision detection
    const workflow = await this.extractWorkflow(assistantMessage, []);

    const decisions: Array<{ name: string; confidence: number; properties: Record<string, unknown> }> = [];

    // Extract decisions
    for (const node of workflow.nodes) {
      if (node.type === 'Decision') {
        decisions.push({
          name: node.name,
          confidence: node.confidence,
          properties: {
            type: 'decision',
            source: node.source,
            ...node.properties,
          },
        });
      }
    }

    return decisions;
  },

  /**
   * Get the workflow extraction result directly
   * Use this for new code
   */
  async extractForWorkflow(
    content: string,
    existingNodes: Array<{ name: string; type: string }>,
    conversationContext?: string
  ): Promise<WorkflowExtractionResult> {
    return this.extractWorkflow(content, existingNodes, conversationContext);
  },

  /**
   * Extract comprehensive domain knowledge from documentation
   * Use this for detailed specifications, requirements, or documentation
   */
  async extractDomainKnowledge(
    documentation: string,
    domainName?: string
  ): Promise<DomainGraph> {
    return domainExtractorService.extractDomainGraph(documentation, domainName);
  },

  /**
   * Determine if content should use domain extraction (longer/structured) vs workflow extraction
   */
  shouldUseDomainExtraction(content: string): boolean {
    // Use domain extraction for longer content (likely documentation)
    const wordCount = content.split(/\s+/).length;
    if (wordCount > 300) return true;

    // Use domain extraction if content has structured markers
    const structuredMarkers = [
      'entity:', 'entities:', 'entity -', 'entity:',
      'process:', 'workflow:', 'step ', 'steps:',
      'attribute:', 'attributes:', 'property:', 'properties:',
      'rule:', 'rules:', 'constraint:', 'constraints:',
      'enum:', 'status:', 'state:', 'states:',
      '1.', '2.', '3.', // numbered lists
      '- ', '* ', // bullet points
    ];

    const lowerContent = content.toLowerCase();
    const markerCount = structuredMarkers.filter(m => lowerContent.includes(m)).length;

    return markerCount >= 3;
  },

  /**
   * Smart extraction - automatically chooses between workflow and domain extraction
   */
  async smartExtract(
    content: string,
    existingNodes: Array<{ name: string; type: string }>,
    conversationContext?: string,
    domainName?: string
  ): Promise<WorkflowExtractionResult | DomainGraph> {
    if (this.shouldUseDomainExtraction(content)) {
      console.log('Using domain extraction for comprehensive analysis');
      return this.extractDomainKnowledge(content, domainName);
    } else {
      console.log('Using workflow extraction for conversational content');
      return this.extractWorkflow(content, existingNodes, conversationContext);
    }
  },
};
