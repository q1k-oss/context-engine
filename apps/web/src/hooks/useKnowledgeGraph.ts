'use client';

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface GraphNode {
  id: string;
  nodeType: string;
  name: string;
  graphData: Record<string, unknown>;
  confidenceScore: number;
  priorityScore: number;
}

interface GraphEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
  weight: number;
}

interface KnowledgeGraph {
  sessionId: string;
  version: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface UseKnowledgeGraphReturn {
  graph: KnowledgeGraph | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching and managing the knowledge graph
 */
export function useKnowledgeGraph(sessionId: string): UseKnowledgeGraphReturn {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.getGraph(sessionId);
      if (data.success && data.data.graph) {
        setGraph(data.data.graph);
      } else {
        setError(data.error?.message || 'Failed to fetch graph');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch graph');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    graph,
    isLoading,
    error,
    refresh,
  };
}

interface Delta {
  id: string;
  versionFrom: number;
  versionTo: number;
  createdAt: string;
  summary: string;
  statistics: {
    additions: number;
    modifications: number;
    removals: number;
  };
}

interface UseEvolutionTimelineReturn {
  deltas: Delta[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching context evolution timeline
 */
export function useEvolutionTimeline(sessionId: string): UseEvolutionTimelineReturn {
  const [deltas, setDeltas] = useState<Delta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.getDeltas(sessionId);
      if (data.success && data.data.deltas) {
        setDeltas(data.data.deltas);
      } else {
        setError(data.error?.message || 'Failed to fetch deltas');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch deltas');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    deltas,
    isLoading,
    error,
    refresh,
  };
}
