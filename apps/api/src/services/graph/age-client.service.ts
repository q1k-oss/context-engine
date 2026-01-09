import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/context_engine';

// Create a separate connection for AGE queries
const sql = postgres(connectionString);

/**
 * Apache AGE Client Service
 * Provides Cypher query capabilities for the knowledge graph
 */
export const ageClientService = {
  /**
   * Initialize AGE for the current session
   * Must be called before running Cypher queries
   */
  async initSession(): Promise<void> {
    await sql.unsafe(`
      LOAD 'age';
      SET search_path = ag_catalog, "$user", public;
    `);
  },

  /**
   * Execute a Cypher query and return results
   */
  async executeCypher<T = Record<string, unknown>>(
    cypher: string,
    graphName: string = 'knowledge_graph'
  ): Promise<T[]> {
    await this.initSession();

    const result = await sql.unsafe(`
      SELECT * FROM cypher('${graphName}', $$
        ${cypher}
      $$) as (result agtype);
    `);

    return result.map((row: any) => {
      // AGE returns agtype which needs parsing
      return JSON.parse(row.result) as T;
    });
  },

  /**
   * Create a node in the graph
   */
  async createNode(
    sessionId: string,
    nodeType: string,
    properties: Record<string, unknown>
  ): Promise<{ id: string }> {
    const propsJson = JSON.stringify({ ...properties, sessionId });

    const result = await this.executeCypher<{ id: string }>(`
      CREATE (n:${nodeType} ${propsJson.replace(/"/g, "'")})
      RETURN id(n) as id
    `);

    return result[0] || { id: '' };
  },

  /**
   * Create a relationship between nodes
   */
  async createRelationship(
    sourceId: string,
    targetId: string,
    relationshipType: string,
    properties: Record<string, unknown> = {}
  ): Promise<void> {
    const propsJson = Object.keys(properties).length > 0
      ? JSON.stringify(properties).replace(/"/g, "'")
      : '';

    await this.executeCypher(`
      MATCH (a), (b)
      WHERE id(a) = ${sourceId} AND id(b) = ${targetId}
      CREATE (a)-[:${relationshipType} ${propsJson}]->(b)
    `);
  },

  /**
   * Find nodes by session and optional filters
   */
  async findNodes(
    sessionId: string,
    nodeType?: string,
    limit: number = 100
  ): Promise<Array<{ id: string; labels: string[]; properties: Record<string, unknown> }>> {
    const typeFilter = nodeType ? `:${nodeType}` : '';

    return this.executeCypher(`
      MATCH (n${typeFilter})
      WHERE n.sessionId = '${sessionId}'
      RETURN id(n) as id, labels(n) as labels, properties(n) as properties
      LIMIT ${limit}
    `);
  },

  /**
   * Find relationships for a session
   */
  async findRelationships(
    sessionId: string,
    limit: number = 100
  ): Promise<Array<{
    sourceId: string;
    targetId: string;
    type: string;
    properties: Record<string, unknown>;
  }>> {
    return this.executeCypher(`
      MATCH (a)-[r]->(b)
      WHERE a.sessionId = '${sessionId}'
      RETURN id(a) as sourceId, id(b) as targetId, type(r) as type, properties(r) as properties
      LIMIT ${limit}
    `);
  },

  /**
   * Find shortest path between two nodes
   */
  async findShortestPath(
    startNodeId: string,
    endNodeId: string
  ): Promise<Array<{ nodes: string[]; relationships: string[] }>> {
    return this.executeCypher(`
      MATCH p = shortestPath((a)-[*]-(b))
      WHERE id(a) = ${startNodeId} AND id(b) = ${endNodeId}
      RETURN [n IN nodes(p) | id(n)] as nodes,
             [r IN relationships(p) | type(r)] as relationships
    `);
  },

  /**
   * Get node neighbors (1-hop)
   */
  async getNeighbors(
    nodeId: string,
    direction: 'in' | 'out' | 'both' = 'both'
  ): Promise<Array<{ id: string; labels: string[]; properties: Record<string, unknown>; relationship: string }>> {
    const pattern = direction === 'in'
      ? '<-[r]-'
      : direction === 'out'
        ? '-[r]->'
        : '-[r]-';

    return this.executeCypher(`
      MATCH (n)${pattern}(neighbor)
      WHERE id(n) = ${nodeId}
      RETURN id(neighbor) as id, labels(neighbor) as labels,
             properties(neighbor) as properties, type(r) as relationship
    `);
  },

  /**
   * Find all paths between nodes (up to N hops)
   */
  async findPaths(
    startNodeId: string,
    endNodeId: string,
    maxHops: number = 5
  ): Promise<Array<{ path: string[] }>> {
    return this.executeCypher(`
      MATCH p = (a)-[*1..${maxHops}]-(b)
      WHERE id(a) = ${startNodeId} AND id(b) = ${endNodeId}
      RETURN [n IN nodes(p) | properties(n).name] as path
      LIMIT 10
    `);
  },

  /**
   * Get subgraph for a session (for visualization)
   */
  async getSessionGraph(sessionId: string): Promise<{
    nodes: Array<{ id: string; label: string; type: string; properties: Record<string, unknown> }>;
    edges: Array<{ source: string; target: string; type: string }>;
  }> {
    await this.initSession();

    // Get nodes
    const nodesResult = await this.executeCypher<{
      id: string;
      labels: string[];
      properties: Record<string, unknown>;
    }>(`
      MATCH (n)
      WHERE n.sessionId = '${sessionId}'
      RETURN id(n) as id, labels(n) as labels, properties(n) as properties
    `);

    // Get edges
    const edgesResult = await this.executeCypher<{
      sourceId: string;
      targetId: string;
      type: string;
    }>(`
      MATCH (a)-[r]->(b)
      WHERE a.sessionId = '${sessionId}' AND b.sessionId = '${sessionId}'
      RETURN id(a) as sourceId, id(b) as targetId, type(r) as type
    `);

    return {
      nodes: nodesResult.map((n) => ({
        id: String(n.id),
        label: String(n.properties.name || 'Unknown'),
        type: n.labels[0] || 'Unknown',
        properties: n.properties,
      })),
      edges: edgesResult.map((e) => ({
        source: String(e.sourceId),
        target: String(e.targetId),
        type: e.type,
      })),
    };
  },

  /**
   * Update node priority score
   */
  async updateNodePriority(nodeId: string, priority: number): Promise<void> {
    await this.executeCypher(`
      MATCH (n)
      WHERE id(n) = ${nodeId}
      SET n.priorityScore = ${priority}
    `);
  },

  /**
   * Delete a node and its relationships
   */
  async deleteNode(nodeId: string): Promise<void> {
    await this.executeCypher(`
      MATCH (n)
      WHERE id(n) = ${nodeId}
      DETACH DELETE n
    `);
  },

  /**
   * Get high-priority nodes for context injection
   */
  async getHighPriorityNodes(
    sessionId: string,
    limit: number = 10
  ): Promise<Array<{ id: string; name: string; type: string; priority: number }>> {
    return this.executeCypher(`
      MATCH (n)
      WHERE n.sessionId = '${sessionId}'
      RETURN id(n) as id, n.name as name, labels(n)[0] as type,
             coalesce(n.priorityScore, 0.5) as priority
      ORDER BY n.priorityScore DESC
      LIMIT ${limit}
    `);
  },
};
