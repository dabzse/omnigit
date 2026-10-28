package net.dabzse.omnigit

import com.intellij.openapi.Disposable
import com.intellij.openapi.project.Project
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefJSQuery
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefLoadHandlerAdapter
import java.awt.BorderLayout
import javax.swing.JComponent
import javax.swing.JPanel

/**
 * JCEF-based panel hosting the shared OmniGit webview UI inside JetBrains IDEs.
 */
class GitGraphWebviewPanel(private val project: Project) : Disposable {
    private val rootPanel = JPanel(BorderLayout())
    private val browser = JBCefBrowser()
    private val gitBridge = GitBridge(project)

    val component: JComponent
        get() = rootPanel

    init {
        rootPanel.add(browser.component, BorderLayout.CENTER)

        // Setup JS to Kotlin communication query router
        val jsQuery = JBCefJSQuery.create(browser)
        jsQuery.addHandler { messageJson ->
            gitBridge.handleMessage(messageJson) { responseJson ->
                browser.cefBrowser.executeJavaScript(
                    "window.postMessage($responseJson, '*');",
                    browser.cefBrowser.url,
                    0
                )
            }
            null
        }

        browser.jbCefClient.addLoadHandler(object : CefLoadHandlerAdapter() {
            override fun onLoadEnd(cefBrowser: CefBrowser, frame: CefFrame, httpStatusCode: Int) {
                // Inject the bridge shim so acquireVsCodeApi or window.cefQuery routes to JetBrains
                val bridgeShim = """
                    window.__jetBrainsBridge = function(msg) {
                        ${jsQuery.inject("JSON.stringify(msg)")}
                    };
                    window.addEventListener('message', function(e) {
                        if (e.data && e.data.type && !e.data.__fromHost) {
                            window.__jetBrainsBridge(e.data);
                        }
                    });
                """.trimIndent()
                cefBrowser.executeJavaScript(bridgeShim, cefBrowser.url, 0)
            }
        }, browser.cefBrowser)

        // Load the shared webview frontend bundle
        browser.loadURL("http://localhost:5173")
    }

    override fun dispose() {
        browser.dispose()
    }
}
