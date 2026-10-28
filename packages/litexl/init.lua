-- ============================================================
-- OmniGit for Lite-XL
-- Git Graph visualization & GitLens-style inline blame
-- ============================================================

local core = require "core"
local command = require "core.command"
local keymap = require "core.keymap"
local style = require "core.style"
local DocView = require "core.docview"
local View = require "core.view"

local config = {
  blame_enabled = true,
  graph_url = "http://localhost:5173",
  blame_color = { common = { 137, 180, 250, 160 } }
}

local blame_cache = {}

-- Helper: Run Git Command
local function run_git(args, callback)
  local proc = process.start(args)
  if not proc then return end

  core.add_thread(function()
    local output = {}
    while true do
      local chunk = proc:read_stdout()
      if chunk and #chunk > 0 then
        table.insert(output, chunk)
      end
      if not proc:running() then break end
      coroutine.yield(0.01)
    end
    callback(table.concat(output))
  end)
end

-- Fetch Blame for Active Document
local function fetch_blame(filename)
  if not filename or blame_cache[filename] then return end

  run_git({ "git", "blame", "--porcelain", filename }, function(output)
    local lines = {}
    local commit_info = {}
    local current_hash = nil
    local current_line = nil

    for line in output:gmatch("[^\r\n]+") do
      local hash, orig_l, final_l = line:match("^(%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x)%s+(%d+)%s+(%d+)")
      if hash then
        current_hash = hash:sub(1, 7)
        current_line = tonumber(final_l)
        if not commit_info[current_hash] then
          commit_info[current_hash] = { author = "Unknown", summary = "" }
        end
      elseif line:match("^author ") then
        commit_info[current_hash].author = line:sub(8)
      elseif line:match("^summary ") then
        commit_info[current_hash].summary = line:sub(9)
      elseif line:match("^\t") and current_line then
        lines[current_line] = {
          hash = current_hash,
          author = commit_info[current_hash].author,
          summary = commit_info[current_hash].summary
        }
      end
    end

    blame_cache[filename] = lines
    core.redraw = true
  end)
end

-- DocView Hook: Render Inline GitLens Blame
local draw_line_text = DocView.draw_line_text

function DocView:draw_line_text(line, x, y)
  draw_line_text(self, line, x, y)

  if not config.blame_enabled then return end
  local doc = self.doc
  if not doc.filename then return end

  if not blame_cache[doc.filename] then
    fetch_blame(doc.filename)
    return
  end

  local blame = blame_cache[doc.filename][line]
  if blame then
    -- Check if cursor is on this line
    local line1, col1 = doc:get_selection()
    local is_cursor_line = (line1 == line)

    local font = style.font
    local text = string.format("   %s • %s: %s", blame.hash, blame.author, blame.summary)
    if #text > 65 then text = text:sub(1, 62) .. "..." end

    local color = is_cursor_line and { 245, 194, 231, 220 } or { 166, 173, 200, 110 }
    local line_width = self:get_col_x_offset(line, #doc.lines[line])
    renderer.draw_text(font, text, x + line_width + 20, y, color)
  end
end

-- Commands
command.add("core.docview", {
  ["omnigit:show-graph"] = function()
    -- Open local OmniGit webview interface
    local cmd = string.format("xdg-open %q || open %q || start %q", config.graph_url, config.graph_url, config.graph_url)
    os.execute(cmd)
    core.log("OmniGit: Opened Git Graph in browser (" .. config.graph_url .. ")")
  end,

  ["omnigit:toggle-blame"] = function()
    config.blame_enabled = not config.blame_enabled
    core.log("OmniGit: Inline blame " .. (config.blame_enabled and "enabled" or "disabled"))
    core.redraw = true
  end,

  ["omnigit:refresh-blame"] = function()
    local doc = core.active_view.doc
    if doc and doc.filename then
      blame_cache[doc.filename] = nil
      fetch_blame(doc.filename)
      core.log("OmniGit: Refreshed blame for " .. doc.filename)
    end
  end
})

-- Keybindings
keymap.add {
  ["ctrl+alt+g"] = "omnigit:show-graph",
  ["ctrl+alt+b"] = "omnigit:toggle-blame"
}

return { config = config }
