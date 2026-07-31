// ============================================
// 自建繁體中文物品名稱資料庫（可續爬）
// ============================================
// 動機：本專案已經被外部資料源停服害過一次（Cafemaker，HTTP 530），
// 而現有的 data/tw-items.json（teamcraft）最大 item id 只到 45590，
// 7.x 之後的物品（宇宙探索 48xxx 等）全部沒有繁中名稱。
//
// 作法：在建置期把繁中名稱慢慢爬回來存成自己的資料檔（data/tw-names.json，進版控），
// 之後即使 yyyy.games 停止服務，已爬到的名稱仍然可用。
//
// 用法：
//   node scripts/build-data/crawl-tw-names.mjs              補齊配方引用到但缺名稱的物品
//   node scripts/build-data/crawl-tw-names.mjs --all        涵蓋物品庫中所有缺名稱的物品
//   node scripts/build-data/crawl-tw-names.mjs --refresh    重新抓取已存在的名稱（改版後刷新）
//   node scripts/build-data/crawl-tw-names.mjs --retry-miss 重試先前查無名稱的 id
//   node scripts/build-data/crawl-tw-names.mjs --limit 500  本次最多處理幾筆（分批進行）
//
// 隨時可以 Ctrl-C 中斷：進度會定期存檔，下次執行自動接續。

import { decode } from '@msgpack/msgpack';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { ROOT, sleep, isEntrypoint } from './_lib.mjs';

const YYYY_BASE = 'https://tnze.yyyy.games/api/datasource/zh-TW';

// 自建資料檔：這是我們自己的資產，不隨外部服務存亡
const DB_PATH = resolve(ROOT, 'data/tw-names.json');

// 對免費服務的自制。
// 首次實測用併發 3 + 120ms 間隔跑 1,700 筆時，後段開始持續 502，
// 失敗率衝到 29% —— 壓太兇反而更慢。改為保守設定並加上自適應退讓。
const CONCURRENCY = 2;
const BASE_GAP_MS = 350;
const MAX_GAP_MS = 4000;

// 每處理這麼多筆就存檔一次，中斷時最多只損失這些進度
const CHECKPOINT_EVERY = 50;

/**
 * 資料檔格式：
 * {
 *   version: 1,
 *   updatedAt: ISO 時間,
 *   names:  { "48233": "宇宙貨箱", ... },   // 已取得的繁中名稱
 *   misses: [48234, ...]                    // 查詢過但沒有名稱的 id（避免每次重爬）
 * }
 */
async function loadDb() {
  if (!existsSync(DB_PATH)) {
    return { version: 1, updatedAt: null, names: {}, misses: [] };
  }

  const raw = await readFile(DB_PATH, 'utf8');
  const parsed = JSON.parse(raw);

  return {
    version: parsed.version ?? 1,
    updatedAt: parsed.updatedAt ?? null,
    names: parsed.names ?? {},
    misses: Array.isArray(parsed.misses) ? parsed.misses : [],
  };
}

/** 先寫暫存檔再改名，避免中斷時留下半個壞掉的 JSON */
async function saveDb(db) {
  await mkdir(dirname(DB_PATH), { recursive: true });

  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    names: db.names,
    misses: [...new Set(db.misses)].sort((a, b) => a - b),
  };

  const tmp = `${DB_PATH}.tmp`;
  await writeFile(tmp, JSON.stringify(payload, null, 0));
  await rename(tmp, DB_PATH);
}

// 重試次數刻意壓低。
// 實測發現：對「yyyy.games 沒有 zh-TW 資料」的 item id（例如部分 7.x 染料、家具），
// 該端點是穩定回 502 而不是回空名稱 —— 慢速單獨請求也一樣。
// 也就是說 502 在這裡多半代表「查無資料」而非伺服器暫時故障，
// 重試五次只會讓每筆卡上數十秒。少量重試足以吸收真正的暫時性錯誤。
const MAX_RETRIES = 2;

// 自適應節流：連續失敗就拉長間隔，成功則慢慢收回。
// 用來應付服務端真的開始限流的情況。
let currentGap = BASE_GAP_MS;

function onRequestFailure() {
  currentGap = Math.min(Math.round(currentGap * 1.4) + 100, MAX_GAP_MS);
}

function onRequestSuccess() {
  if (currentGap > BASE_GAP_MS) {
    currentGap = Math.max(BASE_GAP_MS, Math.round(currentGap * 0.8));
  }
}

function isTransient(status) {
  if (typeof status !== 'number') return false;
  return status === 429 || (status >= 500 && status < 600);
}

async function fetchItemName(itemId) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${YYYY_BASE}/item_info?item_id=${itemId}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });

      if (!res.ok) {
        const error = Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
        // 4xx（非 429）是請求本身的問題，重試沒有意義
        if (!isTransient(res.status)) throw error;
        lastError = error;
      } else {
        const data = await res.json();
        onRequestSuccess();
        // 查無資料時 API 仍回 200，但 name 是空字串
        return typeof data?.name === 'string' && data.name.length > 0 ? data.name : null;
      }
    } catch (error) {
      if (error.status !== undefined && !isTransient(error.status)) throw error;
      lastError = error;
    }

    onRequestFailure();

    if (attempt < MAX_RETRIES) {
      await sleep(Math.min(600 * 2 ** attempt, 3000));
    }
  }

  throw lastError;
}

/** 決定這次要處理哪些 item id */
async function resolveTargets({ all }) {
  const items = decode(new Uint8Array(await readFile(resolve(ROOT, 'public/data/items.msgpack'))));

  if (all) {
    // 物品庫中所有沒有繁中名稱的
    return Object.entries(items.items)
      .filter(([, it]) => !it.n)
      .map(([id]) => Number(id));
  }

  // 預設：只補配方會用到的（成品與材料），這是使用者實際看得到的部分
  const recipes = decode(
    new Uint8Array(await readFile(resolve(ROOT, 'public/data/recipes.msgpack')))
  );

  const referenced = new Set();
  for (const r of recipes.recipes) {
    referenced.add(r.t);
    for (const [ingredientId] of r.g) {
      if (ingredientId > 0) referenced.add(ingredientId);
    }
  }

  return [...referenced].filter((id) => {
    const it = items.items[String(id)];
    return it && !it.n;
  });
}

export async function crawlTwNames(options = {}) {
  const { all = false, refresh = false, retryMiss = false, limit = Infinity } = options;

  const db = await loadDb();
  const missSet = new Set(db.misses);

  const targets = await resolveTargets({ all });

  const pending = targets.filter((id) => {
    if (!refresh && db.names[String(id)]) return false;     // 已有名稱
    if (!refresh && !retryMiss && missSet.has(id)) return false; // 先前確認沒有
    return true;
  });

  const batch = pending.slice(0, limit === Infinity ? pending.length : limit);

  process.stdout.write(
    `\n▶ 繁中名稱爬取\n` +
      `  目標範圍：${all ? '物品庫全部缺名稱者' : '配方引用到且缺名稱者'}\n` +
      `  待處理 ${pending.length} 筆，本次處理 ${batch.length} 筆\n` +
      `  已有名稱 ${Object.keys(db.names).length} 筆、已知查無 ${missSet.size} 筆\n\n`
  );

  if (batch.length === 0) {
    process.stdout.write('  沒有需要處理的項目\n');
    return db;
  }

  let done = 0;
  let added = 0;
  let missed = 0;
  let failed = 0;
  let stopping = false;

  // Ctrl-C 時先把進度寫回去再退出，不要白爬
  const onSigint = () => {
    if (stopping) process.exit(130);
    stopping = true;
    process.stdout.write('\n  收到中斷訊號，正在存檔…\n');
  };
  process.on('SIGINT', onSigint);

  let cursor = 0;
  async function worker() {
    while (cursor < batch.length && !stopping) {
      const itemId = batch[cursor++];

      try {
        const name = await fetchItemName(itemId);

        if (name) {
          db.names[String(itemId)] = name;
          added++;
          // 先前記為查無、這次拿到了，就把它移出 misses
          if (missSet.has(itemId)) {
            missSet.delete(itemId);
            db.misses = db.misses.filter((id) => id !== itemId);
          }
        } else {
          if (!missSet.has(itemId)) {
            missSet.add(itemId);
            db.misses.push(itemId);
          }
          missed++;
        }
      } catch (error) {
        // 重試用盡的 5xx 視為「上游沒有這筆 zh-TW 資料」而非暫時故障。
        // 實測 yyyy.games 對缺資料的 item id 是穩定回 502（慢速單獨請求也一樣），
        // 不記進 misses 的話這幾百筆會每次重跑、永遠跑不完。
        // 日後繁中客戶端更新後可用 --retry-miss 重新嘗試。
        if (isTransient(error?.status)) {
          if (!missSet.has(itemId)) {
            missSet.add(itemId);
            db.misses.push(itemId);
          }
          missed++;
        } else {
          failed++;
          if (failed <= 5) {
            process.stderr.write(`
  ! item ${itemId} 失敗：${error.message}
`);
          }
        }
      }

      done++;

      if (done % CHECKPOINT_EVERY === 0) {
        await saveDb(db);
        const pct = ((done / batch.length) * 100).toFixed(1);
        process.stdout.write(
          `\r  ${done}/${batch.length} (${pct}%)　新增 ${added}　查無 ${missed}　失敗 ${failed}   `
        );
      }

      await sleep(currentGap);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batch.length) }, worker));

  await saveDb(db);
  process.removeListener('SIGINT', onSigint);

  process.stdout.write(
    `\r  ${done}/${batch.length} 完成　新增 ${added}　查無 ${missed}　失敗 ${failed}        \n`
  );
  process.stdout.write(`  資料庫現有 ${Object.keys(db.names).length} 筆繁中名稱 → data/tw-names.json\n`);

  if (stopping) {
    process.stdout.write('  （已中斷，進度已保存，再次執行會自動接續）\n');
  }

  return db;
}

function parseArgs(argv) {
  const limitIndex = argv.indexOf('--limit');
  return {
    all: argv.includes('--all'),
    refresh: argv.includes('--refresh'),
    retryMiss: argv.includes('--retry-miss'),
    limit: limitIndex >= 0 ? Number(argv[limitIndex + 1]) || Infinity : Infinity,
  };
}

if (isEntrypoint(import.meta.url)) {
  crawlTwNames(parseArgs(process.argv.slice(2))).catch((error) => {
    console.error('爬取失敗:', error);
    process.exit(1);
  });
}
