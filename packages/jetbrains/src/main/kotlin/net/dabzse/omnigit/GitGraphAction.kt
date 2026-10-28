package net.dabzse.omnigit

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.wm.ToolWindowManager

/**
 * Action triggered by menu or keyboard shortcut (Ctrl+Alt+G) to open the OmniGit window.
 */
class GitGraphAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val toolWindowManager = ToolWindowManager.getInstance(project)
        val toolWindow = toolWindowManager.getToolWindow("OmniGit") ?: return
        toolWindow.show()
    }
}
