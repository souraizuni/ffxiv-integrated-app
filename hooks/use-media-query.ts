'use client';

import { useSyncExternalStore, useCallback } from 'react';

// ============================================
// 視窗尺寸查詢
// ============================================
// 用 useSyncExternalStore 而非 useEffect + setState：
// 本專案是靜態輸出（output: 'export'），頁面在建置時預先渲染，
// 若在 effect 裡讀 window.matchMedia 再 setState，首次繪製會閃一下，
// 且與預渲染的 HTML 不一致。getServerSnapshot 正是為此設計。

/**
 * 訂閱一個 media query。
 * 預渲染階段一律回傳 false（視為窄螢幕），因此版面應以行動裝置為預設。
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  // 預渲染時沒有 window；回 false 代表「先假設是窄螢幕」
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Tailwind 的 lg 斷點（1024px） */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}
