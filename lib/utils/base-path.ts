// ============================================
// BasePath 工具函式
// 用於 GitHub Pages 部署時正確處理資源路徑
// ============================================

/**
 * 取得應用程式的 basePath
 * 在 GitHub Pages 部署時會是 /ffxiv-integrated-app
 * 在本地開發時會是空字串
 */
export function getBasePath(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  
  // 嘗試從 Next.js 的 __NEXT_DATA__ 取得
  const nextData = (window as any).__NEXT_DATA__;
  if (nextData?.basePath) {
    return nextData.basePath;
  }
  
  // 備用方案：從目前的 pathname 推斷
  // 如果 URL 是 /ffxiv-integrated-app/xxx，則 basePath 是 /ffxiv-integrated-app
  const pathname = window.location.pathname;
  const match = pathname.match(/^(\/[^/]+)/);
  
  // 檢查是否為已知的 basePath
  if (match && match[1] === '/ffxiv-integrated-app') {
    return '/ffxiv-integrated-app';
  }
  
  return '';
}

/**
 * 將相對路徑轉換為完整路徑（包含 basePath）
 * @param path - 相對路徑，例如 '/data/collections_data.json'
 */
export function withBasePath(path: string): string {
  const basePath = getBasePath();
  
  // 確保路徑以 / 開頭
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${basePath}${normalizedPath}`;
}
