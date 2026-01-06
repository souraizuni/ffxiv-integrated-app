// ============================================
// FFXIV 生產模擬器 - 核心計算邏輯
// 參考自 Tnze/ffxiv-crafting 專案的精確公式
// ============================================

import type {
  CraftingState,
  CrafterStats,
  Recipe,
  CraftAction,
  CraftCondition,
  CraftBuff,
} from '@/types';

// ---- 快取結構 ----
interface CraftingCaches {
  baseSynth: number;  // 無 buff 效果下 100 效率的作業技能推動的進展
  baseTouch: number;  // 無 buff 效果下 100 效率的加工技能推動的品質
}

/**
 * 計算基礎進度值
 * 公式: floor(craftsmanship * 10 / progressDivider + 2) * progressModifier / 100
 */
function calculateBaseSynth(crafterStats: CrafterStats, recipe: Recipe): number {
  const progressDivider = recipe.progressDivider || 100;
  const progressModifier = recipe.progressModifier || 100;
  
  let base = (crafterStats.craftsmanship * 10) / progressDivider + 2;
  
  // 如果玩家等級 <= 配方等級，套用 progressModifier
  if (crafterStats.level <= recipe.recipeLevel) {
    base = base * progressModifier / 100;
  }
  
  return Math.floor(base);
}

/**
 * 計算基礎品質值
 * 公式: floor(control * 10 / qualityDivider + 35) * qualityModifier / 100
 */
function calculateBaseTouch(crafterStats: CrafterStats, recipe: Recipe): number {
  const qualityDivider = recipe.qualityDivider || 100;
  const qualityModifier = recipe.qualityModifier || 100;
  
  let base = (crafterStats.control * 10) / qualityDivider + 35;
  
  // 如果玩家等級 <= 配方等級，套用 qualityModifier
  if (crafterStats.level <= recipe.recipeLevel) {
    base = base * qualityModifier / 100;
  }
  
  return Math.floor(base);
}

/**
 * 計算製作快取
 */
function createCaches(crafterStats: CrafterStats, recipe: Recipe): CraftingCaches {
  return {
    baseSynth: calculateBaseSynth(crafterStats, recipe),
    baseTouch: calculateBaseTouch(crafterStats, recipe),
  };
}

// ---- 技能效率定義 ----
const actionEfficiency: Record<string, { progress?: number; quality?: number }> = {
  // 進度技能
  basic_synthesis: { progress: 120 },
  careful_synthesis: { progress: 180 },
  groundwork: { progress: 360 },
  prudent_synthesis: { progress: 180 },
  rapid_synthesis: { progress: 500 },
  intensive_synthesis: { progress: 400 },
  muscle_memory: { progress: 300 },
  delicate_synthesis: { progress: 150, quality: 100 },
  // 品質技能
  basic_touch: { quality: 100 },
  standard_touch: { quality: 125 },
  advanced_touch: { quality: 150 },
  prudent_touch: { quality: 100 },
  preparatory_touch: { quality: 200 },
  byregots_blessing: { quality: 100 }, // 基礎效率，會根據內靜疊加
  hasty_touch: { quality: 100 },
  precise_touch: { quality: 150 },
  focused_touch: { quality: 150 },
  trained_finesse: { quality: 100 },
  reflect: { quality: 300 }, // 閃靜效率300%
};

/**
 * 計算進度 Buff 加成
 */
function getSynthesisBuffMultiplier(buffs: CraftBuff[]): number {
  let multiplier = 1.0;
  
  // 肌肉記憶 +100%
  const muscleMemory = buffs.find(b => b.name === 'MuscleMemory');
  if (muscleMemory && muscleMemory.duration > 0) {
    multiplier += 1.0;
  }
  
  // 崇敬 +50%
  const veneration = buffs.find(b => b.name === 'Veneration');
  if (veneration && veneration.duration > 0) {
    multiplier += 0.5;
  }
  
  return multiplier;
}

/**
 * 計算品質 Buff 加成
 */
function getTouchBuffMultiplier(buffs: CraftBuff[]): number {
  let multiplier = 1.0;
  
  // 闘魂 +100%
  const greatStrides = buffs.find(b => b.name === 'GreatStrides');
  if (greatStrides && greatStrides.duration > 0) {
    multiplier += 1.0;
  }
  
  // 改革 +50%
  const innovation = buffs.find(b => b.name === 'Innovation');
  if (innovation && innovation.duration > 0) {
    multiplier += 0.5;
  }
  
  return multiplier;
}

/**
 * 計算內靜加成
 */
function getInnerQuietMultiplier(buffs: CraftBuff[]): number {
  const innerQuiet = buffs.find(b => b.name === 'InnerQuiet');
  const stacks = innerQuiet?.stacks || 0;
  return 1.0 + (stacks * 0.1); // 每層 +10%
}

/**
 * 取得狀態修正值
 */
function getConditionModifier(condition: CraftCondition, type: 'progress' | 'quality'): number {
  if (type === 'progress') {
    return condition === 'Malleable' ? 1.5 : 1.0;
  } else {
    switch (condition) {
      case 'Good': return 1.5;
      case 'Excellent': return 4.0;
      case 'Poor': return 0.5;
      default: return 1.0;
    }
  }
}

/**
 * 計算進度增加量
 */
export function calculateProgressIncrease(
  state: CraftingState,
  action: CraftAction,
  caches?: CraftingCaches
): number {
  const efficiency = actionEfficiency[action.id]?.progress || 0;
  if (efficiency === 0) return 0;
  
  const baseSynth = caches?.baseSynth || calculateBaseSynth(state.crafterStats, state.recipe);
  const buffMultiplier = getSynthesisBuffMultiplier(state.buffs);
  const conditionMultiplier = getConditionModifier(state.condition, 'progress');
  
  // 進度公式: floor(baseSynth * (efficiency/100) * buffMultiplier * conditionMultiplier)
  let progress = baseSynth * (efficiency / 100) * buffMultiplier * conditionMultiplier;
  
  // Groundwork 在耐久不足時效率減半
  if (action.id === 'groundwork') {
    const duraCost = calculateDurabilityCost(action.durabilityCost, state.condition, state.buffs);
    if (state.durability < duraCost) {
      progress *= 0.5;
    }
  }
  
  return Math.floor(progress);
}

/**
 * 計算品質增加量
 */
export function calculateQualityIncrease(
  state: CraftingState,
  action: CraftAction,
  caches?: CraftingCaches
): number {
  let efficiency = actionEfficiency[action.id]?.quality || 0;
  if (efficiency === 0) return 0;
  
  const innerQuiet = state.buffs.find(b => b.name === 'InnerQuiet');
  const innerQuietStacks = innerQuiet?.stacks || 0;
  
  // 比爾格的祝福特殊處理：基礎 100% + 每層內靜 20%，最高 300%
  if (action.id === 'byregots_blessing') {
    efficiency = Math.min(100 + (innerQuietStacks * 20), 300);
  }
  
  const baseTouch = caches?.baseTouch || calculateBaseTouch(state.crafterStats, state.recipe);
  const buffMultiplier = getTouchBuffMultiplier(state.buffs);
  const innerQuietMultiplier = getInnerQuietMultiplier(state.buffs);
  const conditionMultiplier = getConditionModifier(state.condition, 'quality');
  
  // 品質公式: floor(baseTouch * (efficiency/100) * buffMultiplier * innerQuietMultiplier * conditionMultiplier)
  const quality = baseTouch * (efficiency / 100) * buffMultiplier * innerQuietMultiplier * conditionMultiplier;
  
  return Math.floor(quality);
}

/**
 * 計算耐久度消耗
 */
export function calculateDurabilityCost(
  baseCost: number,
  condition: CraftCondition,
  buffs: CraftBuff[]
): number {
  let cost = baseCost;
  
  // Sturdy 狀態減半
  if (condition === 'Sturdy') {
    cost = Math.ceil(cost / 2);
  }
  
  // 儉約減半
  const hasWasteNot = buffs.some(b => (b.name === 'WasteNot' || b.name === 'WasteNot2') && b.duration > 0);
  if (hasWasteNot) {
    cost = Math.ceil(cost / 2);
  }
  
  return cost;
}

/**
 * 計算 CP 消耗
 */
export function calculateCPCost(
  baseCost: number,
  condition: CraftCondition,
  buffs: CraftBuff[],
  action: CraftAction
): number {
  let cost = baseCost;
  
  // Pliant 狀態減半
  if (condition === 'Pliant') {
    cost = Math.ceil(cost / 2);
  }
  
  // 連擊減少 CP（標準加工接在加工後、上級加工接在標準加工後）
  if (action.id === 'standard_touch') {
    const touchCombo = buffs.find(b => b.name === 'TouchCombo');
    if (touchCombo && touchCombo.stacks === 1) {
      cost = 18; // 連擊時只需 18 CP
    }
  }
  if (action.id === 'advanced_touch') {
    const touchCombo = buffs.find(b => b.name === 'TouchCombo');
    if (touchCombo && touchCombo.stacks === 2) {
      cost = 18; // 連擊時只需 18 CP
    }
  }
  
  return cost;
}

/**
 * 判定 HQ 機率
 * 使用與原專案相同的查表法
 */
export function calculateHQChance(currentQuality: number, maxQuality: number): number {
  if (maxQuality === 0) return 0;
  
  const percent = Math.floor((currentQuality * 100) / maxQuality);
  
  // HQ 機率查表（與原專案 data.rs 中的 high_quality_table 相同）
  if (percent >= 100) return 100;
  if (percent >= 70) return percent;
  if (percent >= 50) return Math.floor(50 + (percent - 50) * 0.6); // 50-70% 區間
  if (percent >= 30) return Math.floor(30 + (percent - 30) * 0.5); // 30-50% 區間
  if (percent >= 10) return Math.floor(10 + (percent - 10) * 0.5); // 10-30% 區間
  return Math.floor(percent); // 0-10% 區間
}

/**
 * 建立初始生產狀態
 */
export function createInitialCraftingState(
  recipe: Recipe,
  crafterStats: CrafterStats
): CraftingState {
  return {
    recipe,
    crafterStats,
    step: 0,
    progress: 0,
    quality: 0,
    durability: recipe.durability,
    cp: crafterStats.cp,
    condition: 'Normal',
    buffs: [],
    actions: [],
    isComplete: false,
    isSuccess: false,
    isHQ: false,
  };
}

/**
 * 確定性版本：建立初始生產狀態（用於求解器）
 */
export function createInitialCraftingStateDeterministic(
  recipe: Recipe,
  crafterStats: CrafterStats
): CraftingState {
  return createInitialCraftingState(recipe, crafterStats);
}

/**
 * 執行生產動作
 */
export function executeCraftAction(
  state: CraftingState,
  action: CraftAction
): CraftingState {
  // 建立快取
  const caches = createCaches(state.crafterStats, state.recipe);
  
  const newState: CraftingState = {
    ...state,
    buffs: state.buffs.map(b => ({ ...b })),
  };
  
  // 計算 CP 消耗
  const cpCost = calculateCPCost(action.cpCost, state.condition, state.buffs, action);
  if (newState.cp < cpCost) {
    return state; // CP 不足
  }
  
  // 扣除 CP
  newState.cp -= cpCost;
  
  // 計算並應用進度
  const progressGain = calculateProgressIncrease(state, action, caches);
  newState.progress = Math.min(state.recipe.difficulty, newState.progress + progressGain);
  
  // 計算並應用品質
  const qualityGain = calculateQualityIncrease(state, action, caches);
  newState.quality = Math.min(state.recipe.quality, newState.quality + qualityGain);
  
  // 計算耐久度消耗
  const durabilityCost = calculateDurabilityCost(action.durabilityCost, state.condition, state.buffs);
  newState.durability -= durabilityCost;
  
  // 處理特殊技能效果
  applyActionEffects(newState, action);
  
  // 消耗肌肉記憶（使用進度技能後）
  if (progressGain > 0 && action.id !== 'muscle_memory') {
    newState.buffs = newState.buffs.filter(b => b.name !== 'MuscleMemory');
  }
  
  // 消耗闘魂（使用品質技能後）
  if (qualityGain > 0) {
    newState.buffs = newState.buffs.filter(b => b.name !== 'GreatStrides');
  }
  
  // 記錄動作
  newState.actions = [...state.actions, action];
  newState.step += 1;
  
  // 處理 Buff 時間減少
  newState.buffs = newState.buffs
    .map(buff => ({
      ...buff,
      duration: buff.duration - 1,
    }))
    .filter(buff => buff.duration > 0 || buff.name === 'InnerQuiet');
  
  // 掌握恢復耐久
  const manipulationBuff = state.buffs.find(b => b.name === 'Manipulation' && b.duration > 0);
  if (manipulationBuff && newState.durability > 0) {
    newState.durability = Math.min(state.recipe.durability, newState.durability + 5);
  }
  
  // 檢查是否完成
  if (newState.durability <= 0) {
    newState.isComplete = true;
    newState.isSuccess = newState.progress >= state.recipe.difficulty;
  } else if (newState.progress >= state.recipe.difficulty) {
    newState.isComplete = true;
    newState.isSuccess = true;
  }
  
  if (newState.isSuccess) {
    newState.isHQ = calculateHQChance(newState.quality, state.recipe.quality) >= 100;
  }
  
  // 產生下一個狀態（模擬時）
  newState.condition = generateNextCondition(state.condition);
  
  return newState;
}

/**
 * 確定性版本：執行生產動作（用於求解器）
 * 狀態固定為 Normal
 */
export function executeCraftActionDeterministic(
  state: CraftingState,
  action: CraftAction
): CraftingState {
  // 使用 Normal 狀態進行計算
  const stateWithNormal: CraftingState = { ...state, condition: 'Normal' };
  const newState = executeCraftAction(stateWithNormal, action);
  // 保持 Normal 狀態
  newState.condition = 'Normal';
  return newState;
}

/**
 * 應用技能特殊效果
 */
function applyActionEffects(state: CraftingState, action: CraftAction): void {
  switch (action.id) {
    // 內靜疊加
    case 'basic_touch':
      addInnerQuietStack(state, 1);
      setTouchCombo(state, 1);
      break;
    case 'standard_touch':
      addInnerQuietStack(state, 1);
      setTouchCombo(state, 2);
      break;
    case 'advanced_touch':
    case 'hasty_touch':
    case 'prudent_touch':
    case 'focused_touch':
      addInnerQuietStack(state, 1);
      clearTouchCombo(state);
      break;
    case 'precise_touch':
      addInnerQuietStack(state, 2);
      clearTouchCombo(state);
      break;
    case 'preparatory_touch':
      addInnerQuietStack(state, 2);
      clearTouchCombo(state);
      break;
    case 'reflect':
      addInnerQuietStack(state, 2);
      break;
    case 'trained_finesse':
      // 不增加內靜
      clearTouchCombo(state);
      break;
    
    // 比爾格消耗內靜
    case 'byregots_blessing':
      state.buffs = state.buffs.filter(b => b.name !== 'InnerQuiet');
      clearTouchCombo(state);
      break;
    
    // Buff 技能
    case 'waste_not':
      addOrRefreshBuff(state, 'WasteNot', 4);
      break;
    case 'waste_not_2':
      addOrRefreshBuff(state, 'WasteNot2', 8);
      break;
    case 'innovation':
      addOrRefreshBuff(state, 'Innovation', 4);
      break;
    case 'veneration':
      addOrRefreshBuff(state, 'Veneration', 4);
      break;
    case 'great_strides':
      addOrRefreshBuff(state, 'GreatStrides', 3);
      break;
    case 'manipulation':
      addOrRefreshBuff(state, 'Manipulation', 8);
      break;
    case 'muscle_memory':
      addOrRefreshBuff(state, 'MuscleMemory', 5);
      break;
    
    // 精修恢復耐久
    case 'masters_mend':
      state.durability = Math.min(state.recipe.durability, state.durability + 30);
      break;
    
    // 觀察（用於連擊）
    case 'observe':
      addOrRefreshBuff(state, 'Observed', 1);
      break;
    
    default:
      // 其他技能清除連擊狀態
      if (action.category !== 'quality') {
        clearTouchCombo(state);
      }
      break;
  }
}

/**
 * 添加內靜層數
 */
function addInnerQuietStack(state: CraftingState, count: number): void {
  const existingBuff = state.buffs.find(b => b.name === 'InnerQuiet');
  if (existingBuff) {
    existingBuff.stacks = Math.min(10, (existingBuff.stacks || 0) + count);
  } else {
    state.buffs.push({ name: 'InnerQuiet', duration: 999, stacks: count });
  }
}

/**
 * 設置連擊狀態
 */
function setTouchCombo(state: CraftingState, stage: number): void {
  const existingBuff = state.buffs.find(b => b.name === 'TouchCombo');
  if (existingBuff) {
    existingBuff.stacks = stage;
    existingBuff.duration = 2;
  } else {
    state.buffs.push({ name: 'TouchCombo', duration: 2, stacks: stage });
  }
}

/**
 * 清除連擊狀態
 */
function clearTouchCombo(state: CraftingState): void {
  state.buffs = state.buffs.filter(b => b.name !== 'TouchCombo');
}

/**
 * 添加或刷新 Buff
 */
function addOrRefreshBuff(state: CraftingState, name: string, duration: number): void {
  // 移除同類型的舊 Buff
  state.buffs = state.buffs.filter(b => b.name !== name);
  // 添加新 Buff
  state.buffs.push({ name, duration: duration + 1 }); // +1 因為當回合會減 1
}

/**
 * 產生下一個製作狀態（隨機）
 */
function generateNextCondition(currentCondition: CraftCondition): CraftCondition {
  if (currentCondition === 'Excellent') {
    return 'Poor';
  }
  if (currentCondition === 'Poor') {
    return 'Normal';
  }
  
  const rand = Math.random();
  if (rand < 0.04) return 'Excellent';
  if (rand < 0.19) return 'Good'; // 15% 機率
  return 'Normal';
}

/**
 * 模擬整個製作過程
 */
export function simulateCrafting(
  recipe: Recipe,
  crafterStats: CrafterStats,
  actionSequence: CraftAction[]
): CraftingState {
  let state = createInitialCraftingState(recipe, crafterStats);
  
  for (const action of actionSequence) {
    if (state.isComplete) break;
    state = executeCraftAction(state, action);
  }
  
  return state;
}

// ---- 所有生產技能定義 ----
export const craftActions: CraftAction[] = [
  // ===== 進度技能 =====
  {
    id: 'basic_synthesis',
    name: 'Basic Synthesis',
    nameZh: '製作',
    cpCost: 0,
    durabilityCost: 10,
    successRate: 100,
    category: 'progress',
    levelRequirement: 1,
    description: '增加進度（效率 120%）',
  },
  {
    id: 'careful_synthesis',
    name: 'Careful Synthesis',
    nameZh: '模範製作',
    cpCost: 7,
    durabilityCost: 10,
    successRate: 100,
    category: 'progress',
    levelRequirement: 62,
    description: '增加進度（效率 180%）',
  },
  {
    id: 'rapid_synthesis',
    name: 'Rapid Synthesis',
    nameZh: '高速製作',
    cpCost: 0,
    durabilityCost: 10,
    successRate: 50,
    category: 'progress',
    levelRequirement: 9,
    description: '增加進度（效率 500%），成功率 50%',
  },
  {
    id: 'groundwork',
    name: 'Groundwork',
    nameZh: '坯料製作',
    cpCost: 18,
    durabilityCost: 20,
    successRate: 100,
    category: 'progress',
    levelRequirement: 72,
    description: '增加進度（效率 360%）',
  },
  {
    id: 'prudent_synthesis',
    name: 'Prudent Synthesis',
    nameZh: '儉約製作',
    cpCost: 18,
    durabilityCost: 5,
    successRate: 100,
    category: 'progress',
    levelRequirement: 88,
    description: '增加進度（效率 180%），耐久消耗 5',
  },
  {
    id: 'intensive_synthesis',
    name: 'Intensive Synthesis',
    nameZh: '集中製作',
    cpCost: 6,
    durabilityCost: 10,
    successRate: 100,
    category: 'progress',
    levelRequirement: 78,
    description: '增加進度（效率 400%），僅在高品質狀態可用',
  },
  {
    id: 'muscle_memory',
    name: 'Muscle Memory',
    nameZh: '堅信',
    cpCost: 6,
    durabilityCost: 10,
    successRate: 100,
    category: 'progress',
    levelRequirement: 54,
    description: '第一步使用，增加進度（效率 300%）並獲得 5 回合 buff',
  },
  {
    id: 'delicate_synthesis',
    name: 'Delicate Synthesis',
    nameZh: '精密製作',
    cpCost: 32,
    durabilityCost: 10,
    successRate: 100,
    category: 'progress',
    levelRequirement: 76,
    description: '同時增加進度和品質（效率 150%/100%）',
  },
  
  // ===== 品質技能 =====
  {
    id: 'basic_touch',
    name: 'Basic Touch',
    nameZh: '加工',
    cpCost: 18,
    durabilityCost: 10,
    successRate: 100,
    category: 'quality',
    levelRequirement: 5,
    description: '增加品質（效率 100%），內靜 +1',
  },
  {
    id: 'standard_touch',
    name: 'Standard Touch',
    nameZh: '中級加工',
    cpCost: 32,
    durabilityCost: 10,
    successRate: 100,
    category: 'quality',
    levelRequirement: 18,
    description: '增加品質（效率 125%），內靜 +1',
  },
  {
    id: 'advanced_touch',
    name: 'Advanced Touch',
    nameZh: '上級加工',
    cpCost: 46,
    durabilityCost: 10,
    successRate: 100,
    category: 'quality',
    levelRequirement: 84,
    description: '增加品質（效率 150%），內靜 +1',
  },
  {
    id: 'hasty_touch',
    name: 'Hasty Touch',
    nameZh: '倉促',
    cpCost: 0,
    durabilityCost: 10,
    successRate: 60,
    category: 'quality',
    levelRequirement: 9,
    description: '增加品質（效率 100%），成功率 60%',
  },
  {
    id: 'precise_touch',
    name: 'Precise Touch',
    nameZh: '集中加工',
    cpCost: 18,
    durabilityCost: 10,
    successRate: 100,
    category: 'quality',
    levelRequirement: 53,
    description: '增加品質（效率 150%），內靜 +2，僅在高品質狀態可用',
  },
  {
    id: 'prudent_touch',
    name: 'Prudent Touch',
    nameZh: '儉約加工',
    cpCost: 25,
    durabilityCost: 5,
    successRate: 100,
    category: 'quality',
    levelRequirement: 66,
    description: '增加品質（效率 100%），耐久消耗 5',
  },
  {
    id: 'preparatory_touch',
    name: 'Preparatory Touch',
    nameZh: '坯料加工',
    cpCost: 40,
    durabilityCost: 20,
    successRate: 100,
    category: 'quality',
    levelRequirement: 71,
    description: '增加品質（效率 200%），內靜 +2',
  },
  {
    id: 'byregots_blessing',
    name: "Byregot's Blessing",
    nameZh: '比爾格的祝福',
    cpCost: 24,
    durabilityCost: 10,
    successRate: 100,
    category: 'quality',
    levelRequirement: 50,
    description: '根據內靜層數大幅增加品質，消耗所有內靜',
  },
  {
    id: 'reflect',
    name: 'Reflect',
    nameZh: '閒靜',
    cpCost: 6,
    durabilityCost: 10,
    successRate: 100,
    category: 'quality',
    levelRequirement: 69,
    description: '第一步使用，增加品質（效率 300%），內靜 +2',
  },
  {
    id: 'trained_finesse',
    name: 'Trained Finesse',
    nameZh: '工匠的神技',
    cpCost: 32,
    durabilityCost: 0,
    successRate: 100,
    category: 'quality',
    levelRequirement: 90,
    description: '增加品質（效率 100%），不消耗耐久，需要內靜 10 層',
  },
  {
    id: 'trained_eye',
    name: 'Trained Eye',
    nameZh: '工匠的神速技巧',
    cpCost: 250,
    durabilityCost: 0,
    successRate: 100,
    category: 'quality',
    levelRequirement: 80,
    description: '第一步使用，直接將品質推滿（需要等級比配方等級高 10 級以上）',
  },
  
  // ===== 耐久技能 =====
  {
    id: 'masters_mend',
    name: "Master's Mend",
    nameZh: '精修',
    cpCost: 88,
    durabilityCost: 0,
    successRate: 100,
    category: 'durability',
    levelRequirement: 7,
    description: '恢復 30 點耐久度',
  },
  
  // ===== Buff 技能 =====
  {
    id: 'waste_not',
    name: 'Waste Not',
    nameZh: '儉約',
    cpCost: 56,
    durabilityCost: 0,
    successRate: 100,
    category: 'buff',
    levelRequirement: 15,
    description: '接下來 4 回合耐久度消耗減半',
  },
  {
    id: 'waste_not_2',
    name: 'Waste Not II',
    nameZh: '長期儉約',
    cpCost: 98,
    durabilityCost: 0,
    successRate: 100,
    category: 'buff',
    levelRequirement: 47,
    description: '接下來 8 回合耐久度消耗減半',
  },
  {
    id: 'manipulation',
    name: 'Manipulation',
    nameZh: '掌握',
    cpCost: 96,
    durabilityCost: 0,
    successRate: 100,
    category: 'buff',
    levelRequirement: 65,
    description: '接下來 8 回合每回合恢復 5 點耐久度',
  },
  {
    id: 'innovation',
    name: 'Innovation',
    nameZh: '改革',
    cpCost: 18,
    durabilityCost: 0,
    successRate: 100,
    category: 'buff',
    levelRequirement: 26,
    description: '接下來 4 回合品質效率提升 50%',
  },
  {
    id: 'veneration',
    name: 'Veneration',
    nameZh: '崇敬',
    cpCost: 18,
    durabilityCost: 0,
    successRate: 100,
    category: 'buff',
    levelRequirement: 15,
    description: '接下來 4 回合進度效率提升 50%',
  },
  {
    id: 'great_strides',
    name: 'Great Strides',
    nameZh: '闊步',
    cpCost: 32,
    durabilityCost: 0,
    successRate: 100,
    category: 'buff',
    levelRequirement: 21,
    description: '下一個品質技能效率提升 100%',
  },
  {
    id: 'observe',
    name: 'Observe',
    nameZh: '觀察',
    cpCost: 7,
    durabilityCost: 0,
    successRate: 100,
    category: 'buff',
    levelRequirement: 13,
    description: '不進行任何動作，等待下一個狀態',
  },
];

/**
 * 根據等級取得可用技能
 */
export function getAvailableActions(level: number): CraftAction[] {
  return craftActions.filter(action => action.levelRequirement <= level);
}
