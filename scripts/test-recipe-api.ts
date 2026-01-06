/**
 * 測試實際 API 回傳的配方是否包含正確的基礎值
 */

import { fetchRecipe } from '../hooks/use-xivapi';

async function testRecipeData() {
  console.log('=== 測試 API 回傳的配方資料 ===\n');
  
  // 牧羊工具的 Item ID
  const sheepToolItemId = 38815;
  
  console.log(`正在取得牧羊工具 (Item ID: ${sheepToolItemId}) 的配方資料...`);
  const recipe = await fetchRecipe(sheepToolItemId);
  
  if (!recipe) {
    console.error('無法取得配方資料！');
    return;
  }
  
  console.log('\n=== 配方基本資訊 ===');
  console.log(`配方 ID: ${recipe.id}`);
  console.log(`物品 ID: ${recipe.itemId}`);
  console.log(`配方等級: ${recipe.recipeLevel}`);
  console.log(`星級: ${recipe.stars}`);
  
  console.log('\n=== 實際配方值（經過因子計算）===');
  console.log(`難度 (difficulty): ${recipe.difficulty}`);
  console.log(`品質 (quality): ${recipe.quality}`);
  console.log(`耐久 (durability): ${recipe.durability}`);
  
  console.log('\n=== 基礎值（RecipeLevelTable 的原始值）===');
  console.log(`基礎難度 (baseDifficulty): ${recipe.baseDifficulty}`);
  console.log(`基礎品質 (baseQuality): ${recipe.baseQuality}`);
  console.log(`基礎耐久 (baseDurability): ${recipe.baseDurability}`);
  
  console.log('\n=== RecipeLevelTable 參數 ===');
  console.log(`progressDivider: ${recipe.progressDivider}`);
  console.log(`progressModifier: ${recipe.progressModifier}`);
  console.log(`qualityDivider: ${recipe.qualityDivider}`);
  console.log(`qualityModifier: ${recipe.qualityModifier}`);
  console.log(`conditionsFlag: ${recipe.conditionsFlag}`);
  
  console.log('\n=== 驗證 ===');
  const expectedQuality = 4160;  // 5200 * 80% = 4160
  const expectedDurability = 60; // 80 * 75% = 60
  
  const qualityMatch = recipe.quality === expectedQuality;
  const durabilityMatch = recipe.durability === expectedDurability;
  const baseQualityMatch = recipe.baseQuality === 5200;
  const baseDurabilityMatch = recipe.baseDurability === 80;
  
  console.log(`實際品質 ${recipe.quality} === ${expectedQuality}: ${qualityMatch ? '✓' : '✗'}`);
  console.log(`實際耐久 ${recipe.durability} === ${expectedDurability}: ${durabilityMatch ? '✓' : '✗'}`);
  console.log(`基礎品質 ${recipe.baseQuality} === 5200: ${baseQualityMatch ? '✓' : '✗'}`);
  console.log(`基礎耐久 ${recipe.baseDurability} === 80: ${baseDurabilityMatch ? '✓' : '✗'}`);
  
  if (!qualityMatch || !durabilityMatch || !baseQualityMatch || !baseDurabilityMatch) {
    console.log('\n⚠️ 資料不符合預期！');
  } else {
    console.log('\n✓ 所有資料正確！');
  }
  
  // 顯示完整的配方物件
  console.log('\n=== 完整配方物件 ===');
  console.log(JSON.stringify(recipe, null, 2));
}

testRecipeData().catch(console.error);
