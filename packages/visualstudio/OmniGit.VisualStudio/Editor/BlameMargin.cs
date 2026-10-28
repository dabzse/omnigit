using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using OmniGit.VisualStudio.Git;

namespace OmniGit.VisualStudio.Editor
{
    public class BlameMargin : Canvas, IWpfTextViewMargin
    {
        public const string MarginName = "OmniGitBlameMargin";
        private readonly IWpfTextView _textView;
        private bool _isDisposed;
        private string _filePath;
        private string _repoPath;
        private readonly Dictionary<int, GitBlameLineModel> _blameCache = new Dictionary<int, GitBlameLineModel>();
        private bool _isLoadingBlame;

        public static bool IsBlameEnabled { get; set; } = true;

        public BlameMargin(IWpfTextView textView)
        {
            _textView = textView ?? throw new ArgumentNullException(nameof(textView));
            ClipToBounds = true;
            Width = 160;
            Background = new SolidColorBrush(Color.FromArgb(20, 137, 180, 250)); // subtle blue-slate tint

            _textView.LayoutChanged += OnLayoutChanged;
            _textView.Caret.PositionChanged += OnCaretPositionChanged;

            ResolveFileAndRepo();
            _ = LoadBlameDataAsync();
        }

        private void ResolveFileAndRepo()
        {
            if (_textView.TextBuffer.Properties.TryGetProperty(typeof(ITextDocument), out ITextDocument document))
            {
                _filePath = document.FilePath;
                if (!string.IsNullOrEmpty(_filePath))
                {
                    _repoPath = FindGitRepoRoot(Path.GetDirectoryName(_filePath));
                }
            }
        }

        private async Task LoadBlameDataAsync()
        {
            if (string.IsNullOrEmpty(_filePath) || string.IsNullOrEmpty(_repoPath) || _isLoadingBlame)
            {
                return;
            }

            _isLoadingBlame = true;
            try
            {
                var bridge = new GitBridge(() => _repoPath);
                var lines = await bridge.GetBlameAsync(_repoPath, _filePath);
                _blameCache.Clear();
                foreach (var line in lines)
                {
                    _blameCache[line.Line] = line;
                }

                await Dispatcher.InvokeAsync(InvalidateVisual);
            }
            catch
            {
                // Blame loading failure graceful ignore
            }
            finally
            {
                _isLoadingBlame = false;
            }
        }

        private void OnLayoutChanged(object sender, TextViewLayoutChangedEventArgs e)
        {
            if (IsBlameEnabled)
            {
                InvalidateVisual();
            }
        }

        private void OnCaretPositionChanged(object sender, CaretPositionChangedEventArgs e)
        {
            if (IsBlameEnabled)
            {
                InvalidateVisual();
            }
        }

        protected override void OnRender(DrawingContext drawingContext)
        {
            base.OnRender(drawingContext);

            if (!IsBlameEnabled || _isDisposed || _textView.IsClosed)
            {
                Width = 0;
                return;
            }

            Width = 160;

            var activeLineNumber = _textView.Caret.ContainingTextViewLine?.Start.GetContainingLine()?.LineNumber + 1 ?? -1;
            var textBrush = new SolidColorBrush(Color.FromArgb(180, 166, 173, 200));
            var activeBrush = new SolidColorBrush(Color.FromArgb(255, 245, 194, 231));
            var typeface = new Typeface(new FontFamily("Consolas, Segoe UI, sans-serif"), FontStyles.Normal, FontWeights.Normal, FontStretches.Normal);

            foreach (var viewLine in _textView.TextViewLines)
            {
                if (!viewLine.IsFirstTextViewLineForSnapshotLine) continue;

                var snapshotLine = viewLine.Start.GetContainingLine();
                var lineNumber = snapshotLine.LineNumber + 1;

                if (_blameCache.TryGetValue(lineNumber, out var blame))
                {
                    var isCurrentLine = lineNumber == activeLineNumber;
                    var brush = isCurrentLine ? activeBrush : textBrush;

                    var timeAgo = FormatRelativeTime(blame.Date);
                    var text = $"{blame.ShortHash} • {blame.Author} ({timeAgo})";

                    var formattedText = new FormattedText(
                        text,
                        CultureInfo.CurrentCulture,
                        FlowDirection.LeftToRight,
                        typeface,
                        10.5,
                        brush,
                        1.0);

                    formattedText.MaxTextWidth = 150;
                    formattedText.MaxLineCount = 1;

                    var y = viewLine.Top + (viewLine.Height - formattedText.Height) / 2;
                    drawingContext.DrawText(formattedText, new Point(6, y));
                }
            }
        }

        private static string FormatRelativeTime(long unixSeconds)
        {
            if (unixSeconds <= 0) return string.Empty;
            var time = DateTimeOffset.FromUnixTimeSeconds(unixSeconds);
            var span = DateTimeOffset.UtcNow - time;

            if (span.TotalDays > 365) return $"{(int)(span.TotalDays / 365)}y";
            if (span.TotalDays > 30) return $"{(int)(span.TotalDays / 30)}mo";
            if (span.TotalDays >= 1) return $"{(int)span.TotalDays}d";
            if (span.TotalHours >= 1) return $"{(int)span.TotalHours}h";
            return $"{(int)Math.Max(1, span.TotalMinutes)}m";
        }

        private static string FindGitRepoRoot(string startDir)
        {
            if (string.IsNullOrEmpty(startDir)) return null;
            var dir = new DirectoryInfo(startDir);
            while (dir != null)
            {
                if (Directory.Exists(Path.Combine(dir.FullName, ".git")) || File.Exists(Path.Combine(dir.FullName, ".git")))
                {
                    return dir.FullName;
                }
                dir = dir.Parent;
            }
            return null;
        }

        #region IWpfTextViewMargin Members

        public FrameworkElement VisualElement => this;

        public double MarginSize => IsBlameEnabled ? ActualWidth : 0;

        public bool Enabled => IsBlameEnabled;

        public ITextViewMargin GetTextViewMargin(string marginName) =>
            string.Equals(marginName, MarginName, StringComparison.OrdinalIgnoreCase) ? this : null;

        public void Dispose()
        {
            if (!_isDisposed)
            {
                _isDisposed = true;
                _textView.LayoutChanged -= OnLayoutChanged;
                _textView.Caret.PositionChanged -= OnCaretPositionChanged;
            }
        }

        #endregion
    }
}
