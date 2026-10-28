import { describe, it, expect } from 'vitest';
import { parseStashOutput } from '../src/git/stash.js';

describe('parseStashOutput', () => {
  const SEP = '\x1e';

  it('handles empty stash output', () => {
    expect(parseStashOutput('')).toEqual([]);
    expect(parseStashOutput('   \n  ')).toEqual([]);
  });

  it('parses multiple stash entries with branch and WIP annotations', () => {
    const raw = [
      ['a1b2c3d4e5', 'stash@{0}', 'WIP on main: 9999999 feat: WIP work in progress', '1700001000'].join(SEP),
      ['f0e1d2c3b4', 'stash@{1}', 'On feature/login: save login form work', '1700000000'].join(SEP),
    ].join('\n');

    const stashes = parseStashOutput(raw);
    expect(stashes).toHaveLength(2);

    expect(stashes[0]).toEqual({
      index: 0,
      hash: 'a1b2c3d4e5',
      message: 'WIP on main: 9999999 feat: WIP work in progress',
      branch: 'main',
      date: 1700001000,
    });

    expect(stashes[1]).toEqual({
      index: 1,
      hash: 'f0e1d2c3b4',
      message: 'On feature/login: save login form work',
      branch: 'feature/login',
      date: 1700000000,
    });
  });
});
