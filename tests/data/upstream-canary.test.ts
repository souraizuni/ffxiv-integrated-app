import { describe, it, expect } from 'vitest';

// ============================================
// 上游資料源健康檢查（canary）
// ============================================
// 存在的理由：2026-07 時 Cafemaker（cafemaker.wakingsands.com）無預警停止服務，
// 回傳 HTTP 530，整個「取得清單」功能連帶掛掉，而我們是由使用者回報才發現的。
// 這一組測試就是要讓「上游死掉」變成 CI 會叫的事，而不是使用者才知道的事。
//
// 離線或不想打外部 API 時：SKIP_NETWORK_TESTS=1 npm test

const skipNetwork = process.env.SKIP_NETWORK_TESTS === '1';

async function probe(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
}

describe.skipIf(skipNetwork)('上游資料源可用性', () => {
  it('XIVAPI v2 — 物品批次查詢（圖示、英文名稱來源）', async () => {
    const res = await probe(
      'https://v2.xivapi.com/api/sheet/Item?rows=5056,5057&fields=Name,Icon'
    );
    expect(res.ok).toBe(true);

    const json = await res.json();
    expect(json.rows).toHaveLength(2);
    expect(json.rows[0].fields.Name).toBe('Bronze Ingot');
    expect(json.rows[0].fields.Icon.path).toMatch(/^ui\/icon\//);
  });

  it('XIVAPI v2 — 以 ItemResult 反查配方（材料樹的關鍵路徑）', async () => {
    const query = encodeURIComponent('ItemResult=5056');
    const res = await probe(
      `https://v2.xivapi.com/api/search?query=${query}&sheets=Recipe&fields=${encodeURIComponent('ItemResult@as(raw)')}&limit=10`
    );
    expect(res.ok).toBe(true);

    const json = await res.json();
    expect(json.results.length).toBeGreaterThan(0);
    expect(json.results[0].fields['ItemResult@as(raw)']).toBe(5056);
  });

  it('XIVAPI v2 — 圖示 asset 端點真的回傳圖片', async () => {
    const res = await probe(
      'https://v2.xivapi.com/api/asset?path=ui%2Ficon%2F020000%2F020801_hr1.tex&format=png'
    );
    expect(res.ok).toBe(true);
    expect(res.headers.get('content-type')).toContain('image');
  });

  it('yyyy.games — 配方數值（繁中，模擬器數值來源）', async () => {
    const res = await probe(
      'https://tnze.yyyy.games/api/datasource/zh-TW/recipe_info?recipe_id=35000'
    );
    expect(res.ok).toBe(true);

    const info = await res.json();
    expect(info.item_id).toBe(37320);
    expect(info.rlv).toBe(320);
    // 這些 factor 直接決定模擬器算出的難度/品質/耐久
    expect(info.difficulty_factor).toBe(100);
    expect(info.quality_factor).toBe(100);
    expect(info.durability_factor).toBe(100);
  });

  it('yyyy.games — 配方等級表', async () => {
    const res = await probe(
      'https://tnze.yyyy.games/api/datasource/zh-TW/recipe_level_table?rlv=320'
    );
    expect(res.ok).toBe(true);

    const table = await res.json();
    expect(table.class_job_level).toBe(70);
    expect(table.progress_divider).toBe(90);
    expect(table.quality_divider).toBe(70);
  });

  it('Universalis — 資料中心清單含繁中服', async () => {
    const res = await probe('https://universalis.app/api/v2/data-centers');
    expect(res.ok).toBe(true);

    const dcs = await res.json();
    const twDcs = dcs.filter((dc: { region?: string }) => dc.region === '繁中服');
    expect(twDcs.length).toBeGreaterThan(0);
    expect(twDcs[0].name).toBe('陸行鳥');
  });

  it('Universalis — 繁中服有實際市場資料', async () => {
    const res = await probe(
      `https://universalis.app/api/v2/aggregated/${encodeURIComponent('陸行鳥')}/5057`
    );
    expect(res.ok).toBe(true);

    const data = await res.json();
    expect(data.results?.length).toBeGreaterThan(0);
    expect(data.results[0].itemId).toBe(5057);
  });
});

describe.skipIf(skipNetwork)('XIVAPI v2 與 yyyy.games 的一致性', () => {
  // 建置腳本用 XIVAPI v2 產生本地配方庫，但模擬器的數值語意來自 yyyy.games。
  // 兩邊若開始分歧，本地配方庫就會讓模擬結果偏掉。
  it('同一個 recipe id 在兩邊指向同一個成品與同樣的 factors', async () => {
    const recipeId = 35000;

    const [v2Res, yyyyRes] = await Promise.all([
      probe(
        `https://v2.xivapi.com/api/sheet/Recipe/${recipeId}?fields=${encodeURIComponent(
          'ItemResult@as(raw),RecipeLevelTable@as(raw),DifficultyFactor,QualityFactor,DurabilityFactor,MaterialQualityFactor,CanHq'
        )}`
      ),
      probe(`https://tnze.yyyy.games/api/datasource/zh-TW/recipe_info?recipe_id=${recipeId}`),
    ]);

    expect(v2Res.ok).toBe(true);
    expect(yyyyRes.ok).toBe(true);

    const v2 = (await v2Res.json()).fields;
    const yyyy = await yyyyRes.json();

    expect(v2['ItemResult@as(raw)']).toBe(yyyy.item_id);
    expect(v2['RecipeLevelTable@as(raw)']).toBe(yyyy.rlv);
    expect(v2.DifficultyFactor).toBe(yyyy.difficulty_factor);
    expect(v2.QualityFactor).toBe(yyyy.quality_factor);
    expect(v2.DurabilityFactor).toBe(yyyy.durability_factor);
    expect(v2.MaterialQualityFactor).toBe(yyyy.material_quality_factor);
    expect(v2.CanHq).toBe(yyyy.can_hq);
  });

  it('CraftType 的 row 順序與專案的職業代碼對應一致', async () => {
    const res = await probe('https://v2.xivapi.com/api/sheet/CraftType?limit=8&fields=Name');
    expect(res.ok).toBe(true);

    const rows = (await res.json()).rows;
    // lib/recipe-datasource.ts 依賴這個順序把 CraftType id 轉成 CRP/BSM/...
    expect(rows.map((r: { fields: { Name: string } }) => r.fields.Name)).toEqual([
      'Woodworking',
      'Smithing',
      'Armorcraft',
      'Goldsmithing',
      'Leatherworking',
      'Clothcraft',
      'Alchemy',
      'Cooking',
    ]);
  });
});
