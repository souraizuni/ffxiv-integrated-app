/**
 * 調試 WASM Recipe 轉換 - 驗證資料結構是否正確
 */

// 模擬從 API 取得的配方資料
const apiRecipe = {
  // 基礎值 (RecipeLevelTable)
  baseDifficulty: 2000,
  baseQuality: 5200,
  baseDurability: 80,
  
  // 因子
  difficultyFactor: 100,
  qualityFactor: 80,
  durabilityFactor: 75,
  
  // 計算實際值
  get difficulty() { return Math.floor((this.baseDifficulty * this.difficultyFactor) / 100); },
  get quality() { return Math.floor((this.baseQuality * this.qualityFactor) / 100); },
  get durability() { return Math.floor((this.baseDurability * this.durabilityFactor) / 100); },
  
  // RecipeLevelTable 參數
  recipeLevel: 81,
  progressDivider: 121,
  progressModifier: 100,
  qualityDivider: 105,
  qualityModifier: 100,
  conditionsFlag: 15,
  stars: 0,
  requiredCraftsmanship: 2234,
};

console.log('=== API 配方資料 ===');
console.log(`基礎難度: ${apiRecipe.baseDifficulty}`);
console.log(`基礎品質: ${apiRecipe.baseQuality}`);
console.log(`基礎耐久: ${apiRecipe.baseDurability}`);
console.log(`實際難度: ${apiRecipe.difficulty}`);
console.log(`實際品質: ${apiRecipe.quality}`);
console.log(`實際耐久: ${apiRecipe.durability}`);
console.log();

// 模擬 convertRecipeToWasm 的邏輯
function convertRecipeToWasm(recipe: typeof apiRecipe) {
  const rlv = {
    class_job_level: recipe.recipeLevel,
    stars: recipe.stars,
    suggested_craftsmanship: recipe.requiredCraftsmanship,
    suggested_control: null,
    // rlv 應該使用 **基礎值**
    difficulty: recipe.baseDifficulty,
    quality: recipe.baseQuality,
    durability: recipe.baseDurability,
    progress_divider: recipe.progressDivider,
    quality_divider: recipe.qualityDivider,
    progress_modifier: recipe.progressModifier,
    quality_modifier: recipe.qualityModifier,
    conditions_flag: recipe.conditionsFlag,
  };

  return {
    rlv,
    job_level: recipe.recipeLevel,
    // Recipe 層級應該使用 **實際值**
    difficulty: recipe.difficulty,
    quality: recipe.quality,
    durability: recipe.durability,
    conditions_flag: recipe.conditionsFlag,
  };
}

const wasmRecipe = convertRecipeToWasm(apiRecipe);

console.log('=== WASM Recipe 結構 ===');
console.log(JSON.stringify(wasmRecipe, null, 2));
console.log();

console.log('=== 驗證 ===');
console.log(`rlv.difficulty (基礎值): ${wasmRecipe.rlv.difficulty} (預期: 2000)`);
console.log(`rlv.quality (基礎值): ${wasmRecipe.rlv.quality} (預期: 5200)`);
console.log(`rlv.durability (基礎值): ${wasmRecipe.rlv.durability} (預期: 80)`);
console.log(`Recipe.difficulty (實際值): ${wasmRecipe.difficulty} (預期: 2000)`);
console.log(`Recipe.quality (實際值): ${wasmRecipe.quality} (預期: 4160)`);
console.log(`Recipe.durability (實際值): ${wasmRecipe.durability} (預期: 60)`);
console.log();

// 關鍵：品質計算的驗證
// 進度增量計算公式（簡化版）: base_progress * craftsmanship_factor / progress_divider * progress_modifier / 100
// 品質增量計算公式（簡化版）: base_quality * control_factor / quality_divider * quality_modifier / 100

// 假設 Basic Touch 的基礎效率是 100
const controlStat = 4500;
const baseQualityEfficiency = 100;

// 使用正確的 rlv.quality 計算品質增量
// 這是簡化的公式，實際公式更複雜
const qualityIncreaseWithCorrectBase = Math.floor(
  (controlStat * 10 / wasmRecipe.rlv.quality) * (baseQualityEfficiency / 100) * 
  (wasmRecipe.rlv.quality_modifier / 100)
);

console.log('=== 品質計算示例 ===');
console.log(`使用 rlv.quality=${wasmRecipe.rlv.quality} 計算品質增量`);
console.log(`品質除數: ${wasmRecipe.rlv.quality_divider}`);
console.log(`品質修正: ${wasmRecipe.rlv.quality_modifier}`);
console.log();

console.log('=== 結論 ===');
console.log('WASM 求解器使用 rlv 結構中的基礎值來計算每個技能的品質/進度增量');
console.log('Recipe 層級的 quality 是目標品質值（需要達到的總品質）');
console.log('如果 rlv.quality 錯誤（使用了 4160 而非 5200），品質計算會偏高');
console.log('但如果 Recipe.quality 是 4160，達成 100% 品質需要累積 4160 點品質');
