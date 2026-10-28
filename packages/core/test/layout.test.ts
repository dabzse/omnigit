import { describe, it, expect } from 'vitest';
import { computeGraphLayout } from '../src/graph/layout.js';
import type { Commit } from '../src/git/types.js';

function makeCommit(hash: string, parents: string[], subject = 'Commit'): Commit {
  return {
    hash,
    shortHash: hash.slice(0, 7),
    parents,
    subject,
    body: '',
    author: { name: 'Dev', email: 'dev@example.com' },
    authorDate: 1700000000,
    committer: { name: 'Dev', email: 'dev@example.com' },
    commitDate: 1700000000,
    refs: [],
  };
}

describe('computeGraphLayout', () => {
  it('handles empty commit list', () => {
    const layout = computeGraphLayout([]);
    expect(layout.nodes).toHaveLength(0);
    expect(layout.edges).toHaveLength(0);
    expect(layout.maxColumns).toBe(1);
  });

  it('lays out a linear history in a single lane', () => {
    const commits: Commit[] = [
      makeCommit('c3', ['c2'], 'Commit 3'),
      makeCommit('c2', ['c1'], 'Commit 2'),
      makeCommit('c1', [], 'Initial commit'),
    ];

    const layout = computeGraphLayout(commits);

    expect(layout.nodes).toHaveLength(3);
    expect(layout.nodes[0].column).toBe(0);
    expect(layout.nodes[1].column).toBe(0);
    expect(layout.nodes[2].column).toBe(0);

    expect(layout.edges).toHaveLength(2);
    expect(layout.edges[0]).toMatchObject({
      from: 'c3',
      to: 'c2',
      fromColumn: 0,
      toColumn: 0,
      type: 'straight',
    });
    expect(layout.edges[1]).toMatchObject({
      from: 'c2',
      to: 'c1',
      fromColumn: 0,
      toColumn: 0,
      type: 'straight',
    });
    expect(layout.maxColumns).toBe(1);
  });

  it('allocates a new lane for a branch and routes merge', () => {
    // History:
    // c4 (merge c2 and c3)
    // c3 (branch feat, parent c1)
    // c2 (main branch, parent c1)
    // c1 (root)
    const commits: Commit[] = [
      makeCommit('c4', ['c2', 'c3'], 'Merge branch feat'),
      makeCommit('c3', ['c1'], 'Feat commit'),
      makeCommit('c2', ['c1'], 'Main commit'),
      makeCommit('c1', [], 'Initial commit'),
    ];

    const layout = computeGraphLayout(commits);

    expect(layout.nodes).toHaveLength(4);
    // c4 is on column 0
    expect(layout.nodes[0].hash).toBe('c4');
    expect(layout.nodes[0].column).toBe(0);

    // c4 has 2 parents: c2 stays on col 0, c3 occupies col 1
    const mergeEdge = [...layout.edges].find((e) => e.from === 'c4' && e.to === 'c3');
    expect(mergeEdge).toBeDefined();
    expect(mergeEdge?.fromColumn).toBe(0);
    expect(mergeEdge?.toColumn).toBe(1);

    // Both c3 and c2 eventually connect to c1
    const c3Edge = [...layout.edges].find((e) => e.from === 'c3' && e.to === 'c1');
    expect(c3Edge).toBeDefined();

    expect(layout.maxColumns).toBeGreaterThanOrEqual(2);
  });

  it('handles octopus merges with 3 parents', () => {
    const commits: Commit[] = [
      makeCommit('c5', ['c4', 'c3', 'c2'], 'Octopus merge'),
      makeCommit('c4', ['c1'], 'Branch A'),
      makeCommit('c3', ['c1'], 'Branch B'),
      makeCommit('c2', ['c1'], 'Branch C'),
      makeCommit('c1', [], 'Root'),
    ];

    const layout = computeGraphLayout(commits);
    expect(layout.nodes).toHaveLength(5);

    const edgesFromC5 = layout.edges.filter((e) => e.from === 'c5');
    expect(edgesFromC5).toHaveLength(3);
  });

  it('handles multiple root commits (disconnected trees)', () => {
    const commits: Commit[] = [
      makeCommit('r2_b', ['r2_a'], 'Tree 2 commit'),
      makeCommit('r2_a', [], 'Tree 2 root'),
      makeCommit('r1_b', ['r1_a'], 'Tree 1 commit'),
      makeCommit('r1_a', [], 'Tree 1 root'),
    ];

    const layout = computeGraphLayout(commits);
    expect(layout.nodes).toHaveLength(4);
    expect(layout.edges).toHaveLength(2);
  });
});
