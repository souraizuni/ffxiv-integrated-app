import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setPackTransport, clearPackCache } from '@/lib/data/msgpack-loader';
import { getContentTags, getContentRecipeIds, isRecipeInContent } from '@/lib/data/content-tags';
import { searchRecipeInfos } from '@/lib/data/recipes';

// ============================================
// 活動（內容）配方篩選
// ============================================
// 整份配方庫有一萬多個配方，跑特定活動時只想看該活動的那幾百個。
// 清單來自遊戲資料的專屬表格（WKSMissionRecipe），
// 不是用「材料是不是宇宙貨箱」推斷 —— 後者會漏掉不使用該材料的中間製品。

let networkCalls = 0;

beforeAll(() => {
  clearPackCache();
  setPackTransport(async (path) => {
    const file = resolve(process.cwd(), 'public/data', path);
    return new Uint8Array(await readFile(file));
  });

  const original = globalThis.fetch;
  globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
    networkCalls++;
    return original(...args);
  }) as typeof fetch;
});

describe('活動清單', () => {
  it('提供宇宙探索', async () => {
    const tags = await getContentTags();
    const cosmic = tags.find((t) => t.id === 'cosmic');

    expect(cosmic).toBeDefined();
    expect(cosmic!.label).toBe('宇宙探索');
    // 8 個製作職業各約 198 個
    expect(cosmic!.recipeCount).toBeGreaterThan(1000);
  });

  it('未知活動回傳空集合而非拋錯', async () => {
    expect((await getContentRecipeIds('nope')).size).toBe(0);
  });
});

describe('依活動篩選配方', () => {
  it('只回傳該活動的配方', async () => {
    const cosmicIds = await getContentRecipeIds('cosmic');
    const page = await searchRecipeInfos({ contentId: 'cosmic', pageSize: 50 });

    expect(page.results.length).toBeGreaterThan(0);
    expect(page.results.every((r) => cosmicIds.has(r.id))).toBe(true);
  });

  it('大幅收斂結果數量', async () => {
    const all = await searchRecipeInfos({ pageSize: 1 });
    const cosmic = await searchRecipeInfos({ contentId: 'cosmic', pageSize: 1 });

    expect(cosmic.totalCount).toBeLessThan(all.totalCount);
    expect(cosmic.totalCount).toBeGreaterThan(1000);
  });

  it('八個製作職業都有配方', async () => {
    const jobs = new Set<string>();
    for (let page = 1; page <= 40; page++) {
      const result = await searchRecipeInfos({ contentId: 'cosmic', page, pageSize: 50 });
      result.results.forEach((r) => jobs.add(r.job));
      if (page >= result.totalPages) break;
    }
    expect(jobs.size).toBe(8);
  });

  it('可與職業條件併用', async () => {
    // craftTypeId 7 = 烹調
    const page = await searchRecipeInfos({ contentId: 'cosmic', craftTypeId: 7, pageSize: 50 });
    expect(page.results.length).toBeGreaterThan(0);
    expect(page.results.every((r) => r.job === '烹調')).toBe(true);
  });

  it('分頁一致且不重複', async () => {
    const p1 = await searchRecipeInfos({ contentId: 'cosmic', page: 1, pageSize: 20 });
    const p2 = await searchRecipeInfos({ contentId: 'cosmic', page: 2, pageSize: 20 });

    expect(p1.results).toHaveLength(20);
    const overlap = p1.results.filter((a) => p2.results.some((b) => b.id === a.id));
    expect(overlap).toHaveLength(0);
  });

  it('回傳的欄位符合配方面板的既有契約', async () => {
    const page = await searchRecipeInfos({ contentId: 'cosmic', pageSize: 1 });
    const r = page.results[0];

    // 面板實際會讀的欄位
    expect(typeof r.id).toBe('number');
    expect(typeof r.item_name).toBe('string');
    expect(r.item_name.length).toBeGreaterThan(0);
    expect(typeof r.job).toBe('string');
    expect(typeof r.rlv).toBe('number');
    expect(typeof r.can_hq).toBe('boolean');
    expect(typeof r.difficulty_factor).toBe('number');
    expect(typeof r.quality_factor).toBe('number');
  });

  it('isRecipeInContent 判斷正確', async () => {
    const ids = [...(await getContentRecipeIds('cosmic'))];
    expect(await isRecipeInContent(ids[0], 'cosmic')).toBe(true);
    // 青銅錠（recipe 1）不屬於宇宙探索
    expect(await isRecipeInContent(1, 'cosmic')).toBe(false);
  });

  it('整個篩選流程零網路請求', async () => {
    networkCalls = 0;
    await searchRecipeInfos({ contentId: 'cosmic', pageSize: 50 });
    await getContentTags();
    expect(networkCalls).toBe(0);
  });
});
