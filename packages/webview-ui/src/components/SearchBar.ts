// ============================================================
// @dabzse/omnigit-webview-ui — Search Bar Controller
//
// Handles commit search/filter with debouncing.
// ============================================================

export interface SearchState {
  query: string;
  filteredHashes: Set<string> | null;
}

type SearchChangeHandler = (state: SearchState) => void;

/**
 * Initialize the search bar with debounced filtering.
 */
export function initSearchBar(
  commits: Array<{ hash: string; subject: string; author: { name: string; email: string }; shortHash: string }>,
  onChange: SearchChangeHandler,
): void {
  const input = document.getElementById('search-input') as HTMLInputElement;
  if (!input) return;

  let debounceTimer: ReturnType<typeof setTimeout>;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      const query = input.value.trim().toLowerCase();

      if (!query) {
        onChange({ query: '', filteredHashes: null });
        return;
      }

      const filtered = new Set<string>();

      for (const commit of commits) {
        if (
          commit.subject.toLowerCase().includes(query) ||
          commit.author.name.toLowerCase().includes(query) ||
          commit.author.email.toLowerCase().includes(query) ||
          commit.hash.startsWith(query) ||
          commit.shortHash.startsWith(query)
        ) {
          filtered.add(commit.hash);
        }
      }

      onChange({ query, filteredHashes: filtered });
    }, 200); // 200ms debounce
  });

  // Clear on Escape
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      onChange({ query: '', filteredHashes: null });
      input.blur();
    }
  });
}

/**
 * Apply search filtering to commit rows — hides non-matching rows.
 */
export function applySearchFilter(
  container: HTMLElement,
  state: SearchState,
): void {
  const rows = container.querySelectorAll('.commit-row') as NodeListOf<HTMLElement>;

  for (const row of rows) {
    const hash = row.dataset.hash;
    if (!hash) continue;

    if (state.filteredHashes === null || state.filteredHashes.has(hash)) {
      // No filter or matching commit — show clearly
      row.style.display = '';
      row.style.opacity = '1';
    } else {
      row.style.display = '';
      row.style.opacity = '0.2';
    }
  }
}
