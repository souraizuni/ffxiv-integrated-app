// 直接測試 WASM 求解器
import { initWasm, raphaelSolve, newStatus, convertStatsToWasm, convertRecipeToWasm, simulate } from '../lib/wasm';

async function test() {
  console.log('初始化 WASM...');
  const ready = await initWasm();
  console.log('WASM ready:', ready);
  
  const stats = { level: 85, craftsmanship: 2459, control: 2304, cp: 464 };
  const recipe = {
    recipeLevel: 85,
    difficulty: 2900,
    quality: 6600,
    durability: 80,
    progressDivider: 130,
    progressModifier: 80,
    qualityDivider: 115,
    qualityModifier: 70,
    conditionsFlag: 15,
  };
  
  console.log('\n=== 輸入參數 ===');
  console.log('Stats:', stats);
  console.log('Recipe:', recipe);
  
  const wasmAttrs = convertStatsToWasm(stats);
  const wasmRecipe = convertRecipeToWasm(recipe);
  
  console.log('\n=== WASM 轉換後 ===');
  console.log('wasmAttrs:', JSON.stringify(wasmAttrs, null, 2));
  console.log('wasmRecipe:', JSON.stringify(wasmRecipe, null, 2));
  
  const status = newStatus(wasmAttrs, wasmRecipe);
  console.log('\n=== 初始狀態 ===');
  console.log('progress:', status.progress, '/', wasmRecipe.difficulty);
  console.log('quality:', status.quality, '/', wasmRecipe.quality);
  console.log('durability:', status.durability, '/', wasmRecipe.durability);
  console.log('cp:', status.craft_points);
  
  // 測試 WASM Raphael 求解
  console.log('\n=== 開始 WASM Raphael 求解 ===');
  const actions = raphaelSolve(
    status,
    null,    // targetQuality (null = 最大)
    true,    // useManipulation
    false,   // useHeartAndSoul
    false,   // useQuickInnovation
    false,   // useTrainedEye
    false,   // backloadProgress
    false    // adversarial
  );
  
  console.log('\n=== 求解結果 ===');
  console.log('動作序列:', actions);
  console.log('總步數:', actions.length);
  
  // 模擬結果
  const result = simulate(status, actions);
  console.log('\n=== 模擬結果 ===');
  console.log('progress:', result.status.progress, '/', recipe.difficulty);
  console.log('quality:', result.status.quality, '/', recipe.quality);
  console.log('durability:', result.status.durability);
  console.log('cp:', result.status.craft_points);
  console.log('errors:', result.errors);
  
  // 將動作轉換為巨集格式
  const actionNameMap: Record<string, string> = {
    'muscle_memory': '堅信',
    'reflect': '閒靜',
    'veneration': '崇敬',
    'waste_not': '儉約',
    'waste_not_2': '長期儉約',
    'manipulation': '掌握',
    'innovation': '改革',
    'great_strides': '闘魂',
    'groundwork': '坯料製作',
    'careful_synthesis': '精密製作',
    'basic_synthesis': '製作',
    'prudent_synthesis': '倹約製作',
    'preparatory_touch': '坯料加工',
    'basic_touch': '加工',
    'standard_touch': '中級加工',
    'advanced_touch': '上級加工',
    'prudent_touch': '倹約加工',
    'byregots_blessing': '比爾格的祝福',
    'trained_finesse': '工匠的神技',
    'observe': '觀察',
    'focused_synthesis': '注視製作',
    'focused_touch': '注視加工',
    'delicate_synthesis': '精密製作',
    'intensive_synthesis': '集中製作',
    'precise_touch': '集中加工',
    'masters_mend': '精修',
    'final_appraisal': '最終確認',
    'tricks_of_the_trade': '秘訣',
  };
  
  console.log('\n=== 巨集格式 ===');
  console.log('/mlock');
  for (const action of actions) {
    const name = actionNameMap[action] || action;
    const wait = ['veneration', 'waste_not', 'waste_not_2', 'manipulation', 'innovation', 'great_strides', 'observe', 'final_appraisal'].includes(action) ? 2 : 3;
    console.log(`/ac ${name} <wait.${wait}>`);
  }
  console.log('/e 巨集#1 已完成！ <se.1>');
}

test().catch(console.error);
