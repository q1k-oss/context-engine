import { claudeClientService } from '../llm/claude-client.service.js';
import {
  DomainExtractionPrompt,
  DomainNodeTypes,
  DomainEdgeTypes,
  isDomainNodeType,
  isDomainEdgeType,
  isValidDomainRelationship,
  type DomainNode,
  type DomainEdge,
  type DomainGraph,
  type DomainNodeType,
  type DomainEdgeType,
} from '../../types/index.js';

/**
 * Domain Extractor Service
 * Extracts rich domain models from documentation/specifications
 */
export const domainExtractorService = {
  /**
   * Extract a complete domain graph from documentation
   */
  async extractDomainGraph(
    documentation: string,
    domainName?: string
  ): Promise<DomainGraph> {
    const prompt = `${DomainExtractionPrompt}

---

DOCUMENTATION TO ANALYZE:
${documentation}

---

Extract the complete domain model. Return ONLY valid JSON.`;

    try {
      const response = await claudeClientService.createCompletion({
        systemPrompt: 'You are a domain modeling expert. Extract comprehensive knowledge graphs from documentation. Output only valid JSON.',
        messages: [{ role: 'user', content: prompt }],
        relevantNodes: [],
        relevantEdges: [],
      });

      // Parse the JSON response - handle potential malformed JSON from Claude
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in response');
        return { nodes: [], edges: [] };
      }

      let jsonStr = jsonMatch[0];

      // Try to fix common JSON issues from LLM responses
      // Remove trailing commas before ] or }
      jsonStr = jsonStr.replace(/,(\s*[\]}])/g, '$1');
      // Remove comments
      jsonStr = jsonStr.replace(/\/\/[^\n]*/g, '');
      // Remove markdown code blocks if present
      jsonStr = jsonStr.replace(/```json?\s*/g, '').replace(/```\s*/g, '');

      let parsed: {
        nodes?: Array<{
          id: string;
          name: string;
          type: string;
          properties?: Record<string, unknown>;
        }>;
        edges?: Array<{
          from: string;
          to: string;
          type: string;
          properties?: Record<string, unknown>;
        }>;
      };

      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('JSON parse error, attempting recovery...', parseError);
        // Try more aggressive cleanup
        jsonStr = jsonStr
          .replace(/[\x00-\x1F\x7F]/g, ' ') // Remove control characters
          .replace(/\n\s*\n/g, '\n') // Remove empty lines
          .replace(/,\s*,/g, ',') // Remove double commas
          .replace(/\[\s*,/g, '[') // Remove leading commas in arrays
          .replace(/,\s*\]/g, ']'); // Remove trailing commas in arrays

        try {
          parsed = JSON.parse(jsonStr);
        } catch (e) {
          console.error('JSON recovery failed:', e);
          return { nodes: [], edges: [] };
        }
      }

      // Validate nodes
      const validNodes = this.validateNodes(parsed.nodes || []);

      // Validate edges
      const validEdges = this.validateEdges(parsed.edges || [], validNodes);

      return {
        nodes: validNodes,
        edges: validEdges,
        metadata: {
          domain: domainName || 'Unknown',
          extractedAt: new Date(),
          version: '1.0',
        },
      };
    } catch (error) {
      console.error('Domain extraction failed:', error);
      return { nodes: [], edges: [] };
    }
  },

  /**
   * Extract entities only from documentation
   */
  async extractEntities(documentation: string): Promise<DomainNode[]> {
    const prompt = `Extract ALL entities (business objects, data structures) from this documentation.

For each entity, include:
- All attributes with data types
- Primary keys and foreign keys
- Relationships to other entities

OUTPUT FORMAT (JSON):
{
  "entities": [
    {
      "id": "entity_name_lowercase",
      "name": "EntityName",
      "type": "Entity",
      "attributes": [
        {"name": "attr_name", "dataType": "string", "isPK": false, "isFK": false, "description": "..."}
      ]
    }
  ]
}

DOCUMENTATION:
${documentation}

Return ONLY valid JSON.`;

    try {
      const response = await claudeClientService.createCompletion({
        systemPrompt: 'Extract entities from documentation. Output only valid JSON.',
        messages: [{ role: 'user', content: prompt }],
        relevantNodes: [],
        relevantEdges: [],
      });

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      const nodes: DomainNode[] = [];

      for (const entity of parsed.entities || []) {
        // Add entity node
        nodes.push({
          id: entity.id,
          name: entity.name,
          type: 'Entity',
          properties: { description: entity.description },
        });

        // Add attribute nodes
        for (const attr of entity.attributes || []) {
          nodes.push({
            id: `${entity.id}_${attr.name}`,
            name: attr.name,
            type: 'Attribute',
            properties: {
              dataType: attr.dataType,
              isPrimaryKey: attr.isPK,
              isForeignKey: attr.isFK,
              description: attr.description,
            },
          });
        }
      }

      return nodes;
    } catch (error) {
      console.error('Entity extraction failed:', error);
      return [];
    }
  },

  /**
   * Extract processes/workflows from documentation
   */
  async extractProcesses(documentation: string): Promise<{ nodes: DomainNode[]; edges: DomainEdge[] }> {
    const prompt = `Extract ALL processes/workflows from this documentation.

For each process, include:
- Process name and description
- Trigger (what starts it)
- All steps in sequence
- Inputs and outputs
- Decision points and conditions

OUTPUT FORMAT (JSON):
{
  "processes": [
    {
      "id": "process_name",
      "name": "Process Name",
      "trigger": "What triggers this",
      "steps": [
        {"id": "step_1", "name": "Step Name", "sequence": 1, "description": "What happens"}
      ],
      "inputs": ["Input 1", "Input 2"],
      "outputs": ["Output 1"],
      "decisions": [
        {"id": "decision_1", "condition": "If X", "branches": ["step_a", "step_b"]}
      ]
    }
  ]
}

DOCUMENTATION:
${documentation}

Return ONLY valid JSON.`;

    try {
      const response = await claudeClientService.createCompletion({
        systemPrompt: 'Extract processes and workflows from documentation. Output only valid JSON.',
        messages: [{ role: 'user', content: prompt }],
        relevantNodes: [],
        relevantEdges: [],
      });

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { nodes: [], edges: [] };

      const parsed = JSON.parse(jsonMatch[0]);
      const nodes: DomainNode[] = [];
      const edges: DomainEdge[] = [];

      for (const process of parsed.processes || []) {
        // Add process node
        nodes.push({
          id: process.id,
          name: process.name,
          type: 'Process',
          properties: { description: process.description },
        });

        // Add trigger
        if (process.trigger) {
          const triggerId = `trigger_${process.id}`;
          nodes.push({
            id: triggerId,
            name: process.trigger,
            type: 'Trigger',
          });
          edges.push({
            from: process.id,
            to: triggerId,
            type: 'TRIGGERED_BY',
          });
        }

        // Add steps
        let prevStepId: string | null = null;
        for (const step of process.steps || []) {
          nodes.push({
            id: step.id,
            name: step.name,
            type: 'ProcessStep',
            properties: {
              sequence: step.sequence,
              description: step.description,
            },
          });

          edges.push({
            from: process.id,
            to: step.id,
            type: 'HAS_STEP',
          });

          if (prevStepId) {
            edges.push({
              from: prevStepId,
              to: step.id,
              type: 'NEXT_STEP',
            });
          }
          prevStepId = step.id;
        }

        // Add inputs
        for (const input of process.inputs || []) {
          const inputId = `input_${process.id}_${input.replace(/\s+/g, '_').toLowerCase()}`;
          nodes.push({
            id: inputId,
            name: input,
            type: 'Input',
          });
          edges.push({
            from: process.id,
            to: inputId,
            type: 'REQUIRES_INPUT',
          });
        }

        // Add outputs
        for (const output of process.outputs || []) {
          const outputId = `output_${process.id}_${output.replace(/\s+/g, '_').toLowerCase()}`;
          nodes.push({
            id: outputId,
            name: output,
            type: 'Output',
          });
          edges.push({
            from: process.id,
            to: outputId,
            type: 'PRODUCES_OUTPUT',
          });
        }

        // Add decisions
        for (const decision of process.decisions || []) {
          nodes.push({
            id: decision.id,
            name: decision.condition,
            type: 'Decision',
          });

          for (const branch of decision.branches || []) {
            edges.push({
              from: decision.id,
              to: branch,
              type: 'BRANCHES_TO',
            });
          }
        }
      }

      return { nodes, edges };
    } catch (error) {
      console.error('Process extraction failed:', error);
      return { nodes: [], edges: [] };
    }
  },

  /**
   * Extract business rules from documentation
   */
  async extractRules(documentation: string): Promise<DomainNode[]> {
    const prompt = `Extract ALL business rules and constraints from this documentation.

Look for:
- Validation rules
- Constraints
- Business logic conditions
- Required conditions
- Prohibited actions

OUTPUT FORMAT (JSON):
{
  "rules": [
    {
      "id": "rule_name",
      "name": "Rule Name",
      "description": "Full description of the rule",
      "affects": ["EntityOrAttribute it constrains"],
      "condition": "The condition expression"
    }
  ]
}

DOCUMENTATION:
${documentation}

Return ONLY valid JSON.`;

    try {
      const response = await claudeClientService.createCompletion({
        systemPrompt: 'Extract business rules from documentation. Output only valid JSON.',
        messages: [{ role: 'user', content: prompt }],
        relevantNodes: [],
        relevantEdges: [],
      });

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      const nodes: DomainNode[] = [];

      for (const rule of parsed.rules || []) {
        nodes.push({
          id: rule.id,
          name: rule.name,
          type: 'Rule',
          properties: {
            description: rule.description,
            formula: rule.condition,
          },
        });
      }

      return nodes;
    } catch (error) {
      console.error('Rule extraction failed:', error);
      return [];
    }
  },

  /**
   * Validate extracted nodes
   */
  validateNodes(
    nodes: Array<{
      id: string;
      name: string;
      type: string;
      properties?: Record<string, unknown>;
    }>
  ): DomainNode[] {
    const validated: DomainNode[] = [];
    const seenIds = new Set<string>();

    for (const node of nodes) {
      // Skip if no ID or name
      if (!node.id || !node.name) continue;

      // Skip duplicates
      if (seenIds.has(node.id)) continue;
      seenIds.add(node.id);

      // Validate type (default to Entity if invalid)
      const type = isDomainNodeType(node.type) ? node.type as DomainNodeType : 'Entity';

      validated.push({
        id: node.id,
        name: node.name,
        type,
        properties: node.properties as DomainNode['properties'],
      });
    }

    return validated;
  },

  /**
   * Validate extracted edges
   */
  validateEdges(
    edges: Array<{
      from: string;
      to: string;
      type: string;
      properties?: Record<string, unknown>;
    }>,
    nodes: DomainNode[]
  ): DomainEdge[] {
    const validated: DomainEdge[] = [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    for (const edge of edges) {
      // Skip if missing from/to
      if (!edge.from || !edge.to) continue;

      // Check if both nodes exist
      const fromNode = nodeMap.get(edge.from);
      const toNode = nodeMap.get(edge.to);

      if (!fromNode || !toNode) continue;

      // Validate edge type (default to REFERENCES if invalid)
      const type = isDomainEdgeType(edge.type) ? edge.type as DomainEdgeType : 'REFERENCES';

      // Check if relationship is valid
      if (!isValidDomainRelationship(type, fromNode.type, toNode.type)) {
        // Try to use a generic relationship
        continue;
      }

      validated.push({
        from: edge.from,
        to: edge.to,
        type,
        properties: edge.properties as DomainEdge['properties'],
      });
    }

    return validated;
  },

  /**
   * Comprehensive extraction - extracts everything in one call
   * Best for complete documentation analysis
   */
  async extractComprehensive(
    documentation: string,
    domainName?: string
  ): Promise<DomainGraph> {
    // For large documents, do comprehensive extraction
    return this.extractDomainGraph(documentation, domainName);
  },
};
