import { describe, it, expect } from 'vitest';
import {
  calculateDurabilityCost,
  calculateCPCost,
  calculateHQChance,
  calculateProgressIncrease,
  calculateQualityIncrease,
  createInitialCraftingState,
  craftActions,
  getAvailableActions,
} from '@/lib/simulator/crafting-engine';
import type { Recipe, CrafterStats, CraftBuff, CraftAction } from '@/types';

// ============================================
// 模擬器公式的迴歸測試
// ============================================
// 這些是整個專案最不能默默改變行為的部分：材料成本、淨利、巨集輸出
// 全部建立在這些數值之上。資料層重構期間，任何一條變紅都代表模擬結果被動到。

const testRecipe: Recipe = {
  id: 35000,
  itemId: 37320,
  craftType: 'CRP',
  craftTypeLevel: 1,
  recipeLevel: 70,
  difficulty: 1200,
  durability: 70,
  quality: 4800,
  requiredCraftsmanship: 0,
  requiredControl: 0,
  ingredients: [],
  canQuickSynth: true,
  canHQ: true,
  stars: 2,
  progressDivider: 90,
  progressModifier: 80,
  qualityDivider: 70,
  qualityModifier: 70,
  conditionsFlag: 15,
  baseDifficulty: 1200,
  baseDurability: 70,
  baseQuality: 4800,
  recipeLevelId: 320,
};

const testStats: CrafterStats = {
  job: 'CRP',
  level: 100,
  craftsmanship: 4956,
  control: 4963,
  cp: 687,
  specialist: false,
};

function findAction(id: string): CraftAction {
  const action = craftActions.find((a) => a.id === id);
  if (!action) throw new Error(`測試用技能不存在: ${id}`);
  return action;
}

function buff(name: string, duration = 5, stacks = 0): CraftBuff {
  return { name, duration, stacks } as CraftBuff;
}

describe('calculateDurabilityCost', () => {
  it('一般狀態不打折', () => {
    expect(calculateDurabilityCost(10, 'Normal', [])).toBe(10);
  });

  it('Sturdy / Robust 狀態減半（無條件進位）', () => {
    expect(calculateDurabilityCost(10, 'Sturdy', [])).toBe(5);
    expect(calculateDurabilityCost(10, 'Robust', [])).toBe(5);
    // 奇數要進位，不是 2.5
    expect(calculateDurabilityCost(5, 'Sturdy', [])).toBe(3);
  });

  it('儉約減半', () => {
    expect(calculateDurabilityCost(10, 'Normal', [buff('WasteNot')])).toBe(5);
    expect(calculateDurabilityCost(10, 'Normal', [buff('WasteNot2')])).toBe(5);
  });

  it('Sturdy + 儉約疊加（各自減半，先後套用）', () => {
    expect(calculateDurabilityCost(10, 'Sturdy', [buff('WasteNot')])).toBe(3);
  });

  it('duration 為 0 的儉約不生效', () => {
    expect(calculateDurabilityCost(10, 'Normal', [buff('WasteNot', 0)])).toBe(10);
  });
});

describe('calculateCPCost', () => {
  const standardTouch = findAction('standard_touch');
  const advancedTouch = findAction('advanced_touch');
  const basicSynth = findAction('basic_synthesis');

  it('一般狀態不打折', () => {
    expect(calculateCPCost(32, 'Normal', [], standardTouch)).toBe(32);
  });

  it('Pliant 狀態減半（無條件進位）', () => {
    expect(calculateCPCost(32, 'Pliant', [], standardTouch)).toBe(16);
    expect(calculateCPCost(7, 'Pliant', [], basicSynth)).toBe(4);
  });

  it('標準加工接在加工後只要 18 CP', () => {
    expect(calculateCPCost(32, 'Normal', [buff('TouchCombo', 5, 1)], standardTouch)).toBe(18);
  });

  it('上級加工接在標準加工後只要 18 CP', () => {
    expect(calculateCPCost(46, 'Normal', [buff('TouchCombo', 5, 2)], advancedTouch)).toBe(18);
  });

  it('連擊層數不對時不折扣', () => {
    expect(calculateCPCost(46, 'Normal', [buff('TouchCombo', 5, 1)], advancedTouch)).toBe(46);
  });
});

describe('calculateHQChance', () => {
  it('品質為 0 時機率為 0', () => {
    expect(calculateHQChance(0, 4800)).toBe(0);
  });

  it('品質達滿值時為 100%', () => {
    expect(calculateHQChance(4800, 4800)).toBe(100);
    expect(calculateHQChance(9600, 4800)).toBe(100);
  });

  it('maxQuality 為 0 時回傳 0 而非 NaN / Infinity', () => {
    expect(calculateHQChance(100, 0)).toBe(0);
  });

  it('70% 以上時機率等於百分比', () => {
    expect(calculateHQChance(3600, 4800)).toBe(75);
    expect(calculateHQChance(4320, 4800)).toBe(90);
  });

  it('隨品質單調遞增', () => {
    let previous = -1;
    for (let q = 0; q <= 4800; q += 48) {
      const chance = calculateHQChance(q, 4800);
      expect(chance).toBeGreaterThanOrEqual(previous);
      previous = chance;
    }
  });

  it('結果永遠落在 0-100 之間且為整數', () => {
    for (let q = 0; q <= 4800; q += 97) {
      const chance = calculateHQChance(q, 4800);
      expect(chance).toBeGreaterThanOrEqual(0);
      expect(chance).toBeLessThanOrEqual(100);
      expect(Number.isInteger(chance)).toBe(true);
    }
  });
});

describe('calculateProgressIncrease', () => {
  const basicSynth = findAction('basic_synthesis');
  const base = createInitialCraftingState(testRecipe, testStats);

  it('無進度效率的技能回傳 0', () => {
    expect(calculateProgressIncrease(base, findAction('basic_touch'))).toBe(0);
  });

  it('回傳整數（向下取整）', () => {
    const value = calculateProgressIncrease(base, basicSynth);
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThan(0);
  });

  it('崇敬 +50%', () => {
    const withVeneration = { ...base, buffs: [buff('Veneration')] };
    const plain = calculateProgressIncrease(base, basicSynth);
    const boosted = calculateProgressIncrease(withVeneration, basicSynth);
    expect(boosted).toBe(Math.floor(plain * 1.5));
  });

  it('肌肉記憶 +100%', () => {
    const withMuscleMemory = { ...base, buffs: [buff('MuscleMemory')] };
    const plain = calculateProgressIncrease(base, basicSynth);
    expect(calculateProgressIncrease(withMuscleMemory, basicSynth)).toBe(Math.floor(plain * 2));
  });

  it('Malleable 狀態 +50%', () => {
    const malleable = { ...base, condition: 'Malleable' as const };
    const plain = calculateProgressIncrease(base, basicSynth);
    expect(calculateProgressIncrease(malleable, basicSynth)).toBe(Math.floor(plain * 1.5));
  });

  it('作業精度越高進度越高', () => {
    const weaker = createInitialCraftingState(testRecipe, { ...testStats, craftsmanship: 2000 });
    expect(calculateProgressIncrease(base, basicSynth)).toBeGreaterThan(
      calculateProgressIncrease(weaker, basicSynth)
    );
  });
});

describe('calculateQualityIncrease', () => {
  const basicTouch = findAction('basic_touch');
  const byregots = findAction('byregots_blessing');
  const base = createInitialCraftingState(testRecipe, testStats);

  it('無品質效率的技能回傳 0', () => {
    expect(calculateQualityIncrease(base, findAction('basic_synthesis'))).toBe(0);
  });

  it('內靜每層 +10%', () => {
    const plain = calculateQualityIncrease(base, basicTouch);
    const withStacks = { ...base, buffs: [buff('InnerQuiet', 999, 5)] };
    expect(calculateQualityIncrease(withStacks, basicTouch)).toBe(Math.floor(plain * 1.5));
  });

  it('Good 狀態 +50%、Excellent ×4、Poor ×0.5', () => {
    const plain = calculateQualityIncrease(base, basicTouch);
    expect(calculateQualityIncrease({ ...base, condition: 'Good' }, basicTouch)).toBe(Math.floor(plain * 1.5));
    expect(calculateQualityIncrease({ ...base, condition: 'Excellent' }, basicTouch)).toBe(Math.floor(plain * 4));
    expect(calculateQualityIncrease({ ...base, condition: 'Poor' }, basicTouch)).toBe(Math.floor(plain * 0.5));
  });

  it('比爾格的祝福效率 = 100% + 每層內靜 20%，且不重複套用內靜倍率', () => {
    const noStacks = { ...base, buffs: [buff('InnerQuiet', 999, 0)] };
    const tenStacks = { ...base, buffs: [buff('InnerQuiet', 999, 10)] };

    const atZero = calculateQualityIncrease(noStacks, byregots);
    const atTen = calculateQualityIncrease(tenStacks, byregots);

    // 0 層 = 100% 效率，10 層 = 300% 效率
    expect(atTen).toBe(Math.floor(atZero * 3));
  });

  it('加工精度越高品質越高', () => {
    const weaker = createInitialCraftingState(testRecipe, { ...testStats, control: 2000 });
    expect(calculateQualityIncrease(base, basicTouch)).toBeGreaterThan(
      calculateQualityIncrease(weaker, basicTouch)
    );
  });
});

describe('getAvailableActions', () => {
  it('等級越高可用技能不會變少', () => {
    let previous = 0;
    for (const level of [1, 15, 30, 50, 70, 80, 90, 100]) {
      const count = getAvailableActions(level).length;
      expect(count).toBeGreaterThanOrEqual(previous);
      previous = count;
    }
  });

  it('回傳的技能都符合等級限制', () => {
    for (const level of [1, 50, 90]) {
      for (const action of getAvailableActions(level)) {
        expect(action.levelRequirement).toBeLessThanOrEqual(level);
      }
    }
  });

  it('100 級涵蓋全部技能', () => {
    expect(getAvailableActions(100).length).toBe(craftActions.length);
  });
});
