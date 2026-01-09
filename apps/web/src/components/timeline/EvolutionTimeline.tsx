'use client';

import { useState } from 'react';
import { useEvolutionTimeline } from '@/hooks/useKnowledgeGraph';
import { Plus, Edit3, Minus, RefreshCw, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { apiClient } from '@/lib/api-client';

interface EvolutionTimelineProps {
  sessionId: string;
}

interface DeltaDetail {
  id: string;
  deltaData: {
    additions?: {
      nodes?: Array<{ name: string; nodeType: string }>;
      edges?: Array<{ edgeType: string }>;
    };
    modifications?: {
      nodes?: Array<{ nodeId: string; changedFields: string[] }>;
      priorities?: Array<{ nodeId: string; previousPriority: number; newPriority: number }>;
    };
    removals?: {
      nodeIds?: string[];
      edgeIds?: string[];
    };
  };
}

export function EvolutionTimeline({ sessionId }: EvolutionTimelineProps) {
  const { deltas, isLoading, error, refresh } = useEvolutionTimeline(sessionId);
  const [expandedDelta, setExpandedDelta] = useState<string | null>(null);
  const [deltaDetails, setDeltaDetails] = useState<Record<string, DeltaDetail>>({});

  const loadDeltaDetails = async (deltaId: string) => {
    if (deltaDetails[deltaId]) return;

    try {
      const result = await apiClient.getDelta(sessionId, deltaId);
      if (result.success && result.data.delta) {
        setDeltaDetails((prev) => ({
          ...prev,
          [deltaId]: result.data.delta,
        }));
      }
    } catch (error) {
      console.error('Failed to load delta details:', error);
    }
  };

  const toggleDelta = (deltaId: string) => {
    if (expandedDelta === deltaId) {
      setExpandedDelta(null);
    } else {
      setExpandedDelta(deltaId);
      loadDeltaDetails(deltaId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading timeline...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        Error: {error}
      </div>
    );
  }

  if (deltas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <div className="text-lg mb-2">No evolution history yet</div>
        <p className="text-sm">Send messages to see how your knowledge graph evolves</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Context Evolution Timeline</h2>
          <button
            onClick={refresh}
            className="text-sm text-blue-500 hover:text-blue-700 flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

          {/* Delta entries */}
          <div className="space-y-4">
            {deltas.map((delta, index) => (
              <div key={delta.id} className="relative">
                {/* Timeline dot */}
                <div className="absolute left-6 -translate-x-1/2 w-3 h-3 bg-blue-500 rounded-full border-2 border-white dark:border-gray-800" />

                {/* Delta card */}
                <div className="ml-12">
                  <button
                    onClick={() => toggleDelta(delta.id)}
                    className="w-full text-left bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        Version {delta.versionFrom} → {delta.versionTo}
                      </span>
                      <ChevronRight
                        className={clsx(
                          'w-4 h-4 transition-transform',
                          expandedDelta === delta.id && 'rotate-90'
                        )}
                      />
                    </div>

                    <div className="text-xs text-gray-500 mb-3">
                      {new Date(delta.createdAt).toLocaleString()}
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4">
                      {delta.statistics.additions > 0 && (
                        <div className="flex items-center gap-1 text-green-600">
                          <Plus className="w-3 h-3" />
                          <span className="text-xs">{delta.statistics.additions} added</span>
                        </div>
                      )}
                      {delta.statistics.modifications > 0 && (
                        <div className="flex items-center gap-1 text-amber-600">
                          <Edit3 className="w-3 h-3" />
                          <span className="text-xs">{delta.statistics.modifications} modified</span>
                        </div>
                      )}
                      {delta.statistics.removals > 0 && (
                        <div className="flex items-center gap-1 text-red-600">
                          <Minus className="w-3 h-3" />
                          <span className="text-xs">{delta.statistics.removals} removed</span>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Expanded details */}
                  {expandedDelta === delta.id && deltaDetails[delta.id] && (() => {
                    const detail = deltaDetails[delta.id];
                    const addedNodes = detail?.deltaData?.additions?.nodes ?? [];
                    const addedEdges = detail?.deltaData?.additions?.edges ?? [];
                    const priorityChanges = detail?.deltaData?.modifications?.priorities ?? [];

                    return (
                      <div className="mt-2 bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-4">
                        {/* Additions */}
                        {addedNodes.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-green-600 mb-2">Added Nodes</h4>
                            <div className="space-y-1">
                              {addedNodes.map((node, i) => (
                                <div
                                  key={i}
                                  className="text-xs bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 px-2 py-1 rounded"
                                >
                                  <span className="font-medium">{node.name}</span>
                                  <span className="text-green-600 ml-2">({node.nodeType})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Modifications */}
                        {priorityChanges.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-amber-600 mb-2">Priority Changes</h4>
                            <div className="space-y-1">
                              {priorityChanges.map((change, i) => (
                                <div
                                  key={i}
                                  className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 px-2 py-1 rounded flex items-center gap-2"
                                >
                                  <span className="font-mono">{change.nodeId.slice(0, 8)}...</span>
                                  <span>
                                    {(change.previousPriority * 100).toFixed(0)}% →{' '}
                                    {(change.newPriority * 100).toFixed(0)}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Edges */}
                        {addedEdges.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-blue-600 mb-2">New Relationships</h4>
                            <div className="flex flex-wrap gap-1">
                              {addedEdges.map((edge, i) => (
                                <span
                                  key={i}
                                  className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-2 py-1 rounded"
                                >
                                  {edge.edgeType.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
