// ============================================
// msgpack 資料載入層
// ============================================
// 設計重點：
//   1. 按需載入 —— 進入 /crafting 不該把收集追蹤的資料一起拖下來。
//   2. 同一份資料只會發一次請求 —— 併發呼叫共用同一個 in-flight promise，
//      否則材料樹遞歸會在同一瞬間觸發數十次相同的 fetch。
//   3. 失敗可重試 —— 失敗的 promise 不留在快取裡，下次呼叫會重新嘗試。

import { decode } from '@msgpack/msgpack';
import { withBasePath } from '@/lib/utils/base-path';

const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * 取得原始位元組的方式。
 * 預設走瀏覽器 fetch；測試環境改注入從檔案系統讀取的版本，
 * 這樣就不必為了測試把 node:fs 拉進 client bundle。
 */
export type PackTransport = (path: string) => Promise<Uint8Array>;

async function browserTransport(path: string): Promise<Uint8Array> {
  const url = withBasePath(`/data/${path}`);
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`載入資料失敗 ${path}: HTTP ${res.status}`);
  }

  return new Uint8Array(await res.arrayBuffer());
}

let transport: PackTransport = browserTransport;

/** 覆寫載入方式（測試用） */
export function setPackTransport(next: PackTransport): void {
  transport = next;
}

/**
 * 載入並解碼 public/data 下的 msgpack。
 * @param path 相對於 /data 的路徑，例如 'recipes.msgpack'
 */
export function loadPack<T>(path: string): Promise<T> {
  const cached = cache.get(path);
  if (cached !== undefined) {
    return Promise.resolve(cached as T);
  }

  const pending = inflight.get(path);
  if (pending) {
    return pending as Promise<T>;
  }

  const request = (async () => {
    const bytes = await transport(path);
    const decoded = decode(bytes);

    cache.set(path, decoded);
    return decoded;
  })();

  inflight.set(path, request);

  // 成功或失敗都要把 in-flight 記錄清掉；失敗時不寫入 cache，保留重試機會。
  // 用 then(cleanup, cleanup) 而非 finally()：後者回傳的新 promise 在請求失敗時
  // 沒有人接手，會變成 unhandled rejection。
  const cleanup = () => {
    inflight.delete(path);
  };
  request.then(cleanup, cleanup);

  return request as Promise<T>;
}

/** 該份資料是否已在記憶體中（可用於避免不必要的 loading 狀態） */
export function isPackLoaded(path: string): boolean {
  return cache.has(path);
}

/** 讀取已載入的資料，未載入回傳 undefined（不觸發請求） */
export function peekPack<T>(path: string): T | undefined {
  return cache.get(path) as T | undefined;
}

/** 清除快取（測試用） */
export function clearPackCache(): void {
  cache.clear();
  inflight.clear();
}
