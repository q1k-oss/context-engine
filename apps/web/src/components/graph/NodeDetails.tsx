'use client';

import { X } from 'lucide-react';
import type { Node } from '@xyflow/react';

interface NodeData {
  label?: string;
  nodeType?: string;
  confidenceScore?: string | number;
  priorityScore?: string | number;
  graphData?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface NodeDetailsProps {
  node: Node;
  onClose: () => void;
}

export function NodeDetails({ node, onClose }: NodeDetailsProps) {
  const data = (node.data || {}) as NodeData;

  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-white dark:bg-gray-800 shadow-lg border-l border-gray-200 dark:border-gray-700 overflow-y-auto z-20">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
        <h3 className="font-semibold truncate">{String(data.label || 'Unknown')}</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Node type */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider">Type</label>
          <div className="mt-1 text-sm">{String(data.nodeType || 'Unknown')}</div>
        </div>

        {/* Confidence score */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider">Confidence</label>
          <div className="mt-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${Number(data.confidenceScore || 0) * 100}%` }}
                />
              </div>
              <span className="text-sm">{(Number(data.confidenceScore || 0) * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Priority score */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider">Priority</label>
          <div className="mt-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${Number(data.priorityScore || 0) * 100}%` }}
                />
              </div>
              <span className="text-sm">{(Number(data.priorityScore || 0) * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Graph data */}
        {data.graphData && Object.keys(data.graphData).length > 0 && (
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Properties</label>
            <div className="mt-1 bg-gray-50 dark:bg-gray-900 rounded p-2">
              <pre className="text-xs overflow-x-auto">
                {JSON.stringify(data.graphData, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider">Created</label>
          <div className="mt-1 text-sm">
            {data.createdAt ? new Date(data.createdAt).toLocaleString() : 'Unknown'}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider">Updated</label>
          <div className="mt-1 text-sm">
            {data.updatedAt ? new Date(data.updatedAt).toLocaleString() : 'Unknown'}
          </div>
        </div>

        {/* Node ID */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider">ID</label>
          <div className="mt-1 text-xs font-mono text-gray-500 break-all">{node.id}</div>
        </div>
      </div>
    </div>
  );
}
