package net.dabzse.omnigit.views;

import org.eclipse.swt.SWT;
import org.eclipse.swt.browser.Browser;
import org.eclipse.swt.browser.BrowserFunction;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.ui.part.ViewPart;

/**
 * Eclipse ViewPart hosting the OmniGit webview UI via SWT Browser.
 */
public class GitGraphView extends ViewPart {
    public static final String ID = "net.dabzse.omnigit.views.GitGraphView";
    private Browser browser;
    private GitBridge gitBridge;

    @Override
    public void createPartControl(Composite parent) {
        browser = new Browser(parent, SWT.NONE);
        gitBridge = new GitBridge();

        // Create JS to Java callback function
        new BrowserFunction(browser, "__eclipseBridge") {
            @Override
            public Object function(Object[] arguments) {
                if (arguments != null && arguments.length > 0 && arguments[0] instanceof String) {
                    String jsonMessage = (String) arguments[0];
                    String response = gitBridge.handleMessage(jsonMessage);
                    if (response != null) {
                        browser.execute("window.postMessage(" + response + ", '*');");
                    }
                }
                return null;
            }
        };

        // Load webview UI
        browser.setUrl("http://localhost:5173");
    }

    @Override
    public void setFocus() {
        if (browser != null && !browser.isDisposed()) {
            browser.setFocus();
        }
    }

    @Override
    public void dispose() {
        if (browser != null && !browser.isDisposed()) {
            browser.dispose();
        }
        super.dispose();
    }
}
