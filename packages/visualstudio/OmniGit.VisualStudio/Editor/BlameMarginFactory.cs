using System.ComponentModel.Composition;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Utilities;

namespace OmniGit.VisualStudio.Editor
{
    [Export(typeof(IWpfTextViewMarginProvider))]
    [Name(BlameMargin.MarginName)]
    [Order(After = PredefinedMarginNames.LeftSelection)]
    [MarginContainer(PredefinedMarginNames.Left)]
    [ContentType("text")]
    [TextViewRole(PredefinedTextViewRoles.Document)]
    internal sealed class BlameMarginFactory : IWpfTextViewMarginProvider
    {
        public IWpfTextViewMargin CreateMargin(IWpfTextViewHost wpfTextViewHost, IWpfTextViewMargin marginContainer)
        {
            if (wpfTextViewHost?.TextView == null) return null;
            return new BlameMargin(wpfTextViewHost.TextView);
        }
    }
}
