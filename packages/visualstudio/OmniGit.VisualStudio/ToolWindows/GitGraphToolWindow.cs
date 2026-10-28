using System;
using System.Runtime.InteropServices;
using Microsoft.VisualStudio.Shell;

namespace OmniGit.VisualStudio.ToolWindows
{
    [Guid("b3a9a1a7-2083-49d8-992a-fa63a96cb4dc")]
    public class GitGraphToolWindow : ToolWindowPane
    {
        public GitGraphToolWindow() : base(null)
        {
            Caption = "OmniGit — Git Graph";
            Content = new GitGraphToolWindowControl();
        }
    }
}
