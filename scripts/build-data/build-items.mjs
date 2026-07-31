// ============================================
// 產生本地物品資料庫 public/data/items.msgpack
// ============================================
// 取代兩件事：
//   1. data/tw-items.json（2.1 MB）被 import 進 bundle
//   2. 執行時對 XIVAPI v2 逐筆查物品名稱與圖示
//
// 圖示只存 icon id（數字），路徑可由 id 推導：
//   id 20803 → ui/icon/020000/020803.tex（與 _hr1 高解析版）
// 這比存兩條完整路徑省下大量空間。

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  crawlSheet,
  getGameVersion,
  writePack,
  logStep,
  fetchJson,
  isEntrypoint,
  ROOT,
} from './_lib.mjs';

const ITEM_FIELDS = [
  'Name',
  'Icon',
  'StackSize',
  'IsUntradable',
  'IsCollectable',
  'CanBeHq',
  'ItemUICategory@as(raw)',
  'LevelItem@as(raw)',
].join(',');

export const ITEM_FLAG_UNTRADABLE = 1;
export const ITEM_FLAG_COLLECTABLE = 2;
export const ITEM_FLAG_MARKETABLE = 4;
// 材料能否以 HQ 製作，求解器設定彈窗依賴此欄位決定可勾選的 HQ 材料
export const ITEM_FLAG_CAN_BE_HQ = 8;

export async function buildItems() {
  logStep('▶ 建置物品資料庫');

  const version = await getGameVersion();

  // 繁中名稱有兩個來源，自建者優先：
  //   1. data/tw-items.json —— teamcraft 翻譯資料，涵蓋廣但最大 item id 只到 45590，
  //      7.x 之後的物品（宇宙探索 48xxx 等）完全沒有。
  //   2. data/tw-names.json —— 本專案自建、由 crawl-tw-names.mjs 慢慢爬回來的資料庫。
  //      這是我們自己的資產：即使上游停止服務，已取得的名稱仍然可用。
  const twRaw = await readFile(resolve(ROOT, 'data/tw-items.json'), 'utf8');
  const twItems = JSON.parse(twRaw);
  process.stdout.write(`  繁中名稱（teamcraft）${Object.keys(twItems).length} 筆\n`);

  let ownNames = {};
  try {
    const ownRaw = await readFile(resolve(ROOT, 'data/tw-names.json'), 'utf8');
    ownNames = JSON.parse(ownRaw).names || {};
    process.stdout.write(`  繁中名稱（自建）${Object.keys(ownNames).length} 筆\n`);
  } catch {
    process.stdout.write('  繁中名稱（自建）尚未建立，可執行 npm run crawl-tw-names 補齊\n');
  }

  // 可在市場交易的物品清單（市場頁用來過濾）
  let marketable = new Set();
  try {
    const ids = await fetchJson('https://universalis.app/api/v2/marketable');
    marketable = new Set(ids);
    process.stdout.write(`  可交易物品 ${marketable.size} 筆\n`);
  } catch (error) {
    process.stderr.write(`  ! 取得可交易清單失敗，略過該旗標: ${error.message}\n`);
  }

  process.stdout.write('  抓取 Item…\n');
  const rows = await crawlSheet('Item', ITEM_FIELDS, {
    onPage: (total) => process.stdout.write(`\r    ${total} 列`),
  });
  process.stdout.write('\n');

  const items = {};
  let named = 0;

  for (const row of rows) {
    const f = row.fields || {};
    const nameEn = f.Name || '';
    // 自建資料庫優先：它比 teamcraft 那份新，且是我們自己維護的
    const nameTw = ownNames[String(row.row_id)] || twItems[String(row.row_id)]?.tw || '';

    // 兩種語言都沒名字的列是空列，沒有保留價值
    if (!nameEn && !nameTw) continue;

    let flags = 0;
    if (f.IsUntradable) flags |= ITEM_FLAG_UNTRADABLE;
    if (f.IsCollectable) flags |= ITEM_FLAG_COLLECTABLE;
    if (marketable.has(row.row_id)) flags |= ITEM_FLAG_MARKETABLE;
    if (f.CanBeHq) flags |= ITEM_FLAG_CAN_BE_HQ;

    items[row.row_id] = {
      n: nameTw,                                // 繁中名稱（可能為空）
      e: nameEn,                                // 英文名稱
      c: f.Icon?.id ?? 0,                       // icon id
      l: f['LevelItem@as(raw)'] ?? 1,           // item level
      s: f.StackSize ?? 1,
      u: f['ItemUICategory@as(raw)'] ?? 0,
      f: flags,
    };

    if (nameTw) named++;
  }

  // ItemUICategory 名稱（約 120 筆，很小，一起打包）
  process.stdout.write('  抓取 ItemUICategory…\n');
  const categoryRows = await crawlSheet('ItemUICategory', 'Name');
  const categories = {};
  for (const row of categoryRows) {
    const name = row.fields?.Name;
    if (name) categories[row.row_id] = name;
  }

  const payload = {
    v: 1,
    generatedAt: new Date().toISOString(),
    game: version,
    items,
    categories,
  };

  process.stdout.write(
    `  物品 ${Object.keys(items).length} 筆（其中 ${named} 筆有繁中名稱）、分類 ${Object.keys(categories).length} 筆\n`
  );

  await writePack('items.msgpack', payload);
  return payload;
}

if (isEntrypoint(import.meta.url)) {
  buildItems().catch((error) => {
    console.error('建置物品資料庫失敗:', error);
    process.exit(1);
  });
}
