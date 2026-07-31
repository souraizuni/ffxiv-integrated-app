// ============================================
// 一次執行所有資料建置
// ============================================
// npm run build-data
//
// 產出全部落在 public/data/，執行時期由 lib/data/ 按需 fetch。
// 遊戲改版後重跑這支腳本即可；CI 也可定時執行。

import { buildRecipes } from './build-recipes.mjs';
import { buildItems } from './build-items.mjs';
import { buildSources } from './build-sources.mjs';
import { buildCollections } from './build-collections.mjs';
import { buildContentTags } from './build-content-tags.mjs';
import { isEntrypoint } from './_lib.mjs';

const STEPS = {
  recipes: buildRecipes,
  items: buildItems,
  sources: buildSources,
  collections: buildCollections,
  contentTags: buildContentTags,
};

async function main() {
  // 可指定只跑其中幾步：node scripts/build-data/build-all.mjs recipes items
  const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  const steps = requested.length > 0 ? requested : Object.keys(STEPS);

  const unknown = steps.filter((step) => !STEPS[step]);
  if (unknown.length > 0) {
    console.error(`未知的建置步驟: ${unknown.join(', ')}`);
    console.error(`可用步驟: ${Object.keys(STEPS).join(', ')}`);
    process.exit(1);
  }

  const started = Date.now();

  for (const step of steps) {
    await STEPS[step]();
  }

  process.stdout.write(`\n✓ 資料建置完成，耗時 ${((Date.now() - started) / 1000).toFixed(1)} 秒\n`);
}

if (isEntrypoint(import.meta.url)) {
  main().catch((error) => {
    console.error('\n資料建置失敗:', error);
    process.exit(1);
  });
}
