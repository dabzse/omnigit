import { describe, it, expect } from 'vitest';
import { formatRebaseTodo } from '../src/git/rebase.js';
import type { RebaseAction } from '../src/git/types.js';

describe('formatRebaseTodo', () => {
  it('formats rebase todo plan entries with various actions', () => {
    const plan: { hash: string; action: RebaseAction; subject?: string }[] = [
      { hash: 'a1b2c3d', action: 'pick', subject: 'feat: add first feature' },
      { hash: 'e4f5a6b', action: 'reword', subject: 'fix: typos in documentation' },
      { hash: 'c7d8e9f', action: 'squash', subject: 'wip: intermediate changes' },
      { hash: '1234567', action: 'drop', subject: 'temp: remove debug logs' },
    ];

    const result = formatRebaseTodo(plan);
    const lines = result.trim().split('\n');

    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('pick a1b2c3d feat: add first feature');
    expect(lines[1]).toBe('reword e4f5a6b fix: typos in documentation');
    expect(lines[2]).toBe('squash c7d8e9f wip: intermediate changes');
    expect(lines[3]).toBe('drop 1234567 temp: remove debug logs');
  });

  it('formats todo without subjects if absent', () => {
    const plan: { hash: string; action: RebaseAction }[] = [
      { hash: 'a1b2c3d', action: 'edit' },
      { hash: 'e4f5a6b', action: 'fixup' },
    ];

    const result = formatRebaseTodo(plan);
    const lines = result.trim().split('\n');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('edit a1b2c3d');
    expect(lines[1]).toBe('fixup e4f5a6b');
  });
});
