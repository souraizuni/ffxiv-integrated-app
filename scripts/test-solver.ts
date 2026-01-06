// 測試求解器的腳本 - 測試不同等級組合
import { getAvailableActions, craftActions } from '../lib/simulator/crafting-engine';
import { raphaelSolver, SolverResult } from '../lib/simulator/solver';
import { generateMacro } from '../components/macro-exporter';
import type { Recipe, CrafterStats } from '../types';

// 測試用配方 - Lv60 配方
const testRecipe60: Recipe = {
  id: 1,
  itemId: 1,
  craftType: 'CRP',
  craftTypeLevel: 1,
  recipeLevel: 60,
  difficulty: 400,
  quality: 2000,
  durability: 60,
  progressDivider: 80,
  qualityDivider: 80,
  progressModifier: 100,
  qualityModifier: 100,
  conditionsFlag: 15,
  requiredCraftsmanship: 300,
  requiredControl: 300,
  ingredients: [],
  canQuickSynth: true,
  canHQ: true,
  stars: 0,
};

// Lv90 配方（星級）
const testRecipe90: Recipe = {
  id: 2,
  itemId: 2,
  craftType: 'CRP',
  craftTypeLevel: 1,
  recipeLevel: 90,
  difficulty: 3500,
  quality: 7200,
  durability: 70,
  progressDivider: 130,
  qualityDivider: 115,
  progressModifier: 80,
  qualityModifier: 70,
  conditionsFlag: 15,
  requiredCraftsmanship: 2700,
  requiredControl: 2400,
  ingredients: [],
  canQuickSynth: true,
  canHQ: true,
  stars: 2,
};

// 低等級裝備 (Lv50)
const lowLevelStats: CrafterStats = {
  job: 'CRP',
  level: 50,
  craftsmanship: 800,
  control: 750,
  cp: 280,
  specialist: false,
};

// 中等級裝備 (Lv70)
const midLevelStats: CrafterStats = {
  job: 'CRP',
  level: 70,
  craftsmanship: 1400,
  control: 1350,
  cp: 380,
  specialist: false,
};

// 高等級裝備 (Lv90)
const highLevelStats: CrafterStats = {
  job: 'CRP',
  level: 90,
  craftsmanship: 1977,
  control: 2031,
  cp: 464,
  specialist: false,
};

function printResult(result: SolverResult, recipe: Recipe) {
  console.log('\n===== 結果 =====');
  console.log(`成功: ${result.success}`);
  console.log(`HQ 機率: ${result.hqChance} %`);
  console.log(`步數: ${result.steps}`);
  console.log(`最終進度: ${result.finalState.progress} / ${recipe.difficulty}`);
  console.log(`最終品質: ${result.finalState.quality} / ${recipe.quality}`);
  
  // 顯示使用的技能（按等級分類）
  console.log('\n===== 使用的技能等級分布 =====');
  const skillLevels: Record<string, number[]> = {};
  result.actions.forEach(action => {
    const lvl = action.levelRequirement;
    const key = `Lv${Math.floor(lvl / 10) * 10}+`;
    if (!skillLevels[key]) skillLevels[key] = [];
    if (!skillLevels[key].includes(lvl)) skillLevels[key].push(lvl);
  });
  Object.entries(skillLevels)
    .sort(([a], [b]) => parseInt(a.slice(2)) - parseInt(b.slice(2)))
    .forEach(([key, levels]) => {
      console.log(`${key}: ${levels.join(', ')}`);
    });
  
  // 顯示巨集
  console.log('\n===== 巨集輸出 =====');
  const macro = generateMacro(result.actions);
  console.log(macro);
}

async function testSolver(recipe: Recipe, stats: CrafterStats, name: string): Promise<boolean> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`測試: ${name}`);
  console.log(`配方: Lv${recipe.recipeLevel} (難度: ${recipe.difficulty}, 品質: ${recipe.quality})`);
  console.log(`裝備: Lv${stats.level}, 作業${stats.craftsmanship}, 加工${stats.control}, CP${stats.cp}`);
  
  // 顯示可用技能數量
  const availableActions = getAvailableActions(stats.level);
  console.log(`可用技能數: ${availableActions.length}/${craftActions.length}`);
  
  // 顯示關鍵技能是否可用
  const keySkills = ['reflect', 'muscle_memory', 'manipulation', 'preparatory_touch', 'trained_finesse'];
  const available = keySkills.filter(id => availableActions.some(a => a.id === id));
  const unavailable = keySkills.filter(id => !availableActions.some(a => a.id === id));
  console.log(`可用關鍵技能: ${available.join(', ') || '無'}`);
  if (unavailable.length > 0) {
    console.log(`不可用關鍵技能: ${unavailable.join(', ')}`);
  }
  
  try {
    const result = await raphaelSolver(recipe, stats, {
      targetQuality: recipe.quality,
      useManipulation: availableActions.some(a => a.id === 'manipulation'),
    });
    printResult(result, recipe);
    return result.success;
  } catch (error) {
    console.error('求解失敗:', error);
    return false;
  }
}

console.log('開始測試求解器...\n');

// 測試不同等級組合
const tests = [
  { recipe: testRecipe60, stats: lowLevelStats, name: 'Lv50 裝備 + Lv60 配方' },
  { recipe: testRecipe60, stats: midLevelStats, name: 'Lv70 裝備 + Lv60 配方' },
  { recipe: testRecipe60, stats: highLevelStats, name: 'Lv90 裝備 + Lv60 配方' },
  { recipe: testRecipe90, stats: highLevelStats, name: 'Lv90 裝備 + Lv90 配方' },
];

async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const success = await testSolver(test.recipe, test.stats, test.name);
    if (success) passed++;
    else failed++;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`測試完成: ${passed} 成功, ${failed} 失敗`);
}

runTests().catch(console.error);
