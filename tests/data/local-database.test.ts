import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setPackTransport, clearPackCache } from '@/lib/data/msgpack-loader';
import {
  getItem,
  getItems,
  searchItems,
  iconUrlFromId,
  getGameDataVersion,
} from '@/lib/data/items';
import {
  getRecipeByItemId,
  getRecipesByItemId,
  getRecipeById,
  listRecipes,
  getRecipeDataStats,
} from '@/lib/data/recipes';

// ============================================
// 本地 msgpack 資料庫
// ============================================
// 這一層取代了先前每建一次材料樹就要打數十次外部 API 的做法。
// 資料若產錯，模擬器的難度/品質/耐久會整組偏掉而且不會有任何錯誤訊息，
// 所以這裡逐欄位對照已知的正確值。

beforeAll(() => {
  clearPackCache();
  setPackTransport(async (path) => {
    const file = resolve(process.cwd(), 'public/data', path);
    return new Uint8Array(await readFile(file));
  });
});

describe('物品資料庫', () => {
  it('取得單一物品的繁中名稱與圖示', async () => {
    const item = await getItem(5057);
    expect(item).not.toBeNull();
    expect(item!.name).toBe('黑鐵錠');
    expect(item!.nameEn).toBe('Iron Ingot');
    expect(item!.iconId).toBeGreaterThan(0);
    expect(item!.iconUrl).toMatch(/^https:\/\/v2\.xivapi\.com\/api\/asset\?path=/);
  });

  it('批次取得物品', async () => {
    const items = await getItems([5056, 5057, 44232]);
    expect(items.size).toBe(3);
    expect(items.get(5056)!.name).toBe('青銅錠');
    expect(items.get(44232)!.name).toBe('收藏用烤牛肉塔可餅');
  });

  it('查不到的物品回傳 null', async () => {
    expect(await getItem(99999999)).toBeNull();
  });

  it('iconUrlFromId 依 XIVAPI 的資料夾規則組路徑', () => {
    const url = iconUrlFromId(20803);
    expect(decodeURIComponent(url)).toContain('ui/icon/020000/020803_hr1.tex');

    const low = iconUrlFromId(20803, false);
    expect(decodeURIComponent(low)).toContain('ui/icon/020000/020803.tex');
  });

  it('iconId 為 0 時回傳空字串', () => {
    expect(iconUrlFromId(0)).toBe('');
  });

  it('中文搜尋：完全相符優先', async () => {
    const hits = await searchItems('黑鐵錠', { limit: 10 });
    expect(hits[0].id).toBe(5057);
  });

  it('英文搜尋（不分大小寫）', async () => {
    const hits = await searchItems('iron ingot', { limit: 10 });
    expect(hits.some((h) => h.id === 5057)).toBe(true);
  });

  it('可過濾出只能在市場交易的物品', async () => {
    const hits = await searchItems('錠', { limit: 30, marketableOnly: true });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.isMarketable)).toBe(true);
  });

  it('資料檔帶有版本資訊', async () => {
    const version = await getGameDataVersion();
    expect(version.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(version.version).not.toBe('unknown');
  });
});

describe('配方資料庫', () => {
  it('依物品 ID 取得配方，數值與 yyyy.games 一致', async () => {
    // recipe 35000 / 豪勇長矛：canary 測試已確認兩邊 factor 相同
    const recipe = await getRecipeByItemId(37320);
    expect(recipe).not.toBeNull();
    expect(recipe!.id).toBe(35000);
    expect(recipe!.craftType).toBe('CRP');       // job = 木工
    expect(recipe!.recipeLevelId).toBe(320);
    expect(recipe!.recipeLevel).toBe(70);        // rlv 320 的 class_job_level
    // rlv 320: difficulty 1200 / quality 4800 / durability 70，factor 全為 100
    expect(recipe!.difficulty).toBe(1200);
    expect(recipe!.quality).toBe(4800);
    expect(recipe!.durability).toBe(70);
    expect(recipe!.progressDivider).toBe(90);
    expect(recipe!.qualityDivider).toBe(70);
    expect(recipe!.progressModifier).toBe(80);
    expect(recipe!.qualityModifier).toBe(70);
    expect(recipe!.conditionsFlag).toBe(15);
    expect(recipe!.materialQualityFactor).toBe(50);
    expect(recipe!.canHQ).toBe(true);
  });

  it('yyyy.games 缺少的 Stars 欄位有被補上', async () => {
    const recipe = await getRecipeByItemId(37320);
    expect(recipe!.stars).toBe(2); // rlv 320 是 2 星
  });

  it('材料已過濾水晶且數量正確', async () => {
    const recipe = await getRecipeByItemId(37320);
    // 原始材料含水晶 id 9/10，過濾後應只剩 id >= 20 的
    expect(recipe!.ingredients.every((i) => i.itemId >= 20)).toBe(true);
    const ids = recipe!.ingredients.map((i) => i.itemId).sort((a, b) => a - b);
    expect(ids).toEqual([16733, 19123, 19929, 19947, 19949]);

    const byId = new Map(recipe!.ingredients.map((i) => [i.itemId, i.amount]));
    expect(byId.get(19929)).toBe(3);
    expect(byId.get(19949)).toBe(2);
    expect(byId.get(16733)).toBe(5);
  });

  it('青銅錠的配方（difficulty_factor 50 / quality_factor 80 / durability_factor 67）', async () => {
    const recipe = await getRecipeByItemId(5056);
    expect(recipe).not.toBeNull();
    // rlv 1: difficulty 19 / quality 100 / durability 60
    expect(recipe!.difficulty).toBe(Math.floor((19 * 50) / 100));
    expect(recipe!.quality).toBe(Math.floor((100 * 80) / 100));
    expect(recipe!.durability).toBe(Math.floor((60 * 67) / 100));
  });

  it('依配方 ID 取得配方', async () => {
    const recipe = await getRecipeById(35000);
    expect(recipe!.itemId).toBe(37320);
  });

  it('不可製作的物品回傳 null', async () => {
    // 火之碎晶沒有配方
    expect(await getRecipeByItemId(2)).toBeNull();
  });

  it('一個物品可能有多個配方', async () => {
    const recipes = await getRecipesByItemId(5056);
    expect(recipes.length).toBeGreaterThanOrEqual(1);
    expect(recipes.every((r) => r.itemId === 5056)).toBe(true);
  });

  it('可依職業與等級篩選配方列表', async () => {
    const recipes = await listRecipes({ job: 'CUL', levelMin: 90, levelMax: 100, limit: 50 });
    expect(recipes.length).toBeGreaterThan(0);
    expect(recipes.every((r) => r.craftType === 'CUL')).toBe(true);
    expect(recipes.every((r) => r.recipeLevel >= 90 && r.recipeLevel <= 100)).toBe(true);
  });

  it('資料規模符合預期', async () => {
    const stats = await getRecipeDataStats();
    expect(stats.recipeCount).toBeGreaterThan(10000);
    expect(stats.craftableItemCount).toBeGreaterThan(9000);
  });

  it('全部配方的等級參數都有值（不可有 0 divider，會造成除以零）', async () => {
    const recipes = await listRecipes({ limit: 2000 });
    for (const recipe of recipes) {
      expect(recipe.progressDivider).toBeGreaterThan(0);
      expect(recipe.qualityDivider).toBeGreaterThan(0);
      expect(recipe.durability).toBeGreaterThan(0);
      expect(recipe.difficulty).toBeGreaterThan(0);
    }
  });
});
