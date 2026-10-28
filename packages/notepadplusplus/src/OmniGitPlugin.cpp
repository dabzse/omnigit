#include "PluginDefinition.h"

HINSTANCE g_hInst = nullptr;
NppData g_nppData = { nullptr, nullptr, nullptr };
HWND g_hDockDlg = nullptr;
bool g_bBlameEnabled = true;

// Notepad++ & Scintilla message constants
#define NPPM_MODELESSDIALOG 2024
#define NPPM_GETFULLCURRENTPATH 2028
#define SCI_GETCURRENTPOS 2008
#define SCI_LINEFROMPOSITION 2166
#define SCI_ANNOTATIONSETTEXT 2540
#define SCI_ANNOTATIONSETSTYLE 2542
#define SCI_ANNOTATIONCLEARALL 2547

HWND GetCurrentScintilla() {
    int which = -1;
    SendMessage(g_nppData._nppHandle, 2029 /* NPPM_GETCURRENTSCINTILLA */, 0, (LPARAM)&which);
    return (which == 0) ? g_nppData._scintillaMainHandle : g_nppData._scintillaSecondHandle;
}

void UpdateBlameAnnotation(HWND hSci, int line, const wchar_t* text) {
    if (!g_bBlameEnabled) {
        SendMessage(hSci, SCI_ANNOTATIONCLEARALL, 0, 0);
        return;
    }

    // Convert wide text to UTF-8
    char utf8Buf[256];
    WideCharToMultiByte(CP_UTF8, 0, text, -1, utf8Buf, sizeof(utf8Buf), nullptr, nullptr);

    SendMessage(hSci, SCI_ANNOTATIONCLEARALL, 0, 0);
    SendMessage(hSci, SCI_ANNOTATIONSETTEXT, (WPARAM)line, (LPARAM)utf8Buf);
}

void ShowGitGraphDialog() {
    // Launch or navigate the OmniGit WebView UI
    ShellExecuteW(nullptr, L"open", L"http://localhost:5173", nullptr, nullptr, SW_SHOWNORMAL);
}

void ToggleInlineBlame() {
    g_bBlameEnabled = !g_bBlameEnabled;
    HWND hSci = GetCurrentScintilla();
    if (!g_bBlameEnabled && hSci) {
        SendMessage(hSci, SCI_ANNOTATIONCLEARALL, 0, 0);
    }
}

BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID lpReserved) {
    if (ul_reason_for_call == DLL_PROCESS_ATTACH) {
        g_hInst = (HINSTANCE)hModule;
    }
    return TRUE;
}
