package net.dabzse.omnigit

import com.intellij.openapi.editor.Editor
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vcs.annotate.AnnotationListener
import com.intellij.openapi.vcs.annotate.AnnotationProvider
import com.intellij.openapi.vcs.annotate.FileAnnotation
import com.intellij.openapi.vfs.VirtualFile

/**
 * Provider for inline and gutter git blame annotations in IntelliJ.
 */
class BlameAnnotationProvider(private val project: Project) : AnnotationProvider {
    override fun annotate(file: VirtualFile): FileAnnotation {
        return object : FileAnnotation(project) {
            override fun getLineAuthor(line: Int): String? = null
            override fun getLineDate(line: Int): java.util.Date? = null
            override fun getToolTip(line: Int): String? = null
            override fun getRevisions(): MutableList<out com.intellij.openapi.vcs.history.VcsFileRevision>? = null
            override fun getFile(): VirtualFile = file
            override fun getLineRevisionNumber(line: Int): com.intellij.openapi.vcs.history.VcsRevisionNumber? = null
            override fun dispose() {}
            override fun addListener(listener: AnnotationListener) {}
            override fun removeListener(listener: AnnotationListener) {}
        }
    }

    override fun annotate(file: VirtualFile, fileAnnotation: FileAnnotation): FileAnnotation {
        return annotate(file)
    }

    override fun isAnnotationValid(fileAnnotation: FileAnnotation): Boolean = true
}
