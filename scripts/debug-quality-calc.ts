/**
 * 調試品質計算公式
 * 驗證本地模擬引擎的品質計算是否正確
 */

// 牧羊工具配方參數
const recipe = {
  recipeLevel: 81,
  difficulty: 2000,
  quality: 4160,
  durability: 60,
  baseDifficulty: 2000,
  baseQuality: 5200,
  baseDurability: 80,
  progressDivider: 121,
  progressModifier: 100,
  qualityDivider: 105,
  qualityModifier: 100,
};

// 工匠屬性
const crafterStats = {
  level: 100,
  craftsmanship: 4500,
  control: 4500,
  cp: 700,
};

console.log('=== 品質計算公式驗證 ===\n');

// 計算基礎品質值
// 公式: floor(control * 10 / qualityDivider + 35)
const baseTouch = Math.floor((crafterStats.control * 10) / recipe.qualityDivider + 35);
console.log(`基礎品質計算:`);
console.log(`  公式: floor(control * 10 / qualityDivider + 35)`);
console.log(`  = floor(${crafterStats.control} * 10 / ${recipe.qualityDivider} + 35)`);
console.log(`  = floor(${crafterStats.control * 10 / recipe.qualityDivider} + 35)`);
console.log(`  = floor(${crafterStats.control * 10 / recipe.qualityDivider + 35})`);
console.log(`  = ${baseTouch}`);
console.log();

// 模擬網站的巨集動作
// reflect → waste_not_ii → innovation → delicate_synthesis × 2 → great_strides → byregots_blessing → ...
console.log('=== 模擬網站巨集的品質計算 ===\n');

let quality = 0;
let innerQuietStacks = 0;

// reflect (閃靜) - 效率 300%, 消耗內靜
console.log('1. reflect (閃靜):');
const reflectEfficiency = 300;
const reflectQuality = Math.floor(baseTouch * (reflectEfficiency / 100));
quality += reflectQuality;
innerQuietStacks = 2; // 閃靜後內靜 = 2
console.log(`   效率: ${reflectEfficiency}%`);
console.log(`   品質增量: ${baseTouch} * ${reflectEfficiency / 100} = ${reflectQuality}`);
console.log(`   累積品質: ${quality}`);
console.log(`   內靜層數: ${innerQuietStacks}`);
console.log();

// waste_not_ii (長期儉約) - 不影響品質
console.log('2. waste_not_ii (長期儉約): 無品質影響');
console.log();

// innovation (改革) - +50% 品質 buff
console.log('3. innovation (改革): +50% 品質 buff');
const hasInnovation = true;
console.log();

// delicate_synthesis × 2 (坯料加工) - 效率 100%, 內靜 +1
console.log('4. delicate_synthesis (坯料加工) × 2:');
const delicateEfficiency = 100;
for (let i = 0; i < 2; i++) {
  // 內靜倍率: 1 + 0.1 * stacks
  const innerQuietMultiplier = 1 + 0.1 * innerQuietStacks;
  // Innovation buff: +50%
  const buffMultiplier = hasInnovation ? 1.5 : 1.0;
  const delicateQuality = Math.floor(baseTouch * (delicateEfficiency / 100) * buffMultiplier * innerQuietMultiplier);
  quality += delicateQuality;
  innerQuietStacks = Math.min(10, innerQuietStacks + 1);
  console.log(`   第 ${i + 1} 次:`);
  console.log(`     效率: ${delicateEfficiency}%`);
  console.log(`     內靜倍率: ${innerQuietMultiplier}`);
  console.log(`     Innovation: ${buffMultiplier}`);
  console.log(`     品質增量: ${baseTouch} * ${delicateEfficiency / 100} * ${buffMultiplier} * ${innerQuietMultiplier} = ${delicateQuality}`);
  console.log(`     累積品質: ${quality}`);
  console.log(`     內靜層數: ${innerQuietStacks}`);
}
console.log();

// great_strides (闘步) - 下次加工 +100%
console.log('5. great_strides (闘步): 下次加工 +100%');
const hasGreatStrides = true;
console.log();

// byregots_blessing (比爾格的祝福) - 效率 100% + 20% per 內靜, 消耗所有內靜
console.log('6. byregots_blessing (比爾格的祝福):');
// 效率 = 100 + 20 * stacks, 最高 300
const byregotsEfficiency = Math.min(100 + 20 * innerQuietStacks, 300);
const innerQuietMultiplier = 1 + 0.1 * innerQuietStacks;
// Innovation 仍然有效 (假設還有回合)
// Great Strides +100%
const gsMultiplier = hasGreatStrides ? 2.0 : 1.0;
const innovationMultiplier = hasInnovation ? 1.5 : 1.0; // Innovation 應該過期了，但假設還有
const byregotsQuality = Math.floor(baseTouch * (byregotsEfficiency / 100) * gsMultiplier * innerQuietMultiplier * innovationMultiplier);
quality += byregotsQuality;
console.log(`   效率: ${byregotsEfficiency}%`);
console.log(`   內靜倍率: ${innerQuietMultiplier}`);
console.log(`   Great Strides: ${gsMultiplier}`);
console.log(`   Innovation: ${innovationMultiplier}`);
console.log(`   品質增量: ${baseTouch} * ${byregotsEfficiency / 100} * ${gsMultiplier} * ${innerQuietMultiplier} * ${innovationMultiplier} = ${byregotsQuality}`);
console.log(`   累積品質: ${quality}`);
innerQuietStacks = 0;
console.log();

// 計算 HQ 機率
console.log('=== 結果 ===');
console.log(`最終品質: ${quality}`);
console.log(`目標品質: ${recipe.quality}`);
const qualityPercent = Math.floor((quality * 100) / recipe.quality);
console.log(`品質百分比: ${qualityPercent}%`);

// HQ 機率查表
let hqChance;
if (qualityPercent >= 100) hqChance = 100;
else if (qualityPercent >= 70) hqChance = qualityPercent;
else if (qualityPercent >= 50) hqChance = Math.floor(50 + (qualityPercent - 50) * 0.6);
else if (qualityPercent >= 30) hqChance = Math.floor(30 + (qualityPercent - 30) * 0.5);
else if (qualityPercent >= 10) hqChance = Math.floor(10 + (qualityPercent - 10) * 0.5);
else hqChance = Math.floor(qualityPercent);

console.log(`HQ 機率: ${hqChance}%`);
console.log();

// 重新計算使用正確的 Innovation 持續時間
console.log('=== 考慮 Innovation 持續時間的計算 ===');
console.log('Innovation 持續 4 回合:');
console.log('  回合 1: innovation (施放)');
console.log('  回合 2: delicate_synthesis (Innovation 剩餘 3)');
console.log('  回合 3: delicate_synthesis (Innovation 剩餘 2)');
console.log('  回合 4: great_strides (Innovation 剩餘 1)');
console.log('  回合 5: byregots_blessing (Innovation 過期!)');
console.log();
console.log('如果 byregots_blessing 沒有 Innovation buff:');
const byregotsWithoutInnovation = Math.floor(baseTouch * (byregotsEfficiency / 100) * 2.0 * innerQuietMultiplier);
const qualityWithoutInnovation = quality - byregotsQuality + byregotsWithoutInnovation;
console.log(`比爾格品質 (無 Innovation): ${byregotsWithoutInnovation}`);
console.log(`最終品質: ${qualityWithoutInnovation}`);
const percentWithoutInnovation = Math.floor((qualityWithoutInnovation * 100) / recipe.quality);
console.log(`品質百分比: ${percentWithoutInnovation}%`);
