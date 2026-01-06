/**
 * 測試 WASM 求解器 - 牧羊工具配方
 * 驗證與 ffxiv-best-craft 網站的一致性
 */

// 配方等級表 517 的詳細參數（來自 xivapi）
const recipeLevelTable517 = {
  ClassJobLevel: 81,
  ConditionsFlag: 15,
  Difficulty: 2000,
  Durability: 80,
  ProgressDivider: 121,
  ProgressModifier: 100,
  Quality: 5200,
  QualityDivider: 105,
  QualityModifier: 100,
  Stars: 0,
  SuggestedCraftsmanship: 2234,
};

// 牧羊工具的配方參數（來自 Garland Tools）
// 注意：Garland Tools 的 quality/durability 是經過 factor 計算後的值
const sheepEquipmentRecipe = {
  id: 35361,
  rlvl: 517,
  durability: 60, // 這是實際配方的耐久（80 * 0.75 或類似的因子）
  quality: 4160,  // 這是實際配方的品質（5200 * 0.8 或類似的因子）
  progress: 2000, // 這是實際配方的進度
  lvl: 81,
  materialQualityFactor: 0,
};

// 計算因子：從基礎值計算實際配方值的比例
const durabilityFactor = Math.round((sheepEquipmentRecipe.durability / recipeLevelTable517.Durability) * 100);
const qualityFactor = Math.round((sheepEquipmentRecipe.quality / recipeLevelTable517.Quality) * 100);

console.log('=== 牧羊工具配方分析 ===');
console.log(`配方等級: ${sheepEquipmentRecipe.rlvl}`);
console.log(`基礎難度: ${recipeLevelTable517.Difficulty}`);
console.log(`基礎品質: ${recipeLevelTable517.Quality}`);
console.log(`基礎耐久: ${recipeLevelTable517.Durability}`);
console.log(`實際難度: ${sheepEquipmentRecipe.progress}`);
console.log(`實際品質: ${sheepEquipmentRecipe.quality}`);
console.log(`實際耐久: ${sheepEquipmentRecipe.durability}`);
console.log(`耐久因子: ${durabilityFactor}%`);
console.log(`品質因子: ${qualityFactor}%`);
console.log();
console.log('進度除數 (ProgressDivider):', recipeLevelTable517.ProgressDivider);
console.log('進度修正 (ProgressModifier):', recipeLevelTable517.ProgressModifier);
console.log('品質除數 (QualityDivider):', recipeLevelTable517.QualityDivider);
console.log('品質修正 (QualityModifier):', recipeLevelTable517.QualityModifier);
console.log();

// 建構完整的 WASM Recipe 結構（模擬 ffxiv-best-craft 的格式）
const wasmRecipe = {
  rlv: {
    id: 517,
    class_job_level: recipeLevelTable517.ClassJobLevel,
    stars: recipeLevelTable517.Stars,
    suggested_craftsmanship: recipeLevelTable517.SuggestedCraftsmanship,
    suggested_control: null,
    difficulty: recipeLevelTable517.Difficulty,
    quality: recipeLevelTable517.Quality,
    progress_divider: recipeLevelTable517.ProgressDivider,
    quality_divider: recipeLevelTable517.QualityDivider,
    progress_modifier: recipeLevelTable517.ProgressModifier,
    quality_modifier: recipeLevelTable517.QualityModifier,
    durability: recipeLevelTable517.Durability,
    conditions_flag: recipeLevelTable517.ConditionsFlag,
  },
  job_level: 81,
  difficulty: sheepEquipmentRecipe.progress,
  quality: sheepEquipmentRecipe.quality,
  durability: sheepEquipmentRecipe.durability,
  conditions_flag: 15,
};

console.log('=== 建構的 WASM Recipe ===');
console.log(JSON.stringify(wasmRecipe, null, 2));
console.log();

// 用戶的屬性（請根據實際調整）
// 假設使用與網站相同的屬性
const crafterAttributes = {
  level: 100,
  craftsmanship: 4500,
  control: 4500,
  craft_points: 700,
};

console.log('=== 生產者屬性 ===');
console.log(`等級: ${crafterAttributes.level}`);
console.log(`作業精度: ${crafterAttributes.craftsmanship}`);
console.log(`加工精度: ${crafterAttributes.control}`);
console.log(`CP: ${crafterAttributes.craft_points}`);
console.log();

// 網站產生的巨集動作序列
const websiteMacro = [
  'reflect',           // 閒靜
  'waste_not_ii',      // 長期儉約
  'innovation',        // 改革
  'delicate_synthesis',// 坯料加工
  'delicate_synthesis',// 坯料加工
  'great_strides',     // 闘步
  'byregots_blessing', // 比爾格的祝福
  'veneration',        // 崇敬
  'groundwork',        // 坯料製作
  'groundwork',        // 坯料製作
  'careful_synthesis', // 精密製作
];

console.log('=== 網站產生的巨集 ===');
websiteMacro.forEach((action, i) => {
  console.log(`${i + 1}. ${action}`);
});
console.log();

console.log('=== 說明 ===');
console.log('此測試腳本用於驗證 WASM 求解器的配方參數設定。');
console.log('關鍵參數是 RecipeLevel 中的 progress_divider, quality_divider, progress_modifier, quality_modifier。');
console.log('這些參數會影響每個技能的進度和品質增量計算。');
console.log();
console.log('如果 WASM 求解器的結果與網站不同，最可能的原因是：');
console.log('1. rlv 結構沒有正確傳遞完整的 RecipeLevel 物件');
console.log('2. 進度/品質計算公式使用了錯誤的 divider/modifier 值');
