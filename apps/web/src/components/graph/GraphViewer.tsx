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
  graphData?: Record<string, unknown>; // Domain properties
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

// Domain node type colors - comprehensive palette
const nodeColors: Record<string, string> = {
  // Core domain entities
  Entity: '#3b82f6',      // blue - business objects
  Attribute: '#60a5fa',   // lighter blue - properties

  // Process/workflow elements
  Process: '#10b981',     // emerald - main processes
  ProcessStep: '#34d399', // lighter emerald - steps

  // Rules and conditions
  Rule: '#ef4444',        // red - constraints
  Condition: '#f87171',   // lighter red - conditions
  Decision: '#f59e0b',    // amber - decision points

  // Enums
  Enum: '#8b5cf6',        // purple - enum types
  EnumValue: '#a78bfa',   // lighter purple - enum values

  // Actors and systems
  Actor: '#ec4899',       // pink - users/roles
  System: '#6366f1',      // indigo - external systems

  // Inputs/Outputs/Triggers
  Trigger: '#f97316',     // orange - triggers
  Input: '#14b8a6',       // teal - inputs
  Output: '#06b6d4',      // cyan - outputs

  // Legacy types (backward compatibility)
  Concept: '#8b5cf6',     // purple
  Event: '#f59e0b',       // amber
  Intent: '#10b981',      // emerald
  Artifact: '#6b7280',    // gray

  // Workflow types
  Goal: '#10b981',
  Task: '#3b82f6',
  Constraint: '#ef4444',
  Resource: '#f59e0b',
  Fact: '#6b7280',
  State: '#8b5cf6',
};

// Node shape categories for visual distinction
const nodeShapes: Record<string, 'circle' | 'rect' | 'diamond' | 'hexagon'> = {
  Entity: 'rect',
  Attribute: 'circle',
  Process: 'hexagon',
  ProcessStep: 'rect',
  Rule: 'diamond',
  Condition: 'diamond',
  Decision: 'diamond',
  Enum: 'hexagon',
  EnumValue: 'circle',
  Actor: 'circle',
  System: 'rect',
  Trigger: 'diamond',
  Input: 'circle',
  Output: 'circle',
};

// Domain edge type colors
const edgeColors: Record<string, string> = {
  // Entity relationships
  HAS_ATTRIBUTE: '#60a5fa',
  REFERENCES: '#3b82f6',
  CONTAINS: '#2563eb',
  HAS_MANY: '#3b82f6',
  BELONGS_TO: '#1d4ed8',
  HAS_TYPE: '#8b5cf6',
  HAS_VALUE: '#a78bfa',
  EXTENDS: '#6366f1',

  // Process relationships
  HAS_STEP: '#10b981',
  NEXT_STEP: '#34d399',
  TRIGGERED_BY: '#f97316',
  REQUIRES_INPUT: '#14b8a6',
  PRODUCES_OUTPUT: '#06b6d4',
  AFFECTS: '#f59e0b',
  CALLS: '#10b981',

  // Actor/System relationships
  PERFORMS: '#ec4899',
  INTEGRATES_WITH: '#6366f1',

  // Rule/Decision relationships
  CONSTRAINS: '#ef4444',
  BRANCHES_TO: '#f59e0b',
  WHEN: '#f87171',

  // Legacy edge types
  RELATES_TO: '#9ca3af',
  CAUSES: '#ef4444',
  DEPENDS_ON: '#f59e0b',
  DECIDED_BY: '#8b5cf6',
  CONSTRAINED_BY: '#ec4899',
  DERIVED_FROM: '#6b7280',
  TEMPORALLY_PRECEDES: '#3b82f6',
};

// Helper to darken/lighten colors
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Group node types for legend
const nodeTypeGroups = {
  'Entities': ['Entity', 'Attribute'],
  'Processes': ['Process', 'ProcessStep', 'Trigger', 'Input', 'Output'],
  'Rules': ['Rule', 'Condition', 'Decision'],
  'Types': ['Enum', 'EnumValue'],
  'Actors': ['Actor', 'System'],
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
      graphData: node.graphData as Record<string, unknown>,
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

      {/* Legend - Collapsible with grouped node types */}
      <div className="absolute top-4 left-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow p-3 max-h-[60vh] overflow-y-auto">
        <div className="text-xs font-medium mb-3 text-gray-700 dark:text-gray-300">Node Types</div>
        <div className="space-y-3">
          {Object.entries(nodeTypeGroups).map(([group, types]) => {
            // Only show groups that have nodes in the current graph
            const relevantTypes = types.filter(t =>
              graphData.nodes.some(n => n.nodeType === t)
            );
            if (relevantTypes.length === 0) return null;

            return (
              <div key={group}>
                <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {group}
                </div>
                <div className="space-y-1 pl-1">
                  {relevantTypes.map((type) => {
                    const shape = nodeShapes[type] || 'circle';
                    const color = nodeColors[type] || '#6b7280';
                    return (
                      <div key={type} className="flex items-center gap-2">
                        {/* Shape indicator */}
                        <svg width="14" height="14" viewBox="0 0 14 14">
                          {shape === 'circle' && (
                            <circle cx="7" cy="7" r="5" fill={color} stroke={adjustColor(color, -50)} strokeWidth="1" />
                          )}
                          {shape === 'rect' && (
                            <rect x="2" y="4" width="10" height="6" rx="1" fill={color} stroke={adjustColor(color, -50)} strokeWidth="1" />
                          )}
                          {shape === 'diamond' && (
                            <polygon points="7,2 12,7 7,12 2,7" fill={color} stroke={adjustColor(color, -50)} strokeWidth="1" />
                          )}
                          {shape === 'hexagon' && (
                            <polygon points="7,2 11,4 11,10 7,12 3,10 3,4" fill={color} stroke={adjustColor(color, -50)} strokeWidth="1" />
                          )}
                        </svg>
                        <span className="text-xs text-gray-600 dark:text-gray-300">{type}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
        <div className="absolute bottom-4 right-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 w-72 max-h-[60vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-2">
            <div className="font-medium text-gray-900 dark:text-gray-100">{selectedNode.name}</div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ×
            </button>
          </div>
          <div
            className="inline-block px-2 py-0.5 rounded text-xs text-white mb-3"
            style={{ backgroundColor: selectedNode.color }}
          >
            {selectedNode.nodeType}
          </div>

          {/* Domain-specific properties */}
          {selectedNode.graphData && Object.keys(selectedNode.graphData).length > 0 && (
            <div className="mb-3 space-y-2">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 border-b pb-1">
                Properties
              </div>
              {Object.entries(selectedNode.graphData).map(([key, value]) => {
                if (value === null || value === undefined) return null;
                return (
                  <div key={key} className="text-xs">
                    <span className="text-gray-500 dark:text-gray-400">{key}:</span>{' '}
                    <span className="text-gray-700 dark:text-gray-300">
                      {typeof value === 'boolean'
                        ? value ? 'Yes' : 'No'
                        : Array.isArray(value)
                        ? value.join(', ')
                        : String(value)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Confidence & Priority */}
          <div className="space-y-2 border-t pt-2">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Confidence</div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${selectedNode.confidenceScore * 100}%` }}
                />
              </div>
              <div className="text-[10px] text-gray-400 text-right mt-0.5">
                {(selectedNode.confidenceScore * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Priority</div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${selectedNode.priorityScore * 100}%` }}
                />
              </div>
              <div className="text-[10px] text-gray-400 text-right mt-0.5">
                {(selectedNode.priorityScore * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Connected edges */}
          {graphData.links.filter(l =>
            (typeof l.source === 'string' ? l.source : (l.source as any).id) === selectedNode.id ||
            (typeof l.target === 'string' ? l.target : (l.target as any).id) === selectedNode.id
          ).length > 0 && (
            <div className="mt-3 pt-2 border-t">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Connections ({graphData.links.filter(l =>
                  (typeof l.source === 'string' ? l.source : (l.source as any).id) === selectedNode.id ||
                  (typeof l.target === 'string' ? l.target : (l.target as any).id) === selectedNode.id
                ).length})
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {graphData.links.filter(l =>
                  (typeof l.source === 'string' ? l.source : (l.source as any).id) === selectedNode.id ||
                  (typeof l.target === 'string' ? l.target : (l.target as any).id) === selectedNode.id
                ).slice(0, 5).map((link, i) => (
                  <div key={i} className="text-[10px] text-gray-500 flex items-center gap-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: link.color }}
                    />
                    <span className="truncate">{link.edgeType.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-3 truncate">
            ID: {selectedNode.id}
          </div>
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
          const size = node.val || 5;
          const shape = nodeShapes[node.nodeType] || 'circle';
          const isHighlighted = selectedNode?.id === node.id || hoveredNode?.id === node.id;

          ctx.beginPath();

          // Draw different shapes based on node type
          switch (shape) {
            case 'rect':
              // Rounded rectangle for entities/systems
              const rectW = size * 2.2;
              const rectH = size * 1.4;
              const radius = 3;
              ctx.moveTo(node.x - rectW / 2 + radius, node.y - rectH / 2);
              ctx.lineTo(node.x + rectW / 2 - radius, node.y - rectH / 2);
              ctx.quadraticCurveTo(node.x + rectW / 2, node.y - rectH / 2, node.x + rectW / 2, node.y - rectH / 2 + radius);
              ctx.lineTo(node.x + rectW / 2, node.y + rectH / 2 - radius);
              ctx.quadraticCurveTo(node.x + rectW / 2, node.y + rectH / 2, node.x + rectW / 2 - radius, node.y + rectH / 2);
              ctx.lineTo(node.x - rectW / 2 + radius, node.y + rectH / 2);
              ctx.quadraticCurveTo(node.x - rectW / 2, node.y + rectH / 2, node.x - rectW / 2, node.y + rectH / 2 - radius);
              ctx.lineTo(node.x - rectW / 2, node.y - rectH / 2 + radius);
              ctx.quadraticCurveTo(node.x - rectW / 2, node.y - rectH / 2, node.x - rectW / 2 + radius, node.y - rectH / 2);
              break;

            case 'diamond':
              // Diamond for decisions/rules/triggers
              const dSize = size * 1.3;
              ctx.moveTo(node.x, node.y - dSize);
              ctx.lineTo(node.x + dSize, node.y);
              ctx.lineTo(node.x, node.y + dSize);
              ctx.lineTo(node.x - dSize, node.y);
              ctx.closePath();
              break;

            case 'hexagon':
              // Hexagon for processes/enums
              const hSize = size * 1.2;
              for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i - Math.PI / 6;
                const px = node.x + hSize * Math.cos(angle);
                const py = node.y + hSize * Math.sin(angle);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
              }
              ctx.closePath();
              break;

            case 'circle':
            default:
              // Circle for attributes/inputs/outputs
              ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
              break;
          }

          // Fill with gradient for depth effect
          const gradient = ctx.createRadialGradient(
            node.x - size / 3, node.y - size / 3, 0,
            node.x, node.y, size * 1.5
          );
          gradient.addColorStop(0, node.color);
          gradient.addColorStop(1, adjustColor(node.color, -30));
          ctx.fillStyle = gradient;
          ctx.fill();

          // Draw border
          ctx.strokeStyle = isHighlighted ? '#000' : adjustColor(node.color, -50);
          ctx.lineWidth = isHighlighted ? 2.5 / globalScale : 1.5 / globalScale;
          ctx.stroke();

          // Draw label
          if (globalScale > 0.5) {
            const label = node.name;
            const fontSize = Math.max(11 / globalScale, 4);
            ctx.font = `${isHighlighted ? 'bold ' : ''}${fontSize}px Inter, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            // Text shadow for readability
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillText(label, node.x + 0.5, node.y + size + 3.5);
            ctx.fillStyle = '#1f2937';
            ctx.fillText(label, node.x, node.y + size + 3);
          }

          // Draw type badge for larger zoom
          if (globalScale > 1.2) {
            const typeLabel = node.nodeType;
            const badgeFontSize = Math.max(8 / globalScale, 3);
            ctx.font = `${badgeFontSize}px Inter, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = '#6b7280';
            ctx.fillText(typeLabel, node.x, node.y - size - 2);
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
