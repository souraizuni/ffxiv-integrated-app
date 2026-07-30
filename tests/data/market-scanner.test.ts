import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setPackTransport, clearPackCache } from '@/lib/data/msgpack-loader';
import {
  getItemsByCategories,
  getItem,
  getCategoryNames,
  getRelatedItems,
} from '@/lib/data/items';
import { getCategoryNameTw, hasCategoryNameTw } from '@/lib/i18n/item-categories';

// ============================================
// 市場掃描器的資料來源
// ============================================
// 掃描器原本靠 Cafemaker 分頁爬取分類物品，該服務已停止服務（HTTP 530），
// 導致掃描完全無法執行。這組測試守住改用本地資料庫後的正確性與「零網路請求」。

let networkCalls = 0;

beforeAll(() => {
  clearPackCache();
  setPackTransport(async (path) => {
    const file = resolve(process.cwd(), 'public/data', path);
    return new Uint8Array(await readFile(file));
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
    networkCalls++;
    return originalFetch(...args);
  }) as typeof fetch;
});

describe('依分類取得掃描目標', () => {
  it('取得藥品/食材/食品/水產品，且全部可交易', async () => {
    const items = await getItemsByCategories({
      categoryIds: [44, 45, 46, 47],
      marketableOnly: true,
    });

    expect(items.length).toBeGreaterThan(100);
    expect(items.every((i) => [44, 45, 46, 47].includes(i.categoryId))).toBe(true);
    expect(items.every((i) => i.isMarketable)).toBe(true);
  });

  it('遵守物品等級上限', async () => {
    const items = await getItemsByCategories({
      categoryIds: [49],
      maxItemLevel: 100,
      marketableOnly: true,
    });

    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.itemLevel <= 100)).toBe(true);
  });

  it('等級上限越高，取得的物品不會變少', async () => {
    const low = await getItemsByCategories({ categoryIds: [49], maxItemLevel: 50 });
    const high = await getItemsByCategories({ categoryIds: [49], maxItemLevel: 700 });
    expect(high.length).toBeGreaterThanOrEqual(low.length);
  });

  it('名稱直接是繁中，不需要簡轉繁', async () => {
    const items = await getItemsByCategories({ categoryIds: [49], marketableOnly: true });
    const ingot = items.find((i) => i.id === 5057);

    expect(ingot).toBeDefined();
    expect(ingot!.name).toBe('黑鐵錠');
  });

  it('帶有掃描器需要的 canBeHQ 旗標', async () => {
    const items = await getItemsByCategories({ categoryIds: [49], marketableOnly: true });
    expect(items.some((i) => i.canBeHQ)).toBe(true);
  });

  it('空分類清單回傳空陣列，不發請求', async () => {
    expect(await getItemsByCategories({ categoryIds: [] })).toEqual([]);
  });

  it('指定物品 ID 可直接查到', async () => {
    const item = await getItem(5057);
    expect(item?.name).toBe('黑鐵錠');
    expect(item?.isMarketable).toBe(true);
  });

  it('整個取得流程零網路請求', async () => {
    networkCalls = 0;

    await getItemsByCategories({ categoryIds: [44, 45, 46, 47, 49], marketableOnly: true });
    await getItem(5057);
    await getCategoryNames();

    expect(networkCalls).toBe(0);
  });

  it('掃描規模合理（五個分類約數百至數千筆）', async () => {
    const items = await getItemsByCategories({
      categoryIds: [44, 45, 46, 47, 49],
      maxItemLevel: 999,
      marketableOnly: true,
    });
    expect(items.length).toBeGreaterThan(200);
    expect(items.length).toBeLessThan(20000);
  });
});

describe('分類繁中名稱', () => {
  it('掃描器提供的分類都有繁中名稱', async () => {
    // 對應 app/market/page.tsx 的 CATEGORY_GROUPS
    const offered = [
      44, 45, 46, 47,
      48, 49, 50, 51, 52, 53, 54, 55, 56, 59, 60, 83,
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 84, 87, 88, 89, 96, 97, 98, 105, 106, 107, 108, 109, 110, 111,
      34, 35, 36, 37, 38,
      40, 41, 42, 43,
      12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
      28, 29, 30, 31, 32, 33, 99,
      57, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80,
      58,
      61, 63, 81, 82, 85, 86, 94, 95, 100, 112, 90, 91, 92, 93, 101, 102, 103, 104,
    ];

    const missing = offered.filter((id) => !hasCategoryNameTw(id));
    expect(missing, `缺少繁中名稱的分類: ${missing.join(', ')}`).toEqual([]);
  });

  it('未收錄時退回英文而非空白', () => {
    expect(getCategoryNameTw(99999, 'Some Category')).toBe('Some Category');
    expect(getCategoryNameTw(99999)).toBe('分類 99999');
  });

  it('已收錄的分類回傳繁中', () => {
    expect(getCategoryNameTw(49, 'Metal')).toBe('金屬');
    expect(getCategoryNameTw(44, 'Medicine')).toBe('藥品');
  });
});

describe('相關物品', () => {
  it('回傳同分類、等級相近的可交易物品', async () => {
    const ingot = (await getItem(5057))!; // 黑鐵錠，分類 49 金屬
    const related = await getRelatedItems(5057, 10);

    expect(related.length).toBeGreaterThan(0);
    expect(related.every((r) => r.categoryId === ingot.categoryId)).toBe(true);
    expect(related.every((r) => r.isMarketable)).toBe(true);
  });

  it('不會把自己列進去', async () => {
    const related = await getRelatedItems(5057, 20);
    expect(related.some((r) => r.id === 5057)).toBe(false);
  });

  it('依等級接近程度排序', async () => {
    const ingot = (await getItem(5057))!;
    const related = await getRelatedItems(5057, 10);

    const distances = related.map((r) => Math.abs(r.itemLevel - ingot.itemLevel));
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
    }
  });

  it('遵守數量上限', async () => {
    expect((await getRelatedItems(5057, 5)).length).toBeLessThanOrEqual(5);
  });

  it('不存在的物品回傳空陣列', async () => {
    expect(await getRelatedItems(99999999)).toEqual([]);
  });
});
