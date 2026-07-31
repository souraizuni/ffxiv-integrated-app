// ============================================
// 產生「活動／內容」配方標記 public/data/content-tags.msgpack
// ============================================
// 動機：整份配方庫有 13,892 個配方，但玩家實際在做某個活動時，
// 只關心該活動的那幾百個。宇宙探索（7.2）光一個活動就有 1,584 個配方，
// 分散在全部清單裡等於找不到。
//
// 作法：從遊戲資料的專屬表格直接取得配方清單，而不是用「材料是不是某個物品」
// 這種間接推斷 —— 後者會漏掉不使用該材料的中間製品（實測宇宙探索有 280 個這種）。
//
// 目前支援：
//   cosmic — 宇宙探索（內部代號 WKS，資料表 WKSMissionRecipe）
//
// 日後新增活動時，在 SOURCES 加一筆即可；資料格式不需要改。

import { crawlSheet, getGameVersion, writePack, logStep, isEntrypoint } from './_lib.mjs';

/**
 * 每個活動一筆。
 * sheet + field 指向遊戲資料中「該活動用到哪些配方」的表格。
 */
const SOURCES = [
  {
    id: 'cosmic',
    label: '宇宙探索',
    // 宇宙探索的內部代號是 WKS；這張表列出各任務可製作的配方
    sheet: 'WKSMissionRecipe',
    field: 'Recipe@as(raw)',
  },
];

/** 從一列資料中取出配方 id（欄位可能是單值或陣列） */
function extractRecipeIds(value) {
  if (Array.isArray(value)) {
    return value.filter((v) => typeof v === 'number' && v > 0);
  }
  return typeof value === 'number' && value > 0 ? [value] : [];
}

export async function buildContentTags() {
  logStep('▶ 建置活動配方標記');

  const version = await getGameVersion();
  const contents = [];

  for (const source of SOURCES) {
    process.stdout.write(`  抓取 ${source.sheet}（${source.label}）…\n`);

    const rows = await crawlSheet(source.sheet, source.field, {
      onPage: (total) => process.stdout.write(`\r    ${total} 列`),
    });
    process.stdout.write('\n');

    const recipeIds = new Set();
    for (const row of rows) {
      for (const id of extractRecipeIds(row.fields?.[source.field])) {
        recipeIds.add(id);
      }
    }

    const sorted = [...recipeIds].sort((a, b) => a - b);
    contents.push({ id: source.id, label: source.label, recipes: sorted });

    process.stdout.write(`  ${source.label}：${sorted.length} 個配方\n`);
  }

  await writePack('content-tags.msgpack', {
    v: 1,
    generatedAt: new Date().toISOString(),
    game: version,
    contents,
  });
}

if (isEntrypoint(import.meta.url)) {
  buildContentTags().catch((error) => {
    console.error('建置活動標記失敗:', error);
    process.exit(1);
  });
}
