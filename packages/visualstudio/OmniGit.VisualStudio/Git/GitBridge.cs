using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace OmniGit.VisualStudio.Git
{
    public class GitBridge
    {
        private readonly Func<string> _repoPathProvider;

        public GitBridge(Func<string> repoPathProvider)
        {
            _repoPathProvider = repoPathProvider;
        }

        public string RepositoryPath => _repoPathProvider?.Invoke() ?? string.Empty;

        public async Task<string> HandleMessageJsonAsync(string jsonMessage)
        {
            if (string.IsNullOrWhiteSpace(jsonMessage))
            {
                return null;
            }

            try
            {
                var request = JsonConvert.DeserializeObject<BridgeMessageRequest>(jsonMessage);
                if (request == null || string.IsNullOrEmpty(request.Type))
                {
                    return JsonConvert.SerializeObject(BridgeMessageResponse.CreateError("Invalid message format"));
                }

                var repoPath = RepositoryPath;
                if (string.IsNullOrEmpty(repoPath) || !Directory.Exists(repoPath))
                {
                    return JsonConvert.SerializeObject(BridgeMessageResponse.CreateError("No active Git repository open in Visual Studio."));
                }

                switch (request.Type)
                {
                    case "requestCommits":
                        var commits = await GetCommitsAsync(repoPath);
                        return JsonConvert.SerializeObject(BridgeMessageResponse.Create("commits", commits));

                    case "requestStatus":
                        var status = await GetStatusAsync(repoPath);
                        return JsonConvert.SerializeObject(BridgeMessageResponse.Create("status", status));

                    case "requestBranches":
                        var branches = await GetBranchesAsync(repoPath);
                        return JsonConvert.SerializeObject(BridgeMessageResponse.Create("branches", branches));

                    case "requestTags":
                        var tags = await GetTagsAsync(repoPath);
                        return JsonConvert.SerializeObject(BridgeMessageResponse.Create("tags", tags));

                    case "requestStashes":
                        var stashes = await GetStashesAsync(repoPath);
                        return JsonConvert.SerializeObject(BridgeMessageResponse.Create("stashes", stashes));

                    case "checkout":
                        var target = request.Branch ?? request.Hash;
                        var coRes = await GitProcess.RunAsync(repoPath, "checkout", target);
                        return coRes.Success
                            ? JsonConvert.SerializeObject(BridgeMessageResponse.Create("actionSuccess", new { action = "checkout", target }))
                            : JsonConvert.SerializeObject(BridgeMessageResponse.CreateError(coRes.StandardError));

                    case "createBranch":
                        var createArgs = string.IsNullOrEmpty(request.StartPoint)
                            ? new[] { "branch", request.Name }
                            : new[] { "branch", request.Name, request.StartPoint };
                        var brRes = await GitProcess.RunAsync(repoPath, createArgs);
                        return brRes.Success
                            ? JsonConvert.SerializeObject(BridgeMessageResponse.Create("actionSuccess", new { action = "createBranch", name = request.Name }))
                            : JsonConvert.SerializeObject(BridgeMessageResponse.CreateError(brRes.StandardError));

                    case "deleteBranch":
                        var delRes = await GitProcess.RunAsync(repoPath, "branch", "-D", request.Name);
                        return delRes.Success
                            ? JsonConvert.SerializeObject(BridgeMessageResponse.Create("actionSuccess", new { action = "deleteBranch", name = request.Name }))
                            : JsonConvert.SerializeObject(BridgeMessageResponse.CreateError(delRes.StandardError));

                    case "cherryPick":
                        var cpRes = await GitProcess.RunAsync(repoPath, "cherry-pick", request.Hash);
                        return cpRes.Success
                            ? JsonConvert.SerializeObject(BridgeMessageResponse.Create("actionSuccess", new { action = "cherryPick", hash = request.Hash }))
                            : JsonConvert.SerializeObject(BridgeMessageResponse.CreateError(cpRes.StandardError));

                    case "revert":
                        var revRes = await GitProcess.RunAsync(repoPath, "revert", "--no-edit", request.Hash);
                        return revRes.Success
                            ? JsonConvert.SerializeObject(BridgeMessageResponse.Create("actionSuccess", new { action = "revert", hash = request.Hash }))
                            : JsonConvert.SerializeObject(BridgeMessageResponse.CreateError(revRes.StandardError));

                    case "stash":
                        var msg = string.IsNullOrEmpty(request.Message) ? "WIP" : request.Message;
                        var stList = new List<string> { "stash", "push", "-m", msg };
                        if (request.KeepIndex) stList.Add("--keep-index");
                        if (request.IncludeUntracked) stList.Add("-u");
                        var stRes = await GitProcess.RunAsync(repoPath, stList.ToArray());
                        return stRes.Success
                            ? JsonConvert.SerializeObject(BridgeMessageResponse.Create("actionSuccess", new { action = "stash" }))
                            : JsonConvert.SerializeObject(BridgeMessageResponse.CreateError(stRes.StandardError));

                    case "applyStash":
                        var stashRef = request.Index.HasValue ? $"stash@{{{request.Index.Value}}}" : "stash@{0}";
                        var apRes = await GitProcess.RunAsync(repoPath, "stash", "apply", stashRef);
                        return apRes.Success
                            ? JsonConvert.SerializeObject(BridgeMessageResponse.Create("actionSuccess", new { action = "applyStash" }))
                            : JsonConvert.SerializeObject(BridgeMessageResponse.CreateError(apRes.StandardError));

                    case "popStash":
                        var popRef = request.Index.HasValue ? $"stash@{{{request.Index.Value}}}" : "stash@{0}";
                        var popRes = await GitProcess.RunAsync(repoPath, "stash", "pop", popRef);
                        return popRes.Success
                            ? JsonConvert.SerializeObject(BridgeMessageResponse.Create("actionSuccess", new { action = "popStash" }))
                            : JsonConvert.SerializeObject(BridgeMessageResponse.CreateError(popRes.StandardError));

                    case "dropStash":
                        var dropRef = request.Index.HasValue ? $"stash@{{{request.Index.Value}}}" : "stash@{0}";
                        var dropRes = await GitProcess.RunAsync(repoPath, "stash", "drop", dropRef);
                        return dropRes.Success
                            ? JsonConvert.SerializeObject(BridgeMessageResponse.Create("actionSuccess", new { action = "dropStash" }))
                            : JsonConvert.SerializeObject(BridgeMessageResponse.CreateError(dropRes.StandardError));

                    case "requestCommitDiff":
                        var diffRes = await GitProcess.RunAsync(repoPath, "diff-tree", "-r", "-p", request.Hash);
                        return JsonConvert.SerializeObject(BridgeMessageResponse.Create("commitDiff", new { hash = request.Hash, diff = diffRes.StandardOutput }));

                    case "requestBlame":
                        var blameLines = await GetBlameAsync(repoPath, request.FilePath);
                        return JsonConvert.SerializeObject(BridgeMessageResponse.Create("blame", new { filePath = request.FilePath, lines = blameLines }));

                    default:
                        return JsonConvert.SerializeObject(BridgeMessageResponse.Create("ignored", new { type = request.Type }));
                }
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(BridgeMessageResponse.CreateError(ex.Message));
            }
        }

        public async Task<List<GitCommitModel>> GetCommitsAsync(string repoPath, int maxCount = 500)
        {
            const string entrySep = "===OMNIGIT_ENTRY===";
            const string fieldSep = "%x00";
            var format = $"{entrySep}%H{fieldSep}%P{fieldSep}%an{fieldSep}%ae{fieldSep}%at{fieldSep}%cn{fieldSep}%ce{fieldSep}%ct{fieldSep}%s{fieldSep}%b{fieldSep}%d";

            var result = await GitProcess.RunAsync(repoPath, "log", $"--format={format}", "--all", $"-n{maxCount}");
            if (!result.Success)
            {
                return new List<GitCommitModel>();
            }

            var commits = new List<GitCommitModel>();
            var entries = result.StandardOutput.Split(new[] { entrySep }, StringSplitOptions.RemoveEmptyEntries);

            foreach (var entry in entries)
            {
                var fields = entry.Split(new[] { '\0' }, StringSplitOptions.None);
                if (fields.Length < 10) continue;

                var hash = fields[0].Trim();
                if (string.IsNullOrEmpty(hash)) continue;

                var parents = string.IsNullOrEmpty(fields[1].Trim())
                    ? new List<string>()
                    : fields[1].Trim().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries).ToList();

                var authorName = fields[2];
                var authorEmail = fields[3];
                long.TryParse(fields[4], out var authorDate);

                var committerName = fields[5];
                var committerEmail = fields[6];
                long.TryParse(fields[7], out var commitDate);

                var subject = fields[8];
                var body = fields[9].Trim();
                var refStr = fields.Length > 10 ? fields[10].Trim() : string.Empty;

                var refs = ParseDecorations(refStr);

                commits.Add(new GitCommitModel
                {
                    Hash = hash,
                    ShortHash = hash.Length >= 7 ? hash.Substring(0, 7) : hash,
                    Parents = parents,
                    Subject = subject,
                    Body = body,
                    Author = new GitIdentityModel { Name = authorName, Email = authorEmail },
                    AuthorDate = authorDate,
                    Committer = new GitIdentityModel { Name = committerName, Email = committerEmail },
                    CommitDate = commitDate,
                    Refs = refs
                });
            }

            return commits;
        }

        public async Task<GitRepoStatusModel> GetStatusAsync(string repoPath)
        {
            var result = await GitProcess.RunAsync(repoPath, "status", "--porcelain=v2", "--branch");
            var status = new GitRepoStatusModel();

            if (!result.Success) return status;

            using (var reader = new StringReader(result.StandardOutput))
            {
                string line;
                while ((line = reader.ReadLine()) != null)
                {
                    if (line.StartsWith("# branch.head "))
                    {
                        var head = line.Substring(14).Trim();
                        status.CurrentBranch = head == "(detached)" ? string.Empty : head;
                        status.DetachedHead = head == "(detached)";
                    }
                    else if (line.StartsWith("# branch.upstream "))
                    {
                        status.Upstream = line.Substring(18).Trim();
                    }
                    else if (line.StartsWith("# branch.ab "))
                    {
                        var parts = line.Substring(12).Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length >= 2)
                        {
                            int.TryParse(parts[0].TrimStart('+'), out var ahead);
                            int.TryParse(parts[1].TrimStart('-'), out var behind);
                            status.Ahead = ahead;
                            status.Behind = behind;
                        }
                    }
                    else if (line.StartsWith("1 ") || line.StartsWith("2 "))
                    {
                        var parts = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length >= 9)
                        {
                            var xy = parts[1];
                            var path = parts[8];
                            var origPath = parts.Length > 9 ? parts[9] : null;

                            if (xy[0] != '.')
                            {
                                status.Staged.Add(new GitFileStatusModel { Path = path, OrigPath = origPath, Status = xy[0].ToString() });
                            }
                            if (xy[1] != '.')
                            {
                                status.Unstaged.Add(new GitFileStatusModel { Path = path, OrigPath = origPath, Status = xy[1].ToString() });
                            }
                        }
                    }
                    else if (line.StartsWith("? "))
                    {
                        status.Untracked.Add(line.Substring(2).Trim());
                    }
                    else if (line.StartsWith("u "))
                    {
                        var parts = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length >= 11)
                        {
                            status.Conflicts.Add(parts[10]);
                        }
                    }
                }
            }

            // Check git state directories
            var gitDir = Path.Combine(repoPath, ".git");
            if (Directory.Exists(gitDir))
            {
                status.Merging = File.Exists(Path.Combine(gitDir, "MERGE_HEAD"));
                status.Rebasing = Directory.Exists(Path.Combine(gitDir, "rebase-apply")) || Directory.Exists(Path.Combine(gitDir, "rebase-merge"));
                status.CherryPicking = File.Exists(Path.Combine(gitDir, "CHERRY_PICK_HEAD"));
            }

            return status;
        }

        public async Task<List<GitBranchModel>> GetBranchesAsync(string repoPath)
        {
            var result = await GitProcess.RunAsync(repoPath, "branch", "-a", "-v", "--no-abbrev");
            var branches = new List<GitBranchModel>();

            if (!result.Success) return branches;

            using (var reader = new StringReader(result.StandardOutput))
            {
                string line;
                while ((line = reader.ReadLine()) != null)
                {
                    if (string.IsNullOrWhiteSpace(line)) continue;

                    var isCurrent = line.StartsWith("*");
                    var trimmed = line.Substring(1).Trim();
                    var parts = trimmed.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length == 0) continue;

                    var name = parts[0];
                    if (name == "->") continue; // symref pointer

                    var isRemote = name.StartsWith("remotes/");
                    if (isRemote)
                    {
                        name = name.Substring(8);
                    }

                    branches.Add(new GitBranchModel
                    {
                        Name = name,
                        Current = isCurrent,
                        Remote = isRemote
                    });
                }
            }

            return branches;
        }

        public async Task<List<GitTagModel>> GetTagsAsync(string repoPath)
        {
            var result = await GitProcess.RunAsync(repoPath, "tag", "-l", "--format=%(refname:short)%00%(objectname)%00%(contents:subject)");
            var tags = new List<GitTagModel>();

            if (!result.Success) return tags;

            using (var reader = new StringReader(result.StandardOutput))
            {
                string line;
                while ((line = reader.ReadLine()) != null)
                {
                    var parts = line.Split(new[] { '\0' }, StringSplitOptions.None);
                    if (parts.Length >= 2 && !string.IsNullOrWhiteSpace(parts[0]))
                    {
                        tags.Add(new GitTagModel
                        {
                            Name = parts[0].Trim(),
                            Hash = parts[1].Trim(),
                            Message = parts.Length > 2 ? parts[2].Trim() : null
                        });
                    }
                }
            }

            return tags;
        }

        public async Task<List<GitStashModel>> GetStashesAsync(string repoPath)
        {
            var result = await GitProcess.RunAsync(repoPath, "stash", "list", "--format=%gd%x00%H%x00%gs%x00%ct");
            var stashes = new List<GitStashModel>();

            if (!result.Success) return stashes;

            using (var reader = new StringReader(result.StandardOutput))
            {
                string line;
                while ((line = reader.ReadLine()) != null)
                {
                    var parts = line.Split(new[] { '\0' }, StringSplitOptions.None);
                    if (parts.Length >= 4)
                    {
                        var refIndexMatch = Regex.Match(parts[0], @"stash@\{(\d+)\}");
                        var index = refIndexMatch.Success ? int.Parse(refIndexMatch.Groups[1].Value) : 0;
                        long.TryParse(parts[3], out var date);

                        stashes.Add(new GitStashModel
                        {
                            Index = index,
                            Hash = parts[1].Trim(),
                            Message = parts[2].Trim(),
                            Date = date
                        });
                    }
                }
            }

            return stashes;
        }

        public async Task<List<GitBlameLineModel>> GetBlameAsync(string repoPath, string filePath)
        {
            if (string.IsNullOrEmpty(filePath)) return new List<GitBlameLineModel>();

            var result = await GitProcess.RunAsync(repoPath, "blame", "--porcelain", filePath);
            var blameList = new List<GitBlameLineModel>();

            if (!result.Success) return blameList;

            var commitInfo = new Dictionary<string, (string Author, string Email, long Date, string Summary)>();
            using (var reader = new StringReader(result.StandardOutput))
            {
                string line;
                while ((line = reader.ReadLine()) != null)
                {
                    var parts = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length < 3 || parts[0].Length < 40) continue;

                    var hash = parts[0];
                    if (!int.TryParse(parts[2], out var lineNumber)) continue;

                    string author = "Unknown";
                    string authorEmail = "";
                    long authorTime = 0;
                    string summary = "";

                    if (!commitInfo.ContainsKey(hash))
                    {
                        // Read headers
                        string headerLine;
                        while ((headerLine = reader.ReadLine()) != null && !headerLine.StartsWith("\t"))
                        {
                            if (headerLine.StartsWith("author ")) author = headerLine.Substring(7);
                            else if (headerLine.StartsWith("author-mail ")) authorEmail = headerLine.Substring(12).Trim('<', '>');
                            else if (headerLine.StartsWith("author-time ")) long.TryParse(headerLine.Substring(12), out authorTime);
                            else if (headerLine.StartsWith("summary ")) summary = headerLine.Substring(8);
                        }
                        commitInfo[hash] = (author, authorEmail, authorTime, summary);
                    }
                    else
                    {
                        var info = commitInfo[hash];
                        author = info.Author;
                        authorEmail = info.Email;
                        authorTime = info.Date;
                        summary = info.Summary;
                    }

                    blameList.Add(new GitBlameLineModel
                    {
                        Line = lineNumber,
                        Hash = hash,
                        ShortHash = hash.Substring(0, 7),
                        Author = author,
                        AuthorEmail = authorEmail,
                        Date = authorTime,
                        Summary = summary
                    });
                }
            }

            return blameList;
        }

        private List<GitRefModel> ParseDecorations(string refStr)
        {
            var refs = new List<GitRefModel>();
            if (string.IsNullOrWhiteSpace(refStr)) return refs;

            var cleaned = refStr.Trim().TrimStart('(').TrimEnd(')');
            var parts = cleaned.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);

            foreach (var rawPart in parts)
            {
                var part = rawPart.Trim();
                if (part.StartsWith("HEAD -> "))
                {
                    var headBranch = part.Substring(8).Trim();
                    refs.Add(new GitRefModel { Name = headBranch, Type = "head", IsHead = true });
                }
                else if (part == "HEAD")
                {
                    refs.Add(new GitRefModel { Name = "HEAD", Type = "head", IsHead = true });
                }
                else if (part.StartsWith("tag: "))
                {
                    refs.Add(new GitRefModel { Name = part.Substring(5).Trim(), Type = "tag", IsHead = false });
                }
                else if (part.Contains("/"))
                {
                    var slashIdx = part.IndexOf('/');
                    var remote = part.Substring(0, slashIdx);
                    refs.Add(new GitRefModel { Name = part, Type = "remote", IsHead = false, Remote = remote });
                }
                else
                {
                    refs.Add(new GitRefModel { Name = part, Type = "head", IsHead = false });
                }
            }

            return refs;
        }
    }
}
