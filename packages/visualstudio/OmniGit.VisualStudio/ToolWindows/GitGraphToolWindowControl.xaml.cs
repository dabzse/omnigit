using System;
using System.IO;
using System.Net.Http;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using EnvDTE;
using EnvDTE80;
using Microsoft.VisualStudio.Shell;
using Microsoft.Web.WebView2.Core;
using OmniGit.VisualStudio.Git;

namespace OmniGit.VisualStudio.ToolWindows
{
    public partial class GitGraphToolWindowControl : UserControl
    {
        private readonly GitBridge _gitBridge;
        private bool _isInitialized;

        public GitGraphToolWindowControl()
        {
            InitializeComponent();
            _gitBridge = new GitBridge(GetActiveRepositoryPath);
            Loaded += OnLoaded;
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            if (_isInitialized) return;
            _isInitialized = true;
            await InitializeWebViewAsync();
        }

        private async Task InitializeWebViewAsync()
        {
            try
            {
                statusOverlay.Visibility = Visibility.Visible;
                statusTitle.Text = "OmniGit — Initializing Git Graph";
                statusDescription.Text = "Starting Microsoft WebView2 engine...";

                var userDataFolder = Path.Combine(Path.GetTempPath(), "OmniGit_WebView2_Profile");
                Directory.CreateDirectory(userDataFolder);

                var environment = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
                await webView.EnsureCoreWebView2Async(environment);

                webView.CoreWebView2.Settings.IsScriptEnabled = true;
                webView.CoreWebView2.Settings.IsWebMessageEnabled = true;
                webView.CoreWebView2.Settings.AreDevToolsEnabled = true;
                webView.CoreWebView2.Settings.IsStatusBarEnabled = false;

                webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

                var targetUri = await ResolveWebViewUriAsync();
                webView.CoreWebView2.Navigate(targetUri);

                statusOverlay.Visibility = Visibility.Collapsed;
            }
            catch (Exception ex)
            {
                statusOverlay.Visibility = Visibility.Visible;
                statusTitle.Text = "WebView2 Runtime Error";
                statusDescription.Text = $"Failed to initialize Microsoft WebView2:\n{ex.Message}\n\nPlease verify that the Microsoft Edge WebView2 Evergreen Runtime is installed.";
            }
        }

        private async void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                var rawJson = e.TryGetWebMessageAsString();
                if (string.IsNullOrEmpty(rawJson))
                {
                    rawJson = e.WebMessageAsJson;
                }

                var responseJson = await _gitBridge.HandleMessageJsonAsync(rawJson);
                if (!string.IsNullOrEmpty(responseJson))
                {
                    await Dispatcher.InvokeAsync(() =>
                    {
                        if (webView?.CoreWebView2 != null)
                        {
                            webView.CoreWebView2.PostWebMessageAsJson(responseJson);
                        }
                    });
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[OmniGit] WebMessage error: {ex}");
            }
        }

        private async Task<string> ResolveWebViewUriAsync()
        {
            // 1. Check if Vite dev server is running on localhost:5173
            try
            {
                using (var httpClient = new HttpClient { Timeout = TimeSpan.FromMilliseconds(500) })
                {
                    var response = await httpClient.GetAsync("http://localhost:5173");
                    if (response.IsSuccessStatusCode)
                    {
                        return "http://localhost:5173";
                    }
                }
            }
            catch
            {
                // Local dev server not reachable, fallback to bundled assets
            }

            // 2. Bundled webview-ui dist files in extension directory
            var assemblyDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            if (assemblyDir != null)
            {
                var bundledIndex = Path.Combine(assemblyDir, "webview", "index.html");
                if (File.Exists(bundledIndex))
                {
                    return new Uri(bundledIndex).AbsoluteUri;
                }

                // Monorepo search relative path
                var monorepoDist = Path.GetFullPath(Path.Combine(assemblyDir, @"..\..\..\webview-ui\dist\index.html"));
                if (File.Exists(monorepoDist))
                {
                    return new Uri(monorepoDist).AbsoluteUri;
                }
            }

            // 3. Fallback to inline HTML data URI
            return "data:text/html,<html><body style='background:%231E1E2E;color:%23CDD6F4;font-family:sans-serif;padding:30px;text-align:center;'><h2>OmniGit Graph Ready</h2><p>Please build @dabzse/omnigit-webview-ui or start Vite dev server on port 5173.</p></body></html>";
        }

        public string GetActiveRepositoryPath()
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            try
            {
                var dte = Package.GetGlobalService(typeof(DTE)) as DTE2;
                if (dte?.Solution != null && !string.IsNullOrEmpty(dte.Solution.FullName))
                {
                    var solDir = Path.GetDirectoryName(dte.Solution.FullName);
                    var repo = FindGitRepoRoot(solDir);
                    if (!string.IsNullOrEmpty(repo)) return repo;
                }

                // Check active document path
                if (dte?.ActiveDocument != null && !string.IsNullOrEmpty(dte.ActiveDocument.FullName))
                {
                    var docDir = Path.GetDirectoryName(dte.ActiveDocument.FullName);
                    var repo = FindGitRepoRoot(docDir);
                    if (!string.IsNullOrEmpty(repo)) return repo;
                }
            }
            catch
            {
                // Fallback
            }

            return FindGitRepoRoot(Environment.CurrentDirectory);
        }

        private static string FindGitRepoRoot(string startDir)
        {
            if (string.IsNullOrEmpty(startDir)) return null;

            var current = new DirectoryInfo(startDir);
            while (current != null)
            {
                if (Directory.Exists(Path.Combine(current.FullName, ".git")) ||
                    File.Exists(Path.Combine(current.FullName, ".git")))
                {
                    return current.FullName;
                }
                current = current.Parent;
            }

            return null;
        }

        private async void OnRetryClicked(object sender, RoutedEventArgs e)
        {
            await InitializeWebViewAsync();
        }

        private void OnOpenRepoClicked(object sender, RoutedEventArgs e)
        {
            var path = GetActiveRepositoryPath();
            if (!string.IsNullOrEmpty(path) && Directory.Exists(path))
            {
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = path,
                    UseShellExecute = true
                });
            }
        }
    }
}
