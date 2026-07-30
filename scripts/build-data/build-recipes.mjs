// ============================================
// 產生本地配方資料庫 public/data/recipes.msgpack
// ============================================
// 為什麼要這個檔：先前每建一次材料樹都要對 yyyy.games 發數十次請求，
// 每次 0.5–1.4 秒且必須逐層等待，實測一棵三層樹要 10–12 秒。
// 改成本地查表後，材料樹遞歸完全不碰網路。
//
// 資料正確性：XIVAPI v2 的 Recipe / RecipeLevelTable 已與 yyyy.games 逐欄位交叉驗證
// （見 tests/data/upstream-canary.test.ts），數值一致，因此模擬器結果不會改變。
// 額外好處是 v2 提供 yyyy.games 缺少的 Stars 欄位。

import { crawlSheet, getGameVersion, writePack, logStep, isEntrypoint } from './_lib.mjs';

const RECIPE_FIELDS = [
  'ItemResult@as(raw)',
  'AmountResult',
  'CraftType@as(raw)',
  'RecipeLevelTable@as(raw)',
  'DifficultyFactor',
  'QualityFactor',
  'DurabilityFactor',
  'MaterialQualityFactor',
  'RequiredCraftsmanship',
  'RequiredControl',
  'RequiredQuality',
  'CanHq',
  'CanQuickSynth',
  'IsExpert',
  'IsSpecializationRequired',
  'SecretRecipeBook@as(raw)',
  'Ingredient@as(raw)',
  'AmountIngredient',
].join(',');

const LEVEL_FIELDS = [
  'ClassJobLevel',
  'Stars',
  'SuggestedCraftsmanship',
  'Difficulty',
  'Quality',
  'Durability',
  'ProgressDivider',
  'QualityDivider',
  'ProgressModifier',
  'QualityModifier',
  'ConditionsFlag',
].join(',');

// 位元旗標，省下四個布林欄位的 key 開銷
export const RECIPE_FLAG_CAN_HQ = 1;
export const RECIPE_FLAG_QUICK_SYNTH = 2;
export const RECIPE_FLAG_EXPERT = 4;
export const RECIPE_FLAG_SPECIALIST = 8;

function buildRecipeRecord(row) {
  const f = row.fields;

  const itemId = f['ItemResult@as(raw)'] ?? 0;
  // ItemResult = 0 代表這一列是空的（Excel 表尾端的填充列）
  if (!itemId) return null;

  const ingredientIds = f['Ingredient@as(raw)'] || [];
  const ingredientAmounts = f.AmountIngredient || [];

  const ingredients = [];
  for (let i = 0; i < ingredientIds.length; i++) {
    const id = ingredientIds[i];
    const amount = ingredientAmounts[i] ?? 0;
    // 0 是佔位；水晶（id < 20）保留，由消費端決定要不要顯示
    if (id > 0 && amount > 0) {
      ingredients.push([id, amount]);
    }
  }

  let flags = 0;
  if (f.CanHq) flags |= RECIPE_FLAG_CAN_HQ;
  if (f.CanQuickSynth) flags |= RECIPE_FLAG_QUICK_SYNTH;
  if (f.IsExpert) flags |= RECIPE_FLAG_EXPERT;
  if (f.IsSpecializationRequired) flags |= RECIPE_FLAG_SPECIALIST;

  return {
    i: row.row_id,                                  // recipe id
    t: itemId,                                      // 成品 item id
    a: f.AmountResult ?? 1,                         // 產出數量
    j: f['CraftType@as(raw)'] ?? 0,                 // CraftType row id（0=木工…7=烹調）
    r: f['RecipeLevelTable@as(raw)'] ?? 0,          // rlv
    df: f.DifficultyFactor ?? 100,
    qf: f.QualityFactor ?? 100,
    uf: f.DurabilityFactor ?? 100,
    mf: f.MaterialQualityFactor ?? 0,
    rc: f.RequiredCraftsmanship ?? 0,
    ro: f.RequiredControl ?? 0,
    rq: f.RequiredQuality ?? 0,
    b: f['SecretRecipeBook@as(raw)'] ?? 0,          // 祕籍
    f: flags,
    g: ingredients,
  };
}

function buildLevelRecord(row) {
  const f = row.fields;
  return {
    i: row.row_id,
    l: f.ClassJobLevel ?? 1,
    s: f.Stars ?? 0,
    sc: f.SuggestedCraftsmanship ?? 0,
    d: f.Difficulty ?? 0,
    q: f.Quality ?? 0,
    u: f.Durability ?? 0,
    pd: f.ProgressDivider ?? 100,
    qd: f.QualityDivider ?? 100,
    pm: f.ProgressModifier ?? 100,
    qm: f.QualityModifier ?? 100,
    c: f.ConditionsFlag ?? 15,
  };
}

export async function buildRecipes() {
  logStep('▶ 建置配方資料庫');

  const version = await getGameVersion();

  process.stdout.write('  抓取 RecipeLevelTable…\n');
  const levelRows = await crawlSheet('RecipeLevelTable', LEVEL_FIELDS, {
    onPage: (total) => process.stdout.write(`\r    ${total} 列`),
  });
  process.stdout.write('\n');

  process.stdout.write('  抓取 Recipe…\n');
  const recipeRows = await crawlSheet('Recipe', RECIPE_FIELDS, {
    onPage: (total) => process.stdout.write(`\r    ${total} 列`),
  });
  process.stdout.write('\n');

  const recipes = recipeRows.map(buildRecipeRecord).filter(Boolean);
  const levels = levelRows.map(buildLevelRecord).filter((l) => l.d > 0);

  // 反查索引：成品 item id → 配方在 recipes 陣列中的索引
  // 一個物品可能有多個配方（不同職業），全部保留讓消費端自行挑選。
  const byItem = {};
  recipes.forEach((recipe, index) => {
    (byItem[recipe.t] ||= []).push(index);
  });

  const payload = {
    v: 1,
    generatedAt: new Date().toISOString(),
    game: version,
    recipes,
    levels,
    byItem,
  };

  process.stdout.write(
    `  配方 ${recipes.length} 筆、等級表 ${levels.length} 筆、可製作物品 ${Object.keys(byItem).length} 種\n`
  );

  await writePack('recipes.msgpack', payload);
  return payload;
}

if (isEntrypoint(import.meta.url)) {
  buildRecipes().catch((error) => {
    console.error('建置配方資料庫失敗:', error);
    process.exit(1);
  });
}
