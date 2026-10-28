# ============================================================
# OmniGit for Sublime Text 3 & 4
# Interactive Git Graph & GitLens-style inline blame phantoms
# ============================================================

import os
import subprocess
import webbrowser

try:
    import sublime  # pyrefly: ignore[missing-import]  # type: ignore
    import sublime_plugin  # pyrefly: ignore[missing-import]  # type: ignore
except ImportError:
    # Stubs for IDE static analysis outside Sublime Text runtime
    class _MockSublime:
        LAYOUT_INLINE = 1

        @staticmethod
        def status_message(_msg):
            # Stub implementation for IDE static analysis
            pass

        class Region:
            def __init__(self, _a, _b):
                # Stub implementation for IDE static analysis
                pass

        class Phantom:
            def __init__(self, _region, _content, _layout):
                # Stub implementation for IDE static analysis
                pass

        class PhantomSet:
            def __init__(self, _view, _key):
                # Stub implementation for IDE static analysis
                pass

            def update(self, _phantoms):
                # Stub implementation for IDE static analysis
                pass

    class _MockPlugin:
        class EventListener:
            # Stub implementation for IDE static analysis
            pass

        class WindowCommand:
            # Stub implementation for IDE static analysis
            pass

    sublime = _MockSublime()
    sublime_plugin = _MockPlugin()

# Global state
blame_enabled = True
phantom_sets = {}  # view_id -> sublime.PhantomSet
blame_cache = {}   # file_path -> { line_num: (hash, author, date, summary) }
server_port = 5173

# Git Process Helper

def run_git_cmd(args, cwd):
    try:
        startupinfo = None
        if os.name == 'nt':
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

        proc = subprocess.Popen(
            ['git'] + args,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            startupinfo=startupinfo,
            encoding='utf-8',
            errors='replace'
        )
        stdout, stderr = proc.communicate(timeout=10)
        return proc.returncode == 0, stdout, stderr
    except (subprocess.SubprocessError, OSError) as e:
        return False, "", str(e)


def find_git_root(path):
    if not path:
        return None
    curr = os.path.dirname(os.path.abspath(path))
    while curr:
        if os.path.exists(os.path.join(curr, '.git')):
            return curr
        parent = os.path.dirname(curr)
        if parent == curr:
            break
        curr = parent
    return None

# Blame Parser

def _handle_blame_content(curr_hash, final_line, commit_data, lines):
    if final_line and curr_hash:
        data = commit_data.get(curr_hash, {'author': 'Unknown', 'summary': ''})
        lines[final_line] = (curr_hash, data['author'], data['summary'])


def _update_commit_info(line, curr_hash, commit_data):
    if curr_hash and line.startswith('author '):
        commit_data[curr_hash]['author'] = line[7:]
    elif curr_hash and line.startswith('summary '):
        commit_data[curr_hash]['summary'] = line[8:]


def _parse_commit_hash_line(line, commit_data):
    parts = line.split(maxsplit=3)
    if len(parts) >= 3 and len(parts[0]) == 40:
        c_hash = parts[0][:7]
        line_num = int(parts[2]) if parts[2].isdigit() else None
        commit_data.setdefault(c_hash, {'author': 'Unknown', 'summary': ''})
        return c_hash, line_num
    return None, None


def _parse_porcelain_blame(stdout):
    lines = {}
    commit_data = {}
    curr_hash = None
    final_line = None

    for line in stdout.splitlines():
        if line.startswith('\t'):
            _handle_blame_content(curr_hash, final_line, commit_data, lines)
            continue

        c_hash, line_num = _parse_commit_hash_line(line, commit_data)
        if c_hash:
            curr_hash, final_line = c_hash, line_num
        else:
            _update_commit_info(line, curr_hash, commit_data)

    return lines


def get_file_blame(file_path):
    if file_path in blame_cache:
        return blame_cache[file_path]

    repo_root = find_git_root(file_path)
    if not repo_root:
        return {}

    rel_path = os.path.relpath(file_path, repo_root)
    success, stdout, _ = run_git_cmd(['blame', '--porcelain', rel_path], repo_root)
    if not success:
        return {}

    lines = _parse_porcelain_blame(stdout)
    blame_cache[file_path] = lines
    return lines

# Inline Blame Phantom Listener

class OmniGitBlameListener(sublime_plugin.EventListener):

    def on_selection_modified_async(self, view):
        if not blame_enabled or view.is_scratch() or not view.file_name():
            self.clear_phantom(view)
            return

        sel = view.sel()
        if len(sel) != 1:
            self.clear_phantom(view)
            return

        cursor_pt = sel[0].b
        row, _ = view.rowcol(cursor_pt)
        line_num = row + 1

        file_path = view.file_name()
        blame_info = get_file_blame(file_path)
        entry = blame_info.get(line_num)

        if not entry:
            self.clear_phantom(view)
            return

        h, author, summary = entry
        line_region = view.line(cursor_pt)
        end_pt = line_region.b

        html = f"""
        <body id="omnigit-blame">
            <style>
                span.blame-text {{
                    color: color(var(--foreground) alpha(0.4));
                    font-size: 0.9em;
                    font-family: monospace;
                    margin-left: 20px;
                }}
                span.hash {{
                    color: #89b4fa;
                }}
            </style>
            <span class="blame-text">
                &nbsp;&nbsp;&nbsp;&nbsp;<span class="hash">{h}</span> • {author}: {summary[:45]}
            </span>
        </body>
        """

        phantom_set = phantom_sets.setdefault(view.id(), sublime.PhantomSet(view, "omnigit_blame"))
        phantom = sublime.Phantom(sublime.Region(end_pt, end_pt), html, sublime.LAYOUT_INLINE)
        phantom_set.update([phantom])

    def clear_phantom(self, view):
        if view.id() in phantom_sets:
            phantom_sets[view.id()].update([])

    def on_post_save_async(self, view):
        if view.file_name() in blame_cache:
            del blame_cache[view.file_name()]

# Commands

class OmnigitShowGraphCommand(sublime_plugin.WindowCommand):
    def run(self):
        # Determine URL (Vite dev server or bundled distribution)
        url = f"http://localhost:{server_port}"
        sublime.status_message(f"OmniGit: Opening Git Graph ({url})")
        webbrowser.open_new_tab(url)

class OmnigitToggleBlameCommand(sublime_plugin.WindowCommand):
    def run(self):
        global blame_enabled
        blame_enabled = not blame_enabled
        state = "enabled" if blame_enabled else "disabled"
        sublime.status_message(f"OmniGit: Inline blame {state}")

        active_view = self.window.active_view()
        if active_view and not blame_enabled and active_view.id() in phantom_sets:
            phantom_sets[active_view.id()].update([])
