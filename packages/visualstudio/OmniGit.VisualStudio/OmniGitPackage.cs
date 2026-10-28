using System;
using System.ComponentModel.Design;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using OmniGit.VisualStudio.Editor;
using OmniGit.VisualStudio.ToolWindows;
using Task = System.Threading.Tasks.Task;

namespace OmniGit.VisualStudio
{
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [Guid(PackageGuidString)]
    [ProvideMenuResource("Menus.ctmenu", 1)]
    [ProvideToolWindow(typeof(GitGraphToolWindow), Style = VsDockStyle.Tabbed, Window = ToolWindowGuids.Outputwindow)]
    public sealed class OmniGitPackage : AsyncPackage
    {
        public const string PackageGuidString = "e463a55e-2b74-4b5b-80df-8c63eb1e67fa";
        public static readonly Guid CommandSetGuid = new Guid("916eb883-2fbf-4a9f-a887-3d1796d859e9");
        public const int GitGraphToolWindowCommandId = 0x0100;
        public const int ToggleBlameMarginCommandId = 0x0101;

        protected override async Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
        {
            await base.InitializeAsync(cancellationToken, progress);
            await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);

            var commandService = await GetServiceAsync(typeof(IMenuCommandService)) as OleMenuCommandService;
            if (commandService != null)
            {
                // Command: Open Git Graph Tool Window
                var graphCmdId = new CommandID(CommandSetGuid, GitGraphToolWindowCommandId);
                var graphMenuCmd = new MenuCommand((s, e) => ShowGitGraphToolWindow(), graphCmdId);
                commandService.AddCommand(graphMenuCmd);

                // Command: Toggle Inline Blame Margin
                var blameCmdId = new CommandID(CommandSetGuid, ToggleBlameMarginCommandId);
                var blameMenuCmd = new MenuCommand((s, e) => ToggleBlameMargin(), blameCmdId);
                commandService.AddCommand(blameMenuCmd);
            }
        }

        private void ShowGitGraphToolWindow()
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            JoinableTaskFactory.RunAsync(async () =>
            {
                var window = await FindToolWindowAsync(typeof(GitGraphToolWindow), 0, true, DisposalToken);
                if (window?.Frame == null)
                {
                    throw new NotSupportedException("Cannot create OmniGit Git Graph tool window");
                }

                await JoinableTaskFactory.SwitchToMainThreadAsync();
                var windowFrame = (IVsWindowFrame)window.Frame;
                ErrorHandler.ThrowOnFailure(windowFrame.Show());
            }).FireAndForget();
        }

        private void ToggleBlameMargin()
        {
            BlameMargin.IsBlameEnabled = !BlameMargin.IsBlameEnabled;
        }
    }
}
