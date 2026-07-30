// ============================================
// 拆分收集追蹤資料 public/data/collections/*.msgpack
// ============================================
// 原本 public/data/collections_data.json 是單一 34.8 MB 的檔案，
// 收集頁一掛載就整包 fetch，但畫面同時只顯示一個分頁。
// 其中 Glamour 一項就佔 20,979 / 23,540 筆（約九成）。
//
// 改成：一個小索引 + 每個收集類型一個檔案，只載入使用者正在看的那一個。
// 另外 IconUrl 是可由 IconId 推導的完整網址（https://xivapi.com/i/XXX000/XXXXXX.png），
// 逐筆存等於把同一段前綴重複兩萬多次，直接移除。

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { writePack, logStep, formatBytes, isEntrypoint, ROOT, OUT_DIR } from './_lib.mjs';
import { mkdir } from 'node:fs/promises';

/** 收集類型名稱 → 檔名（英數與連字號） */
export function collectionSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function buildCollections() {
  logStep('▶ 拆分收集追蹤資料');

  const path = resolve(ROOT, 'data/collections_data.json');
  const raw = await readFile(path, 'utf8');
  process.stdout.write(`  讀取 collections_data.json  ${formatBytes(Buffer.byteLength(raw))}\n`);

  const data = JSON.parse(raw);
  await mkdir(resolve(OUT_DIR, 'collections'), { recursive: true });

  const index = [];
  let totalSize = 0;
  let largestSize = 0;
  let largestName = '';

  for (const collection of data.Collections) {
    const slug = collectionSlug(collection.CollectionName);

    const items = collection.Items.map((item) => ({
      id: item.Id,
      n: item.Name,
      d: item.Description || '',
      p: item.PatchAdded,
      dp: item.DisplayPatch,
      c: item.IconId,
      // Sources 是篩選與詳情的核心資料，完整保留
      s: (item.Sources || []).map((source) => ({
        n: source.Name,
        t: source.Type,
        c: source.Categories || [],
      })),
    }));

    const size = await writePack(`collections/${slug}.msgpack`, {
      v: 1,
      name: collection.CollectionName,
      items,
    });
    totalSize += size;
    if (size > largestSize) {
      largestSize = size;
      largestName = collection.CollectionName;
    }

    index.push({
      name: collection.CollectionName,
      slug,
      orderKey: collection.OrderKey,
      count: items.length,
    });
  }

  index.sort((a, b) => a.orderKey - b.orderKey);

  await writePack('collections/index.msgpack', {
    v: 1,
    exportedAt: data.ExportedAt,
    collections: index,
  });

  process.stdout.write(
    `  共 ${index.length} 個收集類型、${index.reduce((s, c) => s + c.count, 0)} 筆項目，合計 ${formatBytes(totalSize)}\n`
  );
  process.stdout.write(
    `  最大單檔為 ${largestName} ${formatBytes(largestSize)}；首次進入頁面只需載入預設分頁那一個\n`
  );
}

if (isEntrypoint(import.meta.url)) {
  buildCollections().catch((error) => {
    console.error('拆分收集資料失敗:', error);
    process.exit(1);
  });
}
