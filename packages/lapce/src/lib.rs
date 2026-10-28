use lapce_plugin::{
    psp_types::lsp_types::{notification::ShowMessage, MessageType, ShowMessageParams},
    register_plugin, LapcePlugin,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Default)]
struct OmniGitPlugin {
    blame_enabled: bool,
}

#[derive(Serialize, Deserialize)]
struct GitBlameResult {
    hash: String,
    author: String,
    date: String,
    summary: String,
}

impl LapcePlugin for OmniGitPlugin {
    fn handle_request(&mut self, _id: u64, method: String, _params: Value) {}

    fn handle_notification(&mut self, method: String, params: Value) {
        match method.as_str() {
            "initialize" => {
                self.blame_enabled = true;
                lapce_plugin::show_message(
                    MessageType::INFO,
                    "OmniGit initialized. Use 'OmniGit: Show Git Graph' (Ctrl+Alt+G) to open graph.".to_string(),
                );
            }
            "run_command" => {
                if let Some(command) = params.get("command").and_then(|v| v.as_str()) {
                    match command {
                        "omnigit.show_graph" => {
                            // Launch local webview server or open graph view
                            let url = "http://localhost:5173";
                            lapce_plugin::open_url(url);
                        }
                        "omnigit.toggle_blame" => {
                            self.blame_enabled = !self.blame_enabled;
                            let msg = if self.blame_enabled {
                                "OmniGit: Inline blame enabled"
                            } else {
                                "OmniGit: Inline blame disabled"
                            };
                            lapce_plugin::show_message(MessageType::INFO, msg.to_string());
                        }
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }
}

register_plugin!(OmniGitPlugin);
