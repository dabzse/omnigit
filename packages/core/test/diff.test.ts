import { describe, it, expect } from 'vitest';
import { parseUnifiedDiff } from '../src/git/diff.js';

describe('parseUnifiedDiff', () => {
  it('returns empty array for empty diff string', () => {
    expect(parseUnifiedDiff('')).toEqual([]);
    expect(parseUnifiedDiff('   \n  ')).toEqual([]);
  });

  it('parses a modified file with multiple hunks', () => {
    const rawDiff = `diff --git a/src/index.ts b/src/index.ts
index 1111111..2222222 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,5 +1,6 @@
 import { foo } from './foo.js';
+import { bar } from './bar.js';
 
 export function run() {
   foo();
@@ -10,4 +11,5 @@ export function run() {
 }
 
+export { bar };
 export default run;
`;

    const diffs = parseUnifiedDiff(rawDiff);
    expect(diffs).toHaveLength(1);

    const file = diffs[0];
    expect(file.path).toBe('src/index.ts');
    expect(file.status).toBe('modified');
    expect(file.isBinary).toBe(false);
    expect(file.hunks).toHaveLength(2);

    // Hunk 1
    const hunk1 = file.hunks[0];
    expect(hunk1.header).toEqual({
      oldStart: 1,
      oldCount: 5,
      newStart: 1,
      newCount: 6,
      context: undefined,
    });
    expect(hunk1.lines).toHaveLength(5);
    expect(hunk1.lines[0]).toEqual({
      type: 'context',
      content: "import { foo } from './foo.js';",
      oldLineNumber: 1,
      newLineNumber: 1,
    });
    expect(hunk1.lines[1]).toEqual({
      type: 'add',
      content: "import { bar } from './bar.js';",
      oldLineNumber: undefined,
      newLineNumber: 2,
    });

    // Hunk 2
    const hunk2 = file.hunks[1];
    expect(hunk2.header.oldStart).toBe(10);
    expect(hunk2.header.newStart).toBe(11);
    expect(hunk2.header.context).toBe('export function run() {');
  });

  it('parses added files', () => {
    const rawDiff = `diff --git a/new-file.txt b/new-file.txt
new file mode 100644
index 0000000..abcdef1
--- /dev/null
+++ b/new-file.txt
@@ -0,0 +1,2 @@
+hello world
+second line
`;

    const diffs = parseUnifiedDiff(rawDiff);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].path).toBe('new-file.txt');
    expect(diffs[0].status).toBe('added');
    expect(diffs[0].hunks).toHaveLength(1);
    expect(diffs[0].hunks[0].lines).toHaveLength(2);
    expect(diffs[0].hunks[0].lines[0].type).toBe('add');
    expect(diffs[0].hunks[0].lines[1].type).toBe('add');
  });

  it('parses deleted files', () => {
    const rawDiff = `diff --git a/old-file.txt b/old-file.txt
deleted file mode 100644
index abcdef1..0000000
--- a/old-file.txt
+++ /dev/null
@@ -1,2 +0,0 @@
-hello world
-second line
`;

    const diffs = parseUnifiedDiff(rawDiff);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].path).toBe('old-file.txt');
    expect(diffs[0].status).toBe('deleted');
    expect(diffs[0].hunks).toHaveLength(1);
    expect(diffs[0].hunks[0].lines[0].type).toBe('delete');
  });

  it('detects binary files', () => {
    const rawDiff = `diff --git a/image.png b/image.png
new file mode 100644
index 0000000..abcdef1
Binary files /dev/null and b/image.png differ
`;

    const diffs = parseUnifiedDiff(rawDiff);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].path).toBe('image.png');
    expect(diffs[0].isBinary).toBe(true);
    expect(diffs[0].hunks).toHaveLength(0);
  });
});
