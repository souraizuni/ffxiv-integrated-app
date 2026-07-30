import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setPackTransport, clearPackCache } from '@/lib/data/msgpack-loader';
import { buildMaterialTree, flattenMaterialTree, clearCache } from '@/lib/recipe-tree';

// ============================================
// 材料樹（先前故障、且是效能瓶頸的功能）
// ============================================
// 兩件事要一起守住：
//   1. 正確性 —— Cafemaker 停用時這裡整塊消失過
//   2. 效能   —— 改用本地資料庫前，一棵三層樹要 10–12 秒

let networkCalls = 0;

beforeAll(() => {
  clearPackCache();
  clearCache();

  setPackTransport(async (path) => {
    const file = resolve(process.cwd(), 'public/data', path);
    return new Uint8Array(await readFile(file));
  });

  // 監看是否有任何外部請求漏出去
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
    networkCalls++;
    return originalFetch(...args);
  }) as typeof fetch;
});

describe('材料樹', () => {
  it('建構收藏用烤牛肉塔可餅的材料樹', async () => {
    const tree = await buildMaterialTree(44232, 1, 0, 5);

    expect(tree.itemId).toBe(44232);
    expect(tree.item.name).toBe('收藏用烤牛肉塔可餅');
    expect(tree.isBaseMaterial).toBe(false);
    expect(tree.children.length).toBe(4);
  });

  it('攤平後的材料清單名稱與數量正確', async () => {
    const tree = await buildMaterialTree(44232, 1, 0, 5);
    const flat = flattenMaterialTree(tree, true);

    // 每一項都要有正式名稱與圖示，不能出現「物品 #id」的降級結果
    expect(flat.every((m) => !m.item.name.startsWith('物品 #'))).toBe(true);
    expect(flat.every((m) => m.item.iconUrl.startsWith('http'))).toBe(true);

    const byName = new Map(flat.map((m) => [m.item.name, m.totalAmount]));
    expect(byName.get('裸麥粉')).toBe(2);
    expect(byName.get('裸麥')).toBe(6);       // 裸麥粉 ×2，每份需 3 裸麥
    expect(byName.get('犎牛肩肉')).toBe(2);
    expect(byName.get('白胡椒')).toBe(1);
  });

  it('中間製品會繼續往下拆，基礎材料則停止', async () => {
    const tree = await buildMaterialTree(44232, 1, 0, 5);
    const flour = tree.children.find((c) => c.item.name === '裸麥粉');

    expect(flour).toBeDefined();
    expect(flour!.isBaseMaterial).toBe(false);
    expect(flour!.children.length).toBeGreaterThan(0);

    const pepper = tree.children.find((c) => c.item.name === '白胡椒');
    expect(pepper!.isBaseMaterial).toBe(true);
    expect(pepper!.children).toHaveLength(0);
  });

  it('數量計算會考慮配方的批次產出，不是單純線性放大', async () => {
    // 裸麥粉：一次製作產出 3 個，消耗裸麥 6
    // ×1 塔可餅 → 需裸麥粉 2 → ceil(2/3)=1 批 → 裸麥 6
    // ×3 塔可餅 → 需裸麥粉 6 → ceil(6/3)=2 批 → 裸麥 12（不是 18）
    const single = flattenMaterialTree(await buildMaterialTree(44232, 1, 0, 5), true);
    clearCache();
    const triple = flattenMaterialTree(await buildMaterialTree(44232, 3, 0, 5), true);

    const singleRye = single.find((m) => m.item.name === '裸麥')!.totalAmount;
    const tripleRye = triple.find((m) => m.item.name === '裸麥')!.totalAmount;

    expect(singleRye).toBe(6);
    expect(tripleRye).toBe(12);

    // 一般性質：需求增加不會讓材料變少，而批次效應讓它不超過線性放大
    expect(tripleRye).toBeGreaterThanOrEqual(singleRye);
    expect(tripleRye).toBeLessThanOrEqual(singleRye * 3);
  });

  it('全程不發任何網路請求（本地資料庫已完整）', async () => {
    clearCache();
    clearPackCache();
    setPackTransport(async (path) => {
      const file = resolve(process.cwd(), 'public/data', path);
      return new Uint8Array(await readFile(file));
    });

    networkCalls = 0;
    await buildMaterialTree(44232, 1, 0, 5);

    // 先前每個節點都要打 XIVAPI + yyyy.games，基礎材料還會各自多打一次
    expect(networkCalls).toBe(0);
  });

  it('建構速度應為毫秒級（改用本地資料庫前約 10–12 秒）', async () => {
    clearCache();

    const started = performance.now();
    await buildMaterialTree(44232, 1, 0, 5);
    const elapsed = performance.now() - started;

    expect(elapsed).toBeLessThan(1000);
  });

  it('深層配方也能完成（麵包類多層拆解）', async () => {
    clearCache();
    const tree = await buildMaterialTree(36077, 4, 0, 5); // 裸麥粉
    const flat = flattenMaterialTree(tree, true);

    expect(flat.length).toBeGreaterThan(1);
    expect(flat.every((m) => !m.item.name.startsWith('物品 #'))).toBe(true);
  });
});
