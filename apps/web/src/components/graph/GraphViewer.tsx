'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useKnowledgeGraph } from '@/hooks/useKnowledgeGraph';
import { RefreshCw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

// Dynamic import to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <RefreshCw className="w-6 h-6 animate-spin" />
    </div>
  ),
});

interface GraphViewerProps {
  sessionId: string;
  version: number;
}

interface GraphNode {
  id: string;
  name: string;
  nodeType: string;
  confidenceScore: number;
  priorityScore: number;
  val: number; // Node size
  color: string;
}

interface GraphLink {
  source: string;
  target: string;
  edgeType: string;
  color: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// Node type colors
const nodeColors: Record<string, string> = {
  Entity: '#3b82f6',    // blue
  Concept: '#8b5cf6',   // purple
  Event: '#f59e0b',     // amber
  Intent: '#10b981',    // emerald
  Decision: '#ef4444',  // red
  Artifact: '#6b7280',  // gray
};

// Edge type colors
const edgeColors: Record<string, string> = {
  RELATES_TO: '#9ca3af',
  CAUSES: '#ef4444',
  DEPENDS_ON: '#f59e0b',
  DECIDED_BY: '#8b5cf6',
  CONSTRAINED_BY: '#ec4899',
  DERIVED_FROM: '#6b7280',
  TEMPORALLY_PRECEDES: '#3b82f6',
};

export function GraphViewer({ sessionId, version }: GraphViewerProps) {
  const { graph, isLoading, error, refresh } = useKnowledgeGraph(sessionId);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Refresh graph when version changes
  useEffect(() => {
    refresh();
  }, [version, refresh]);

  // Convert graph data to force graph format
  useEffect(() => {
    if (!graph) return;

    const nodes: GraphNode[] = graph.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      nodeType: node.nodeType,
      confidenceScore: Number(node.confidenceScore),
      priorityScore: Number(node.priorityScore),
      val: 2 + Number(node.priorityScore) * 8, // Size based on priority
      color: nodeColors[node.nodeType] || '#6b7280',
    }));

    const links: GraphLink[] = graph.edges.map((edge) => ({
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      edgeType: edge.edgeType,
      color: edgeColors[edge.edgeType] || '#9ca3af',
    }));

    setGraphData({ nodes, links });
  }, [graph]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    // Center on clicked node
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 1000);
      graphRef.current.zoom(2, 1000);
    }
  }, []);

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node);
    if (containerRef.current) {
      containerRef.current.style.cursor = node ? 'pointer' : 'default';
    }
  }, []);

  const handleZoomIn = () => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() * 1.5, 300);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() / 1.5, 300);
    }
  };

  const handleFitView = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 50);
    }
  };

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
    <div ref={containerRef} className="relative h-full w-full bg-gray-50 dark:bg-gray-900">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleFitView}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Fit to View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={refresh}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow p-3">
        <div className="text-xs font-medium mb-2">Node Types</div>
        <div className="space-y-1">
          {Object.entries(nodeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="absolute bottom-4 left-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow p-3">
        <div className="text-xs space-y-1">
          <div>Nodes: {graph.nodes.length}</div>
          <div>Edges: {graph.edges.length}</div>
          <div>Version: {graph.version}</div>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredNode && (
        <div className="absolute top-20 right-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 max-w-xs">
          <div className="font-medium text-sm">{hoveredNode.name}</div>
          <div className="text-xs text-gray-500 mt-1">{hoveredNode.nodeType}</div>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Confidence:</span>
              <span>{(hoveredNode.confidenceScore * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Priority:</span>
              <span>{(hoveredNode.priorityScore * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Selected node details */}
      {selectedNode && (
        <div className="absolute bottom-4 right-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 w-64">
          <div className="flex justify-between items-start mb-2">
            <div className="font-medium">{selectedNode.name}</div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          <div
            className="inline-block px-2 py-0.5 rounded text-xs text-white mb-2"
            style={{ backgroundColor: selectedNode.color }}
          >
            {selectedNode.nodeType}
          </div>
          <div className="space-y-2 mt-2">
            <div>
              <div className="text-xs text-gray-500">Confidence</div>
              <div className="h-2 bg-gray-200 rounded-full mt-1">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${selectedNode.confidenceScore * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Priority</div>
              <div className="h-2 bg-gray-200 rounded-full mt-1">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${selectedNode.priorityScore * 100}%` }}
                />
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-3 truncate">ID: {selectedNode.id}</div>
        </div>
      )}

      {/* Force Graph */}
      <ForceGraph2D
        ref={graphRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel={(node: any) => node.name}
        nodeColor={(node: any) => node.color}
        nodeVal={(node: any) => node.val}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          // Draw node circle
          const size = node.val || 5;
          ctx.beginPath();
          ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
          ctx.fillStyle = node.color;
          ctx.fill();

          // Draw border for selected/hovered
          if (selectedNode?.id === node.id || hoveredNode?.id === node.id) {
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2 / globalScale;
            ctx.stroke();
          }

          // Draw label if zoomed in enough
          if (globalScale > 0.8) {
            const label = node.name;
            const fontSize = Math.max(10 / globalScale, 3);
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#333';
            ctx.fillText(label, node.x, node.y + size + 2);
          }
        }}
        linkColor={(link: any) => link.color}
        linkWidth={1.5}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.1}
        linkLabel={(link: any) => link.edgeType.replace(/_/g, ' ')}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        cooldownTicks={100}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
      />
    </div>
  );
}
