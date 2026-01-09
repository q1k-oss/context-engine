'use client';

import { useMemo, useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useKnowledgeGraph } from '@/hooks/useKnowledgeGraph';
import { NodeDetails } from './NodeDetails';
import { RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';

interface GraphViewerProps {
  sessionId: string;
  version: number;
}

// Node type colors
const nodeColors: Record<string, string> = {
  Entity: '#3b82f6', // blue
  Concept: '#8b5cf6', // purple
  Event: '#f59e0b', // amber
  Intent: '#10b981', // emerald
  Decision: '#ef4444', // red
  Artifact: '#6b7280', // gray
};

// Edge type styles
const edgeStyles: Record<string, { stroke: string; strokeDasharray?: string }> = {
  RELATES_TO: { stroke: '#9ca3af' },
  CAUSES: { stroke: '#ef4444' },
  DEPENDS_ON: { stroke: '#f59e0b' },
  DECIDED_BY: { stroke: '#8b5cf6' },
  CONSTRAINED_BY: { stroke: '#ec4899' },
  DERIVED_FROM: { stroke: '#6b7280', strokeDasharray: '5,5' },
  TEMPORALLY_PRECEDES: { stroke: '#3b82f6', strokeDasharray: '3,3' },
};

export function GraphViewer({ sessionId, version }: GraphViewerProps) {
  const { graph, isLoading, error, refresh } = useKnowledgeGraph(sessionId);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Refresh graph when version changes
  useEffect(() => {
    refresh();
  }, [version, refresh]);

  // Convert graph data to React Flow format
  useEffect(() => {
    if (!graph) return;

    // Position nodes in a grid layout (simple approach)
    const nodeCount = graph.nodes.length;
    const cols = Math.ceil(Math.sqrt(nodeCount));
    const spacing = 200;

    const flowNodes: Node[] = graph.nodes.map((node, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;

      return {
        id: node.id,
        type: 'default',
        position: {
          x: col * spacing + Math.random() * 50,
          y: row * spacing + Math.random() * 50,
        },
        data: {
          ...node,
          label: node.name,
        },
        style: {
          background: nodeColors[node.nodeType] || '#6b7280',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 15px',
          fontSize: '12px',
          fontWeight: 500,
          minWidth: '100px',
          textAlign: 'center' as const,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });

    const flowEdges: Edge[] = graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      type: 'smoothstep',
      animated: edge.edgeType === 'TEMPORALLY_PRECEDES',
      label: edge.edgeType.replace(/_/g, ' ').toLowerCase(),
      labelStyle: { fontSize: '10px', fill: '#6b7280' },
      labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
      style: edgeStyles[edge.edgeType] || { stroke: '#9ca3af' },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 15,
        height: 15,
        color: edgeStyles[edge.edgeType]?.stroke || '#9ca3af',
      },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [graph, setNodes, setEdges]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const closeNodeDetails = useCallback(() => {
    setSelectedNode(null);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading graph...
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

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <div className="text-lg mb-2">No knowledge graph yet</div>
        <p className="text-sm">Start a conversation to build your knowledge graph</p>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow p-3">
        <div className="text-xs font-medium mb-2">Node Types</div>
        <div className="space-y-1">
          {Object.entries(nodeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="absolute top-4 right-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow p-3">
        <div className="text-xs space-y-1">
          <div>Nodes: {graph.nodes.length}</div>
          <div>Edges: {graph.edges.length}</div>
          <div>Version: {graph.version}</div>
        </div>
        <button
          onClick={refresh}
          className="mt-2 text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* React Flow */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        attributionPosition="bottom-right"
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(node) => nodeColors[node.data?.nodeType as string] || '#6b7280'}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>

      {/* Node details panel */}
      {selectedNode && (
        <NodeDetails node={selectedNode} onClose={closeNodeDetails} />
      )}
    </div>
  );
}
