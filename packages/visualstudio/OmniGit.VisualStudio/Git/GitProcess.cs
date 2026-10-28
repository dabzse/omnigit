using System;
using System.Diagnostics;
using System.Text;
using System.Threading.Tasks;

namespace OmniGit.VisualStudio.Git
{
    public class GitProcessResult
    {
        public int ExitCode { get; set; }
        public string StandardOutput { get; set; }
        public string StandardError { get; set; }
        public bool Success => ExitCode == 0;
    }

    public static class GitProcess
    {
        public static async Task<GitProcessResult> RunAsync(string workingDirectory, params string[] args)
        {
            var argumentBuilder = new StringBuilder();
            foreach (var arg in args)
            {
                if (argumentBuilder.Length > 0)
                {
                    argumentBuilder.Append(' ');
                }

                if (arg.Contains(" ") || arg.Contains("\""))
                {
                    argumentBuilder.Append('\"').Append(arg.Replace("\"", "\\\"")).Append('\"');
                }
                else
                {
                    argumentBuilder.Append(arg);
                }
            }

            var startInfo = new ProcessStartInfo
            {
                FileName = "git",
                Arguments = argumentBuilder.ToString(),
                WorkingDirectory = workingDirectory ?? Environment.CurrentDirectory,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            };

            using (var process = new Process { StartInfo = startInfo })
            {
                var stdout = new StringBuilder();
                var stderr = new StringBuilder();

                process.OutputDataReceived += (s, e) =>
                {
                    if (e.Data != null)
                    {
                        stdout.AppendLine(e.Data);
                    }
                };

                process.ErrorDataReceived += (s, e) =>
                {
                    if (e.Data != null)
                    {
                        stderr.AppendLine(e.Data);
                    }
                };

                try
                {
                    process.Start();
                    process.BeginOutputReadLine();
                    process.BeginErrorReadLine();

                    var tcs = new TaskCompletionSource<bool>();
                    process.EnableRaisingEvents = true;
                    process.Exited += (s, e) => tcs.TrySetResult(true);

                    await tcs.Task.ConfigureAwait(false);

                    return new GitProcessResult
                    {
                        ExitCode = process.ExitCode,
                        StandardOutput = stdout.ToString(),
                        StandardError = stderr.ToString()
                    };
                }
                catch (Exception ex)
                {
                    return new GitProcessResult
                    {
                        ExitCode = -1,
                        StandardOutput = string.Empty,
                        StandardError = ex.Message
                    };
                }
            }
        }
    }
}
