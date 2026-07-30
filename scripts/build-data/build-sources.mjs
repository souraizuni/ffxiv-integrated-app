// ============================================
// 產生物品來源／地圖資料 public/data/sources.msgpack、npcs.msgpack
// ============================================
// 這幾份 JSON 原本被 lib/item-sources.ts 與 lib/map-service.ts 用 import 靜態載入，
// 因此整包（其中 npcs.json 就有 16.9 MB）被打進 JS bundle，
// 讓 /crafting 的主 chunk 膨脹到 12.3 MB。
//
// npcs 另外拆一包：它遠大於其他三份，而且只有在使用者點開「取得方式」時才需要。

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { writePack, logStep, formatBytes, isEntrypoint, ROOT } from './_lib.mjs';

async function readJson(relativePath) {
  const raw = await readFile(resolve(ROOT, relativePath), 'utf8');
  process.stdout.write(`  讀取 ${relativePath}  ${formatBytes(Buffer.byteLength(raw))}\n`);
  return JSON.parse(raw);
}

/**
 * 精簡 NPC 資料。
 * lib/item-sources.ts 只讀 en / ja / title.en / title.ja / position，
 * 而且會直接略過沒有 position 的 NPC，因此其餘欄位（de / fr / defaultTalks）
 * 與無座標的 NPC 全部可以丟掉。實測 58,497 筆 → 37,951 筆，16.9 MB → 約 4.9 MB。
 */
function slimNpcs(npcs) {
  const slim = {};

  for (const [id, npc] of Object.entries(npcs)) {
    if (!npc?.position) continue;

    const record = {
      en: npc.en || '',
      ja: npc.ja || '',
      position: {
        zoneid: npc.position.zoneid,
        map: npc.position.map,
        x: npc.position.x,
        y: npc.position.y,
      },
    };

    if (npc.title?.en || npc.title?.ja) {
      record.title = { en: npc.title.en || '', ja: npc.title.ja || '' };
    }

    slim[id] = record;
  }

  return slim;
}

export async function buildSources() {
  logStep('▶ 建置物品來源與地圖資料');

  const [nodes, placesZh, mapEntries, npcs] = await Promise.all([
    readJson('data/nodes.json'),
    readJson('data/places-zh.json'),
    readJson('data/map-entries.json'),
    readJson('data/npcs.json'),
  ]);

  const slimmedNpcs = slimNpcs(npcs);
  process.stdout.write(
    `  NPC ${Object.keys(npcs).length} 筆 → 保留有座標的 ${Object.keys(slimmedNpcs).length} 筆\n`
  );

  await writePack('sources.msgpack', {
    v: 1,
    generatedAt: new Date().toISOString(),
    nodes,
    placesZh,
    mapEntries,
  });

  await writePack('npcs.msgpack', {
    v: 1,
    generatedAt: new Date().toISOString(),
    npcs: slimmedNpcs,
  });
}

if (isEntrypoint(import.meta.url)) {
  buildSources().catch((error) => {
    console.error('建置來源資料失敗:', error);
    process.exit(1);
  });
}
