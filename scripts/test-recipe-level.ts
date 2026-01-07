/**
 * 測試 RecipeLevelTable 與配方參數的正確性
 * 
 * 用戶提供的測試案例：
 * - 配方等級: 85
 * - 難度: 2900
 * - 品質: 6600
 * - 耐久: 80
 * - 製作者等級: 85
 * - 作業精度: 2459
 * - 加工精度: 2304
 * - CP: 464
 * 
 * 期望結果（ffxiv-best-craft）：
 * 開場使用 堅信 (Muscle Memory)
 */

async function main() {
  // 取得 Lv85 配方等級表
  console.log('=== 測試 RecipeLevelTable 取得 ===\n');
  
  const response = await fetch(
    'https://tnze.yyyy.games/api/datasource/zh-TW/recipe_level_table_by_job_level?job_level=85'
  );
  
  const recipeLevelTable = await response.json();
  console.log('Lv85 RecipeLevelTable:', recipeLevelTable);
  
  // 用戶輸入的配方值
  const userRecipe = {
    difficulty: 2900,
    quality: 6600,
    durability: 80,
  };
  
  console.log('\n=== 用戶輸入配方 ===');
  console.log('難度:', userRecipe.difficulty);
  console.log('品質:', userRecipe.quality);
  console.log('耐久:', userRecipe.durability);
  
  // 計算 factor（用戶實際值 / RecipeLevelTable 基礎值 * 100）
  console.log('\n=== 計算 Factor（百分比）===');
  const difficultyFactor = (userRecipe.difficulty / recipeLevelTable.difficulty) * 100;
  const qualityFactor = (userRecipe.quality / recipeLevelTable.quality) * 100;
  const durabilityFactor = (userRecipe.durability / recipeLevelTable.durability) * 100;
  
  console.log(`難度 Factor: ${difficultyFactor.toFixed(2)}% (${userRecipe.difficulty} / ${recipeLevelTable.difficulty})`);
  console.log(`品質 Factor: ${qualityFactor.toFixed(2)}% (${userRecipe.quality} / ${recipeLevelTable.quality})`);
  console.log(`耐久 Factor: ${durabilityFactor.toFixed(2)}% (${userRecipe.durability} / ${recipeLevelTable.durability})`);
  
  // 驗證反向計算
  console.log('\n=== 驗證反向計算（使用 Factor 反推實際值）===');
  const calculatedDifficulty = Math.floor((recipeLevelTable.difficulty * difficultyFactor) / 100);
  const calculatedQuality = Math.floor((recipeLevelTable.quality * qualityFactor) / 100);
  const calculatedDurability = Math.floor((recipeLevelTable.durability * durabilityFactor) / 100);
  
  console.log(`計算難度: ${calculatedDifficulty} (原值: ${userRecipe.difficulty})`);
  console.log(`計算品質: ${calculatedQuality} (原值: ${userRecipe.quality})`);
  console.log(`計算耐久: ${calculatedDurability} (原值: ${userRecipe.durability})`);
  
  // WASM 需要的格式
  console.log('\n=== WASM 求解器需要的配方格式 ===');
  const wasmRecipe = {
    rlv: {
      id: recipeLevelTable.id,
      class_job_level: recipeLevelTable.class_job_level,
      stars: 0,
      suggested_craftsmanship: recipeLevelTable.suggested_craftsmanship,
      suggested_control: null,
      // 這些是 RecipeLevelTable 的基礎值
      difficulty: recipeLevelTable.difficulty,
      quality: recipeLevelTable.quality,
      durability: recipeLevelTable.durability,
      // 這些是計算進度/品質的關鍵參數
      progress_divider: recipeLevelTable.progress_divider,
      quality_divider: recipeLevelTable.quality_divider,
      progress_modifier: recipeLevelTable.progress_modifier,
      quality_modifier: recipeLevelTable.quality_modifier,
      conditions_flag: recipeLevelTable.conditions_flag,
    },
    job_level: recipeLevelTable.class_job_level,
    // 這些是經過 factor 計算後的實際配方值
    difficulty: userRecipe.difficulty,
    quality: userRecipe.quality,
    durability: userRecipe.durability,
    conditions_flag: recipeLevelTable.conditions_flag,
  };
  
  console.log('wasmRecipe.rlv.difficulty (基礎值):', wasmRecipe.rlv.difficulty);
  console.log('wasmRecipe.rlv.quality (基礎值):', wasmRecipe.rlv.quality);
  console.log('wasmRecipe.rlv.durability (基礎值):', wasmRecipe.rlv.durability);
  console.log('wasmRecipe.difficulty (實際值):', wasmRecipe.difficulty);
  console.log('wasmRecipe.quality (實際值):', wasmRecipe.quality);
  console.log('wasmRecipe.durability (實際值):', wasmRecipe.durability);
  console.log('wasmRecipe.rlv.progress_divider:', wasmRecipe.rlv.progress_divider);
  console.log('wasmRecipe.rlv.quality_divider:', wasmRecipe.rlv.quality_divider);
  
  console.log('\n=== 完成 ===');
}

main().catch(console.error);
