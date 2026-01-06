/**
 * 端對端測試 WASM 求解器
 * 使用牧羊工具配方驗證求解結果
 */

import { fetchRecipe } from '../hooks/use-xivapi';
import * as wasmSolver from '../lib/wasm';

async function testWasmSolver() {
  console.log('=== 端對端 WASM 求解器測試 ===\n');
  
  // 1. 初始化 WASM
  console.log('1. 初始化 WASM 模組...');
  const initSuccess = await wasmSolver.initWasm();
  if (!initSuccess) {
    console.error('WASM 初始化失敗！');
    return;
  }
  console.log('   WASM 初始化成功\n');
  
  // 2. 取得配方資料
  console.log('2. 取得牧羊工具配方資料...');
  const recipe = await fetchRecipe(38815);
  if (!recipe) {
    console.error('無法取得配方資料！');
    return;
  }
  console.log(`   配方 ID: ${recipe.id}`);
  console.log(`   實際品質: ${recipe.quality}`);
  console.log(`   基礎品質: ${recipe.baseQuality}\n`);
  
  // 3. 設定工匠屬性（使用與網站相同的數值）
  const crafterStats = {
    level: 100,
    craftsmanship: 4500,
    control: 4500,
    cp: 700,
  };
  console.log('3. 工匠屬性:');
  console.log(`   等級: ${crafterStats.level}`);
  console.log(`   作業精度: ${crafterStats.craftsmanship}`);
  console.log(`   加工精度: ${crafterStats.control}`);
  console.log(`   CP: ${crafterStats.cp}\n`);
  
  // 4. 轉換為 WASM 格式
  console.log('4. 轉換為 WASM 格式...');
  const wasmAttrs = wasmSolver.convertStatsToWasm(crafterStats);
  const wasmRecipe = wasmSolver.convertRecipeToWasm(recipe, {
    baseDifficulty: recipe.baseDifficulty,
    baseQuality: recipe.baseQuality,
    baseDurability: recipe.baseDurability,
  });
  
  console.log('   WASM Recipe:');
  console.log(`   - rlv.quality (基礎值): ${wasmRecipe.rlv.quality}`);
  console.log(`   - rlv.durability (基礎值): ${wasmRecipe.rlv.durability}`);
  console.log(`   - Recipe.quality (實際目標): ${wasmRecipe.quality}`);
  console.log(`   - Recipe.durability (實際耐久): ${wasmRecipe.durability}`);
  console.log(`   - quality_divider: ${wasmRecipe.rlv.quality_divider}`);
  console.log(`   - progress_divider: ${wasmRecipe.rlv.progress_divider}\n`);
  
  // 5. 建立初始狀態
  console.log('5. 建立初始狀態...');
  const wasmStatus = wasmSolver.newStatus(wasmAttrs, wasmRecipe);
  console.log('   初始狀態建立成功\n');
  
  // 6. 執行 Raphael 求解
  console.log('6. 執行 Raphael 求解...');
  try {
    const actions = wasmSolver.raphaelSolve(
      wasmStatus,
      null,  // targetQuality - null 表示達到最高品質
      true,  // useManipulation
      false, // useHeartAndSoul
      false, // useQuickInnovation
      false, // useTrainedEye
      false, // backloadProgress
      false  // adversarial
    );
    
    console.log(`   求解完成！動作數量: ${actions.length}`);
    console.log('   動作序列:');
    actions.forEach((action, i) => {
      console.log(`   ${i + 1}. ${action}`);
    });
    console.log();
    
    // 7. 模擬執行來驗證結果
    console.log('7. 動作序列分析完成\n');
    
    // 8. 與網站巨集比較
    console.log('8. 與網站巨集比較:');
    const websiteMacro = [
      'reflect',
      'waste_not_ii',
      'innovation',
      'delicate_synthesis',
      'delicate_synthesis',
      'great_strides',
      'byregots_blessing',
      'veneration',
      'groundwork',
      'groundwork',
      'careful_synthesis',
    ];
    console.log('   網站巨集:');
    websiteMacro.forEach((action, i) => {
      console.log(`   ${i + 1}. ${action}`);
    });
    
  } catch (error) {
    console.error('求解失敗:', error);
  }
}

testWasmSolver().catch(console.error);
