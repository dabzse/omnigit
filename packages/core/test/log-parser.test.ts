import { describe, it, expect } from 'vitest';
import { parseLogOutput, parseRefs } from '../src/git/log-parser.js';

describe('parseRefs', () => {
  it('parses empty decoration string', () => {
    expect(parseRefs('')).toEqual([]);
    expect(parseRefs('   ')).toEqual([]);
  });

  it('parses HEAD pointer decoration', () => {
    const refs = parseRefs('HEAD -> main');
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      name: 'main',
      type: 'head',
      isHead: true,
      remote: undefined,
    });
  });

  it('parses multiple refs including tags and remotes', () => {
    const refs = parseRefs('HEAD -> main, tag: v1.0.0, origin/main, origin/HEAD');
    expect(refs).toHaveLength(4);

    expect(refs[0]).toEqual({
      name: 'main',
      type: 'head',
      isHead: true,
      remote: undefined,
    });

    expect(refs[1]).toEqual({
      name: 'v1.0.0',
      type: 'tag',
      isHead: false,
      remote: undefined,
    });

    expect(refs[2]).toEqual({
      name: 'origin/main',
      type: 'remote',
      remote: 'origin',
      isHead: false,
    });
  });
});

describe('parseLogOutput', () => {
  const FIELD_SEP = '\x1e';
  const COMMIT_SEP = '\x1f';

  it('parses standard commit format string', () => {
    const raw = [
      'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      'a1b2c3d',
      'f0e1d2c3b4a5f0e1d2c3b4a5f0e1d2c3b4a5f0e1',
      'feat: implement interactive commit graph',
      'This commit introduces the custom SVG renderer.\nSupports branch colors and bezier arcs.',
      'Alice Developer',
      'alice@example.com',
      '1700000000',
      'Alice Developer',
      'alice@example.com',
      '1700000000',
      'HEAD -> main, origin/main',
    ].join(FIELD_SEP) + COMMIT_SEP;

    const commits = parseLogOutput(raw);
    expect(commits).toHaveLength(1);

    const c = commits[0];
    expect(c.hash).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');
    expect(c.shortHash).toBe('a1b2c3d');
    expect(c.parents).toEqual(['f0e1d2c3b4a5f0e1d2c3b4a5f0e1d2c3b4a5f0e1']);
    expect(c.subject).toBe('feat: implement interactive commit graph');
    expect(c.body).toBe('This commit introduces the custom SVG renderer.\nSupports branch colors and bezier arcs.');
    expect(c.author.name).toBe('Alice Developer');
    expect(c.author.email).toBe('alice@example.com');
    expect(c.authorDate).toBe(1700000000);
    expect(c.refs).toHaveLength(2);
    expect(c.refs[0].name).toBe('main');
    expect(c.refs[0].isHead).toBe(true);
  });

  it('handles multiple commits in stream', () => {
    const entry1 = [
      '1111111111111111111111111111111111111111',
      '1111111',
      '',
      'Initial commit',
      '',
      'Bob Builder',
      'bob@example.com',
      '1699990000',
      'Bob Builder',
      'bob@example.com',
      '1699990000',
      'tag: v0.1.0',
    ].join(FIELD_SEP) + COMMIT_SEP;

    const entry2 = [
      '2222222222222222222222222222222222222222',
      '2222222',
      '1111111111111111111111111111111111111111',
      'Second commit',
      '',
      'Alice Dev',
      'alice@example.com',
      '1699991000',
      'Alice Dev',
      'alice@example.com',
      '1699991000',
      'HEAD -> main',
    ].join(FIELD_SEP) + COMMIT_SEP;

    const commits = parseLogOutput(entry1 + entry2);
    expect(commits).toHaveLength(2);
    expect(commits[0].shortHash).toBe('1111111');
    expect(commits[1].shortHash).toBe('2222222');
  });
});
