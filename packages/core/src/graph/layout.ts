// ============================================================
// @dabzse/omnigit-core — Graph Layout Algorithm
//
// Assigns lane (column) positions to commits for rendering
// the git graph. Uses a "swimming lanes" approach:
//
//   1. Walk commits in topological order (date-ordered).
//   2. Each active branch occupies a lane (column).
//   3. When a commit is encountered:
//      a. If it continues an existing lane, stay in that lane.
//      b. If it's a merge, the merged-in lane is freed.
//      c. If it's a branch point, allocate a new lane.
//   4. Edges connect child → parent with routing info.
//
// This algorithm handles:
//   - Linear histories
//   - Branches and merges (including octopus merges)
//   - Detached commits
//   - Multiple root commits
// ============================================================

import type { Commit, CommitHash, GraphData, GraphEdge, GraphNode } from './types.js';

// Color Palette

/** Default branch colors — vibrant, distinguishable palette. */
export const GRAPH_COLORS = [
  '#4fc3f7', // light blue
  '#81c784', // green
  '#ff8a65', // orange
  '#ba68c8', // purple
  '#4dd0e1', // cyan
  '#fff176', // yellow
  '#f06292', // pink
  '#a1887f', // brown
  '#90a4ae', // blue grey
  '#aed581', // light green
  '#ffb74d', // amber
  '#7986cb', // indigo
  '#e57373', // red
  '#26c6da', // teal
  '#9575cd', // deep purple
  '#dce775', // lime
];

// Layout Engine

interface LaneState {
  /** The next expected commit hash for each active lane. */
  lanes: (CommitHash | null)[];
}

/**
 * Compute the graph layout for a list of commits.
 *
 * @param commits - Commits in topological order (newest first,
 *   as returned by `git log --date-order`).
 * @returns GraphData with nodes, edges, and lane count.
 */
export function computeGraphLayout(commits: readonly Commit[]): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Map from commit hash to its row index for quick lookup
  const hashToRow = new Map<CommitHash, number>();
  commits.forEach((c, i) => hashToRow.set(c.hash, i));

  // Active lanes: each slot holds the commit hash that this
  // lane is "waiting for" (i.e. the next expected parent).
  // null means the lane is free.
  const state: LaneState = { lanes: [] };

  // Track which color index each lane uses
  const laneColors: number[] = [];
  let nextColorIndex = 0;

  for (let row = 0; row < commits.length; row++) {
    const commit = commits[row];
    let column = state.lanes.indexOf(commit.hash);

    if (column === -1) {
      column = findFreeLane(state);
      if (column === state.lanes.length) {
        state.lanes.push(null);
        laneColors.push(nextColorIndex++ % GRAPH_COLORS.length);
      }
    }

    const colorIndex = laneColors[column];

    nodes.push({
      hash: commit.hash,
      column,
      row,
      colorIndex,
    });

    processCommitParents(commit, {
      row,
      column,
      hashToRow,
      state,
      laneColors,
      onNewLane: () => {
        laneColors.push(nextColorIndex++ % GRAPH_COLORS.length);
      },
      edges,
    });

    compactLanes(state, laneColors);
  }

  updateEdgeColumns(edges, nodes);

  const maxColumns = nodes.length > 0
    ? Math.max(...nodes.map((n) => n.column)) + 1
    : 1;

  return {
    nodes,
    edges,
    commits,
    maxColumns,
  };
}

// Helpers

interface LayoutContext {
  row: number;
  column: number;
  hashToRow: Map<CommitHash, number>;
  state: LaneState;
  laneColors: number[];
  onNewLane: () => void;
  edges: GraphEdge[];
}

function processCommitParents(commit: Commit, ctx: LayoutContext): void {
  const { hash, parents } = commit;
  const { column, row, hashToRow, state, laneColors, onNewLane, edges } = ctx;

  if (parents.length === 0) {
    state.lanes[column] = null;
    return;
  }

  const firstParent = parents[0];
  state.lanes[column] = firstParent;

  edges.push({
    from: hash,
    to: firstParent,
    fromColumn: column,
    toColumn: column,
    fromRow: row,
    toRow: hashToRow.get(firstParent) ?? row + 1,
    colorIndex: laneColors[column],
    type: 'straight',
  });

  for (let p = 1; p < parents.length; p++) {
    const parentHash = parents[p];
    let parentLane = state.lanes.indexOf(parentHash);

    if (parentLane === -1) {
      parentLane = findFreeLane(state);
      if (parentLane === state.lanes.length) {
        state.lanes.push(null);
        onNewLane();
      }
      state.lanes[parentLane] = parentHash;
    }

    edges.push({
      from: hash,
      to: parentHash,
      fromColumn: column,
      toColumn: parentLane,
      fromRow: row,
      toRow: hashToRow.get(parentHash) ?? row + 1,
      colorIndex: laneColors[parentLane],
      type: 'merge-in',
    });
  }
}

function updateEdgeColumns(edges: GraphEdge[], nodes: GraphNode[]): void {
  const hashToColumn = new Map<CommitHash, number>();
  for (const node of nodes) {
    hashToColumn.set(node.hash, node.column);
  }

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const actualToColumn = hashToColumn.get(edge.to);
    if (actualToColumn !== undefined && actualToColumn !== edge.toColumn) {
      let type: GraphEdge['type'] = 'straight';
      if (edge.fromColumn < actualToColumn) {
        type = 'branch-out';
      } else if (edge.fromColumn > actualToColumn) {
        type = 'merge-in';
      }

      edges[i] = {
        ...edge,
        toColumn: actualToColumn,
        type,
      };
    }
  }
}

/**
 * Find the first free (null) lane, or return the index past
 * the end to indicate a new lane is needed.
 */
function findFreeLane(state: LaneState): number {
  const idx = state.lanes.indexOf(null);
  return idx === -1 ? state.lanes.length : idx;
}

/**
 * Remove trailing null lanes to keep the graph compact.
 * We only remove from the end to avoid shifting column indices.
 */
function compactLanes(state: LaneState, laneColors: number[]): void {
  while (state.lanes.length > 0 && state.lanes.at(-1) === null) {
    state.lanes.pop();
    laneColors.pop();
  }
}
