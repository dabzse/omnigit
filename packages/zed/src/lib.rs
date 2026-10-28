use zed_extension_api::{self as zed, Result};

struct OmniGitExtension;

impl zed::Extension for OmniGitExtension {
    fn new() -> Self {
        OmniGitExtension
    }
}

zed::register_extension!(OmniGitExtension);
