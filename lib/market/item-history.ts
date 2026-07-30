// ============================================
// 市場查詢的瀏覽歷史
// ============================================
// 做成可訂閱的 external store 而不是在 effect 裡讀 localStorage：
// 本專案是靜態輸出（output: 'export'），頁面會在建置時預先渲染。
// 若在 render / mount effect 中直接讀 localStorage，預渲染的 HTML 與
// hydration 後的結果會不一致。useSyncExternalStore 的 getServerSnapshot 正是為此設計。

const STORAGE_KEY = 'ffxiv-market-item-history';
const HISTORY_LIMIT = 12;

export interface MarketHistoryEntry {
  id: number;
  name: string;
  iconUrl: string;
}

const EMPTY: MarketHistoryEntry[] = [];
const listeners = new Set<() => void>();

let snapshot: MarketHistoryEntry[] = EMPTY;
let loaded = false;

function readFromStorage(): MarketHistoryEntry[] {
  if (typeof window === 'undefined') return EMPTY;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;

    return parsed
      .filter((e): e is MarketHistoryEntry => Boolean(e && typeof e.id === 'number'))
      .slice(0, HISTORY_LIMIT);
  } catch {
    return EMPTY;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

/** 目前快照（參考穩定，供 useSyncExternalStore） */
export function getMarketHistorySnapshot(): MarketHistoryEntry[] {
  if (!loaded) {
    snapshot = readFromStorage();
    loaded = true;
  }
  return snapshot;
}

/** 預渲染階段的快照：localStorage 不存在 */
export function getMarketHistoryServerSnapshot(): MarketHistoryEntry[] {
  return EMPTY;
}

export function subscribeMarketHistory(listener: () => void): () => void {
  listeners.add(listener);

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    snapshot = readFromStorage();
    loaded = true;
    emit();
  };

  window.addEventListener('storage', handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
}

/** 記錄一次查詢；同一物品會被移到最前面而非重複 */
export function pushMarketHistory(entry: MarketHistoryEntry): void {
  const current = getMarketHistorySnapshot();
  const next = [entry, ...current.filter((h) => h.id !== entry.id)].slice(0, HISTORY_LIMIT);

  snapshot = next;
  loaded = true;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 隱私模式等情境下寫入會失敗；瀏覽歷史不是關鍵功能，畫面仍會更新
  }

  emit();
}

/** 清空瀏覽歷史 */
export function clearMarketHistory(): void {
  snapshot = EMPTY;
  loaded = true;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略
  }

  emit();
}
