using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace OmniGit.VisualStudio.Git
{
    public class BridgeMessageRequest
    {
        [JsonProperty("type")]
        public string Type { get; set; }

        [JsonProperty("data")]
        public object Data { get; set; }

        [JsonProperty("branch")]
        public string Branch { get; set; }

        [JsonProperty("hash")]
        public string Hash { get; set; }

        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("startPoint")]
        public string StartPoint { get; set; }

        [JsonProperty("message")]
        public string Message { get; set; }

        [JsonProperty("index")]
        public int? Index { get; set; }

        [JsonProperty("filePath")]
        public string FilePath { get; set; }

        [JsonProperty("keepIndex")]
        public bool KeepIndex { get; set; }

        [JsonProperty("includeUntracked")]
        public bool IncludeUntracked { get; set; }
    }

    public class BridgeMessageResponse
    {
        [JsonProperty("type")]
        public string Type { get; set; }

        [JsonProperty("data")]
        public object Data { get; set; }

        [JsonProperty("error", NullValueHandling = NullValueHandling.Ignore)]
        public string Error { get; set; }

        public static BridgeMessageResponse Create(string type, object data) =>
            new BridgeMessageResponse { Type = type, Data = data };

        public static BridgeMessageResponse CreateError(string error) =>
            new BridgeMessageResponse { Type = "error", Error = error };
    }

    public class GitRefModel
    {
        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("type")]
        public string Type { get; set; } // "head" | "remote" | "tag"

        [JsonProperty("isHead")]
        public bool IsHead { get; set; }

        [JsonProperty("remote", NullValueHandling = NullValueHandling.Ignore)]
        public string Remote { get; set; }
    }

    public class GitIdentityModel
    {
        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("email")]
        public string Email { get; set; }
    }

    public class GitCommitModel
    {
        [JsonProperty("hash")]
        public string Hash { get; set; }

        [JsonProperty("shortHash")]
        public string ShortHash { get; set; }

        [JsonProperty("parents")]
        public List<string> Parents { get; set; } = new List<string>();

        [JsonProperty("subject")]
        public string Subject { get; set; }

        [JsonProperty("body")]
        public string Body { get; set; }

        [JsonProperty("author")]
        public GitIdentityModel Author { get; set; }

        [JsonProperty("authorDate")]
        public long AuthorDate { get; set; }

        [JsonProperty("committer")]
        public GitIdentityModel Committer { get; set; }

        [JsonProperty("commitDate")]
        public long CommitDate { get; set; }

        [JsonProperty("refs")]
        public List<GitRefModel> Refs { get; set; } = new List<GitRefModel>();
    }

    public class GitFileStatusModel
    {
        [JsonProperty("path")]
        public string Path { get; set; }

        [JsonProperty("origPath", NullValueHandling = NullValueHandling.Ignore)]
        public string OrigPath { get; set; }

        [JsonProperty("status")]
        public string Status { get; set; }
    }

    public class GitRepoStatusModel
    {
        [JsonProperty("currentBranch")]
        public string CurrentBranch { get; set; }

        [JsonProperty("detachedHead")]
        public bool DetachedHead { get; set; }

        [JsonProperty("upstream", NullValueHandling = NullValueHandling.Ignore)]
        public string Upstream { get; set; }

        [JsonProperty("ahead")]
        public int Ahead { get; set; }

        [JsonProperty("behind")]
        public int Behind { get; set; }

        [JsonProperty("staged")]
        public List<GitFileStatusModel> Staged { get; set; } = new List<GitFileStatusModel>();

        [JsonProperty("unstaged")]
        public List<GitFileStatusModel> Unstaged { get; set; } = new List<GitFileStatusModel>();

        [JsonProperty("untracked")]
        public List<string> Untracked { get; set; } = new List<string>();

        [JsonProperty("conflicts")]
        public List<string> Conflicts { get; set; } = new List<string>();

        [JsonProperty("merging")]
        public bool Merging { get; set; }

        [JsonProperty("rebasing")]
        public bool Rebasing { get; set; }

        [JsonProperty("cherryPicking")]
        public bool CherryPicking { get; set; }
    }

    public class GitBranchModel
    {
        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("current")]
        public bool Current { get; set; }

        [JsonProperty("remote")]
        public bool Remote { get; set; }

        [JsonProperty("upstream", NullValueHandling = NullValueHandling.Ignore)]
        public string Upstream { get; set; }

        [JsonProperty("ahead")]
        public int Ahead { get; set; }

        [JsonProperty("behind")]
        public int Behind { get; set; }
    }

    public class GitTagModel
    {
        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("hash")]
        public string Hash { get; set; }

        [JsonProperty("message", NullValueHandling = NullValueHandling.Ignore)]
        public string Message { get; set; }
    }

    public class GitStashModel
    {
        [JsonProperty("index")]
        public int Index { get; set; }

        [JsonProperty("hash")]
        public string Hash { get; set; }

        [JsonProperty("message")]
        public string Message { get; set; }

        [JsonProperty("date")]
        public long Date { get; set; }
    }

    public class GitBlameLineModel
    {
        [JsonProperty("line")]
        public int Line { get; set; }

        [JsonProperty("hash")]
        public string Hash { get; set; }

        [JsonProperty("shortHash")]
        public string ShortHash { get; set; }

        [JsonProperty("author")]
        public string Author { get; set; }

        [JsonProperty("authorEmail")]
        public string AuthorEmail { get; set; }

        [JsonProperty("date")]
        public long Date { get; set; }

        [JsonProperty("summary")]
        public string Summary { get; set; }
    }
}
