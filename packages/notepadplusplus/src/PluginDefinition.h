#pragma once

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shellapi.h>
#define NPP_EXPORT __declspec(dllexport)
#else
// Cross-platform compatibility stubs for non-Windows IDE tooling & static analysis
#include <cstdint>
#include <cstring>
#include <cwchar>

#define NPP_EXPORT
#define APIENTRY
#define DLL_PROCESS_ATTACH 1
#define CP_UTF8 65001
#define SW_SHOWNORMAL 1
#define TRUE 1
#define FALSE 0

typedef void* HWND;
typedef void* HANDLE;
typedef void* HINSTANCE;
typedef void* HMODULE;
typedef void* LPVOID;
typedef unsigned long DWORD;
typedef int BOOL;
typedef intptr_t LONG_PTR;
typedef LONG_PTR LPARAM;
typedef uintptr_t UINT_PTR;
typedef UINT_PTR WPARAM;
typedef LONG_PTR LRESULT;

inline LRESULT SendMessage(HWND, unsigned int, WPARAM, LPARAM) { return 0; }
inline int WideCharToMultiByte(unsigned int, DWORD, const wchar_t*, int, char*, int, const char*, BOOL*) { return 0; }
inline HINSTANCE ShellExecuteW(HWND, const wchar_t*, const wchar_t*, const wchar_t*, const wchar_t*, int) { return nullptr; }

template <size_t N>
inline int wcscpy_s(wchar_t (&dest)[N], const wchar_t* src) {
    if (src) {
        wcsncpy(dest, src, N - 1);
        dest[N - 1] = L'\0';
    }
    return 0;
}
#endif

// Notepad++ Plugin API definitions
struct NppData {
    HWND _nppHandle;
    HWND _scintillaMainHandle;
    HWND _scintillaSecondHandle;
};

struct FuncItem {
    wchar_t _itemName[64];
    void (*_pFunc)();
    int _cmdID;
    bool _init2Check;
    void* _pShKey;
};

// Menu commands
void ShowGitGraphDialog();
void ToggleInlineBlame();

void pluginInit(HANDLE hModule);
void pluginCleanUp();
void commandMenuInit();
void commandMenuCleanUp();
