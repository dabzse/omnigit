#include "PluginDefinition.h"

extern HINSTANCE g_hInst;
extern NppData g_nppData;

const wchar_t NPP_PLUGIN_NAME[] = L"OmniGit";
const int NB_FUNC = 2;
FuncItem funcItem[NB_FUNC];

void commandMenuInit() {
    wcscpy_s(funcItem[0]._itemName, L"OmniGit: Show Git Graph (Ctrl+Alt+G)");
    funcItem[0]._pFunc = ShowGitGraphDialog;
    funcItem[0]._cmdID = 0;
    funcItem[0]._init2Check = false;
    funcItem[0]._pShKey = nullptr;

    wcscpy_s(funcItem[1]._itemName, L"OmniGit: Toggle Inline Blame");
    funcItem[1]._pFunc = ToggleInlineBlame;
    funcItem[1]._cmdID = 1;
    funcItem[1]._init2Check = true;
    funcItem[1]._pShKey = nullptr;
}

void commandMenuCleanUp() {
}

extern "C" NPP_EXPORT void setInfo(NppData notpadPlusData) {
    g_nppData = notpadPlusData;
    commandMenuInit();
}

extern "C" NPP_EXPORT const wchar_t* getName() {
    return NPP_PLUGIN_NAME;
}

extern "C" NPP_EXPORT FuncItem* getFuncsArray(int* nbF) {
    *nbF = NB_FUNC;
    return funcItem;
}

extern "C" NPP_EXPORT BOOL isUnicode() {
    return TRUE;
}
