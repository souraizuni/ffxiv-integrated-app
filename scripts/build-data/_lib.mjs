// ============================================
// 資料建置共用工具
// ============================================
// 這些腳本在建置時執行（npm run build-data），把外部 API 與既有 JSON
// 壓成 public/data/*.msgpack。執行時期就不再需要打外部 API 取遊戲靜態資料。

import { encode } from '@msgpack/msgpack';
import { writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * 判斷這個模組是否是被直接執行的進入點。
 * Windows 上不能用字串拼 `file://${process.argv[1]}`（磁碟機路徑的斜線數不同），
 * 必須經過 pathToFileURL 正規化。
 */
export function isEntrypoint(moduleUrl) {
  if (!process.argv[1]) return false;
  return moduleUrl === pathToFileURL(process.argv[1]).href;
}

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const OUT_DIR = resolve(ROOT, 'public/data');

export const XIVAPI_V2 = 'https://v2.xivapi.com/api';

// XIVAPI v2 沒有公開的硬性速率上限，但這是別人免費提供的服務。
// 併發壓在 4、失敗指數退避，是禮貌也是穩定性。
const CONCURRENCY = 4;
const MAX_RETRIES = 4;

/** 帶重試與逾時的 fetch */
export async function fetchJson(url, { retries = MAX_RETRIES } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });

      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        // 4xx（除了 429）通常是請求本身有問題，重試沒有意義
        const body = await res.text();
        throw Object.assign(new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`), {
          fatal: true,
        });
      }

      return await res.json();
    } catch (error) {
      lastError = error;
      if (error.fatal || attempt === retries) break;

      const delay = Math.min(1000 * 2 ** attempt, 15_000);
      process.stderr.write(`  ! ${error.message}，${delay}ms 後重試 (${attempt + 1}/${retries})\n`);
      await sleep(delay);
    }
  }

  throw lastError;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 以固定併發跑完所有任務，保留輸入順序 */
export async function mapWithConcurrency(items, worker, concurrency = CONCURRENCY) {
  const results = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

/**
 * 走訪 XIVAPI v2 的整張 sheet（limit + after 分頁）
 * onPage 每取得一頁就被呼叫一次，方便顯示進度而不必先全部塞進記憶體。
 */
export async function crawlSheet(sheet, fields, { pageSize = 500, onPage } = {}) {
  const rows = [];
  let after = -1;

  while (true) {
    const url =
      `${XIVAPI_V2}/sheet/${sheet}?limit=${pageSize}` +
      (after >= 0 ? `&after=${after}` : '') +
      (fields ? `&fields=${encodeURIComponent(fields)}` : '');

    const page = await fetchJson(url);
    const pageRows = page.rows || [];
    if (pageRows.length === 0) break;

    rows.push(...pageRows);
    onPage?.(rows.length, pageRows[pageRows.length - 1].row_id);

    after = pageRows[pageRows.length - 1].row_id;
    if (pageRows.length < pageSize) break;
  }

  return rows;
}

/** 取得 XIVAPI v2 目前的資料版本（寫進輸出檔，方便判斷資料新舊） */
export async function getGameVersion() {
  const probe = await fetchJson(`${XIVAPI_V2}/sheet/Item?limit=1&fields=Name`);
  return { schema: probe.schema, version: probe.version };
}

/** 寫出 msgpack 並回報大小 */
export async function writePack(filename, data) {
  await mkdir(OUT_DIR, { recursive: true });
  const target = resolve(OUT_DIR, filename);
  const encoded = encode(data);
  await writeFile(target, encoded);

  const { size } = await stat(target);
  process.stdout.write(`  → ${filename}  ${formatBytes(size)}\n`);
  return size;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function logStep(message) {
  process.stdout.write(`\n${message}\n`);
}
