// ============================================================
// @dabzse/omnigit-webview-ui — SVG Graph Renderer
//
// Renders the commit graph as an SVG with:
//   - Colored lane lines (edges)
//   - Circular commit nodes
//   - Bezier curves for merge/branch connections
// ============================================================

import type { GraphData, GraphEdge, GraphNode } from '@dabzse/omnigit-core';

const LANE_COLORS = [
  'var(--og-lane-0)', 'var(--og-lane-1)', 'var(--og-lane-2)', 'var(--og-lane-3)',
  'var(--og-lane-4)', 'var(--og-lane-5)', 'var(--og-lane-6)', 'var(--og-lane-7)',
  'var(--og-lane-8)', 'var(--og-lane-9)', 'var(--og-lane-10)', 'var(--og-lane-11)',
  'var(--og-lane-12)', 'var(--og-lane-13)', 'var(--og-lane-14)', 'var(--og-lane-15)',
];

interface GraphRendererOptions {
  /** Width per lane column. */
  laneWidth?: number;
  /** Height per commit row. */
  rowHeight?: number;
  /** Radius of commit node circles. */
  nodeRadius?: number;
  /** Left padding for the graph. */
  paddingLeft?: number;
  /** Top padding. */
  paddingTop?: number;
}

const DEFAULTS: Required<GraphRendererOptions> = {
  laneWidth: 16,
  rowHeight: 26,
  nodeRadius: 4,
  paddingLeft: 12,
  paddingTop: 0,
};

/**
 * Render a graph into an SVG element.
 */
export function renderGraph(
  svgElement: SVGSVGElement,
  graphData: GraphData,
  options: GraphRendererOptions = {},
  onNodeClick?: (hash: string) => void,
): void {
  const opts = { ...DEFAULTS, ...options };
  const { nodes, edges, maxColumns } = graphData;

  // Calculate SVG dimensions
  const width = opts.paddingLeft + maxColumns * opts.laneWidth + opts.laneWidth;
  const height = opts.paddingTop + nodes.length * opts.rowHeight;

  // Clear existing content
  svgElement.innerHTML = '';
  svgElement.setAttribute('width', `${width}`);
  svgElement.setAttribute('height', `${height}`);
  svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);

  // Create groups for layering: edges behind nodes
  const edgeGroup = createSvgElement('g', { class: 'graph-edges' });
  const nodeGroup = createSvgElement('g', { class: 'graph-nodes' });

  svgElement.appendChild(edgeGroup);
  svgElement.appendChild(nodeGroup);

  // Render edges
  for (const edge of edges) {
    renderEdge(edgeGroup, edge, opts);
  }

  // Render nodes
  for (const node of nodes) {
    renderNode(nodeGroup, node, opts, onNodeClick);
  }
}

/**
 * Render a single edge (connection between commits).
 */
function renderEdge(
  parent: SVGElement,
  edge: GraphEdge,
  opts: Required<GraphRendererOptions>,
): void {
  const x1 = opts.paddingLeft + edge.fromColumn * opts.laneWidth + opts.laneWidth / 2;
  const y1 = opts.paddingTop + edge.fromRow * opts.rowHeight + opts.rowHeight / 2;
  const x2 = opts.paddingLeft + edge.toColumn * opts.laneWidth + opts.laneWidth / 2;
  const y2 = opts.paddingTop + edge.toRow * opts.rowHeight + opts.rowHeight / 2;

  const color = LANE_COLORS[edge.colorIndex % LANE_COLORS.length];
  let path: string;

  if (x1 === x2) {
    // Straight vertical line
    path = `M ${x1} ${y1} L ${x2} ${y2}`;
  } else {
    // Curved path for merge/branch connections
    // Use cubic bezier for smooth curves
    const midY = (y1 + y2) / 2;

    if (edge.type === 'merge-in') {
      // Curve from the child commit to the merge lane
      // First go straight down, then curve horizontally
      path = `M ${x1} ${y1} L ${x1} ${midY} C ${x1} ${midY + opts.rowHeight * 0.4} ${x2} ${midY + opts.rowHeight * 0.1} ${x2} ${y2}`;
    } else if (edge.type === 'branch-out') {
      // Curve from the parent's lane out to the branch lane
      path = `M ${x1} ${y1} C ${x1} ${y1 + opts.rowHeight * 0.4} ${x2} ${midY - opts.rowHeight * 0.1} ${x2} ${y2}`;
    } else {
      // Generic curve
      path = `M ${x1} ${y1} C ${x1} ${midY} ${x2} ${midY} ${x2} ${y2}`;
    }
  }

  const pathElement = createSvgElement('path', {
    d: path,
    class: 'graph-edge',
    stroke: color,
    'stroke-width': '2',
    fill: 'none',
  });

  parent.appendChild(pathElement);
}

/**
 * Render a single commit node (circle).
 */
function renderNode(
  parent: SVGElement,
  node: GraphNode,
  opts: Required<GraphRendererOptions>,
  onNodeClick?: (hash: string) => void,
): void {
  const cx = opts.paddingLeft + node.column * opts.laneWidth + opts.laneWidth / 2;
  const cy = opts.paddingTop + node.row * opts.rowHeight + opts.rowHeight / 2;
  const color = LANE_COLORS[node.colorIndex % LANE_COLORS.length];

  // Outer ring (highlight on hover/select)
  const ring = createSvgElement('circle', {
    cx: `${cx}`,
    cy: `${cy}`,
    r: `${opts.nodeRadius + 3}`,
    class: 'graph-node-ring',
    stroke: color,
    'data-hash': node.hash,
  });

  // Main node circle
  const circle = createSvgElement('circle', {
    cx: `${cx}`,
    cy: `${cy}`,
    r: `${opts.nodeRadius}`,
    class: 'graph-node',
    fill: color,
    stroke: 'var(--og-bg)',
    'stroke-width': '1.5',
    'data-hash': node.hash,
  });

  if (onNodeClick) {
    circle.style.cursor = 'pointer';
    circle.addEventListener('click', () => onNodeClick(node.hash));
  }

  parent.appendChild(ring);
  parent.appendChild(circle);
}

// SVG Helpers

function createSvgElement(
  tag: string,
  attrs: Record<string, string> = {},
): SVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

/**
 * Highlight a specific node in the graph.
 */
export function highlightNode(svgElement: SVGSVGElement, hash: string): void {
  // Remove previous highlights
  svgElement.querySelectorAll('.graph-node-ring.active').forEach((el) => {
    el.classList.remove('active');
  });

  // Add highlight to selected node
  const ring = svgElement.querySelector(`.graph-node-ring[data-hash="${hash}"]`);
  if (ring) {
    ring.classList.add('active');
  }
}
