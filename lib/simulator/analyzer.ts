// ============================================
// FFXIV 生產模擬器 - 分析功能
// 參考自 ffxiv-best-craft 專案的 analyzer 模組
// ============================================

import type {
  CraftingState,
  CraftAction,
  Recipe,
  CrafterStats,
} from '@/types';
import {
  createInitialCraftingState,
  executeCraftAction,
  calculateHQChance,
} from './crafting-engine';

// ---- 分析結果類型 ----

/**
 * 模擬統計結果
 */
export interface SimulationStatistics {
  // 總模擬次數
  totalRuns: number;
  // 發生技能錯誤的次數
  errors: number;
  // 技能執行完畢但製作未完成的次數
  unfinished: number;
  // 進度未推滿的次數（失敗）
  fails: number;
  // 進度推滿但未達到 100% HQ 的次數
  normal: number;
  // 進度和品質都推滿的次數（HQ）
  highQuality: number;
  // 成功率
  successRate: number;
  // HQ 率
  hqRate: number;
  // 平均品質
  averageQuality: number;
  // 平均 HQ 機率
  averageHQChance: number;
  // 最小品質
  minQuality: number;
  // 最大品質
  maxQuality: number;
}

/**
 * 屬性適配範圍
 */
export interface AttributeScope {
  // 作業精度範圍 [最小值, 最大值]
  craftsmanshipRange: [number | null, number | null];
  // 加工精度最小值
  controlMin: number | null;
  // CP 消耗
  cpUsed: number;
  // 是否可以完成製作
  canComplete: boolean;
  // 是否可以達到 100% HQ
  canAchieveHQ: boolean;
}

/**
 * 單步模擬詳情
 */
export interface SimulationStep {
  step: number;
  action: CraftAction;
  progress: number;
  progressGain: number;
  quality: number;
  qualityGain: number;
  durability: number;
  cp: number;
  cpCost: number;
  condition: string;
  buffs: string[];
  hqChance: number;
  success: boolean;
  errorMessage?: string;
}

/**
 * 技能序列效率分析
 */
export interface SequenceAnalysis {
  // 總步數
  totalSteps: number;
  // 總 CP 消耗
  totalCPCost: number;
  // 總耐久消耗
  totalDurabilityCost: number;
  // 進度效率（進度/步數）
  progressEfficiency: number;
  // 品質效率（品質/步數）
  qualityEfficiency: number;
  // 是否有多餘的進度技能
  hasExcessProgress: boolean;
  // 是否有浪費的 Buff
  hasWastedBuffs: boolean;
  // 建議
  suggestions: string[];
  // 詳細步驟
  steps: SimulationStep[];
}

// ---- 模擬函式 ----

/**
 * 執行單次模擬
 */
export function simulateOnce(
  recipe: Recipe,
  crafterStats: CrafterStats,
  actions: CraftAction[]
): CraftingState {
  let state = createInitialCraftingState(recipe, crafterStats);
  
  for (const action of actions) {
    if (state.isComplete) break;
    state = executeCraftAction(state, action);
  }
  
  return state;
}

/**
 * 執行多次隨機模擬（考慮狀態隨機性）
 */
export function runSimulations(
  recipe: Recipe,
  crafterStats: CrafterStats,
  actions: CraftAction[],
  runs: number = 1000
): SimulationStatistics {
  let errors = 0;
  let unfinished = 0;
  let fails = 0;
  let normal = 0;
  let highQuality = 0;
  let totalQuality = 0;
  let totalHQChance = 0;
  let minQuality = Infinity;
  let maxQuality = 0;
  
  for (let i = 0; i < runs; i++) {
    const finalState = simulateOnce(recipe, crafterStats, actions);
    
    // 計算品質相關統計
    totalQuality += finalState.quality;
    minQuality = Math.min(minQuality, finalState.quality);
    maxQuality = Math.max(maxQuality, finalState.quality);
    
    const hqChance = calculateHQChance(finalState.quality, recipe.quality);
    totalHQChance += hqChance;
    
    // 分類結果
    if (!finalState.isComplete) {
      unfinished++;
    } else if (!finalState.isSuccess) {
      fails++;
    } else if (hqChance >= 100) {
      highQuality++;
    } else {
      normal++;
    }
  }
  
  const successfulRuns = normal + highQuality;
  
  return {
    totalRuns: runs,
    errors,
    unfinished,
    fails,
    normal,
    highQuality,
    successRate: (successfulRuns / runs) * 100,
    hqRate: (highQuality / runs) * 100,
    averageQuality: totalQuality / runs,
    averageHQChance: totalHQChance / runs,
    minQuality: minQuality === Infinity ? 0 : minQuality,
    maxQuality,
  };
}

/**
 * 計算屬性適配範圍
 */
export function calculateAttributeScope(
  recipe: Recipe,
  crafterStats: CrafterStats,
  actions: CraftAction[]
): AttributeScope {
  // 先執行一次基準模擬
  const baseState = simulateOnce(recipe, crafterStats, actions);
  const cpUsed = crafterStats.cp - baseState.cp;
  const canComplete = baseState.isSuccess;
  const canAchieveHQ = calculateHQChance(baseState.quality, recipe.quality) >= 100;
  
  // 尋找作業精度範圍
  const craftsmanshipRange = findCraftsmanshipRange(
    recipe,
    crafterStats,
    actions,
    baseState
  );
  
  // 尋找加工精度最小值
  const controlMin = canAchieveHQ
    ? findControlMinimum(recipe, crafterStats, actions)
    : null;
  
  return {
    craftsmanshipRange,
    controlMin,
    cpUsed,
    canComplete,
    canAchieveHQ,
  };
}

/**
 * 尋找作業精度範圍
 */
function findCraftsmanshipRange(
  recipe: Recipe,
  crafterStats: CrafterStats,
  actions: CraftAction[],
  baseState: CraftingState
): [number | null, number | null] {
  const baseCraftsmanship = crafterStats.craftsmanship;
  
  // 尋找最小作業精度
  let minCraftsmanship: number | null = null;
  for (let cm = baseCraftsmanship; cm >= 0; cm -= 10) {
    const testStats = { ...crafterStats, craftsmanship: cm };
    const state = simulateOnce(recipe, testStats, actions);
    
    if (state.progress < recipe.difficulty) {
      break;
    }
    minCraftsmanship = cm;
  }
  
  // 精確尋找最小值
  if (minCraftsmanship !== null && minCraftsmanship > 0) {
    for (let cm = minCraftsmanship + 9; cm >= minCraftsmanship - 10; cm--) {
      if (cm < 0) break;
      const testStats = { ...crafterStats, craftsmanship: cm };
      const state = simulateOnce(recipe, testStats, actions);
      
      if (state.progress >= recipe.difficulty) {
        minCraftsmanship = cm;
      } else {
        break;
      }
    }
  }
  
  // 尋找最大作業精度（步數改變的臨界點）
  let maxCraftsmanship: number | null = baseCraftsmanship;
  const baseSteps = baseState.step;
  
  for (let cm = baseCraftsmanship; cm <= baseCraftsmanship + 1000; cm += 10) {
    const testStats = { ...crafterStats, craftsmanship: cm };
    const state = simulateOnce(recipe, testStats, actions);
    
    if (state.step !== baseSteps) {
      maxCraftsmanship = cm - 10;
      break;
    }
    maxCraftsmanship = null; // 無上限
  }
  
  return [minCraftsmanship, maxCraftsmanship];
}

/**
 * 尋找加工精度最小值
 */
function findControlMinimum(
  recipe: Recipe,
  crafterStats: CrafterStats,
  actions: CraftAction[]
): number | null {
  const baseControl = crafterStats.control;
  
  // 從當前值向下搜尋
  let minControl: number | null = null;
  for (let ct = baseControl; ct >= 0; ct -= 10) {
    const testStats = { ...crafterStats, control: ct };
    const state = simulateOnce(recipe, testStats, actions);
    
    const hqChance = calculateHQChance(state.quality, recipe.quality);
    if (hqChance < 100) {
      break;
    }
    minControl = ct;
  }
  
  // 精確尋找
  if (minControl !== null && minControl > 0) {
    for (let ct = minControl + 9; ct >= minControl - 10; ct--) {
      if (ct < 0) break;
      const testStats = { ...crafterStats, control: ct };
      const state = simulateOnce(recipe, testStats, actions);
      
      const hqChance = calculateHQChance(state.quality, recipe.quality);
      if (hqChance >= 100) {
        minControl = ct;
      } else {
        break;
      }
    }
  }
  
  return minControl;
}

/**
 * 分析技能序列效率
 */
export function analyzeSequence(
  recipe: Recipe,
  crafterStats: CrafterStats,
  actions: CraftAction[]
): SequenceAnalysis {
  const steps: SimulationStep[] = [];
  let state = createInitialCraftingState(recipe, crafterStats);
  let totalCPCost = 0;
  let totalDurabilityCost = 0;
  const suggestions: string[] = [];
  
  let progressComplete = false;
  let progressAfterComplete = 0;
  let buffWasted = false;
  
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const prevState = { ...state };
    
    // 記錄進度是否已完成
    if (state.progress >= recipe.difficulty && !progressComplete) {
      progressComplete = true;
    }
    
    // 執行動作
    state = executeCraftAction(state, action);
    
    // 計算增益
    const progressGain = state.progress - prevState.progress;
    const qualityGain = state.quality - prevState.quality;
    const cpCost = prevState.cp - state.cp;
    const durabilityCost = prevState.durability - state.durability;
    
    totalCPCost += cpCost;
    totalDurabilityCost += durabilityCost;
    
    // 檢查是否有多餘的進度
    if (progressComplete && progressGain > 0) {
      progressAfterComplete += progressGain;
    }
    
    // 記錄步驟詳情
    steps.push({
      step: i + 1,
      action,
      progress: state.progress,
      progressGain,
      quality: state.quality,
      qualityGain,
      durability: state.durability,
      cp: state.cp,
      cpCost,
      condition: state.condition,
      buffs: state.buffs.map(b => `${b.name}(${b.duration})`),
      hqChance: calculateHQChance(state.quality, recipe.quality),
      success: true,
    });
    
    if (state.isComplete) break;
  }
  
  // 分析並產生建議
  const hasExcessProgress = progressAfterComplete > 0;
  if (hasExcessProgress) {
    suggestions.push(`有 ${progressAfterComplete} 點多餘進度，考慮減少進度技能來增加品質`);
  }
  
  // 檢查最後是否有未消耗的品質 Buff
  const unusedQualityBuffs = state.buffs.filter(
    b => b.name === 'Innovation' || b.name === 'GreatStrides'
  );
  const hasWastedBuffs = unusedQualityBuffs.length > 0;
  if (hasWastedBuffs && !state.isComplete) {
    suggestions.push('有品質增益效果未被使用就結束了');
  }
  
  // 檢查內靜是否被充分利用
  const innerQuiet = state.buffs.find(b => b.name === 'InnerQuiet');
  if (innerQuiet && innerQuiet.stacks && innerQuiet.stacks >= 8 && !state.isComplete) {
    suggestions.push(`內靜有 ${innerQuiet.stacks} 層未使用，考慮加入比爾格的祝福`);
  }
  
  // 效率計算
  const progressEfficiency = state.step > 0 ? state.progress / state.step : 0;
  const qualityEfficiency = state.step > 0 ? state.quality / state.step : 0;
  
  // 檢查 CP 使用效率
  const cpEfficiency = totalCPCost / crafterStats.cp;
  if (cpEfficiency < 0.7 && state.quality < recipe.quality) {
    suggestions.push('CP 使用率較低，可以考慮增加更多品質技能');
  }
  
  return {
    totalSteps: state.step,
    totalCPCost,
    totalDurabilityCost,
    progressEfficiency,
    qualityEfficiency,
    hasExcessProgress,
    hasWastedBuffs,
    suggestions,
    steps,
  };
}

/**
 * 計算預估結果
 */
export interface CraftingEstimate {
  // 預估是否能完成
  canComplete: boolean;
  // 預估最終進度
  estimatedProgress: number;
  // 預估最終品質
  estimatedQuality: number;
  // 預估 HQ 機率
  estimatedHQChance: number;
  // 預估剩餘耐久
  estimatedDurability: number;
  // 預估剩餘 CP
  estimatedCP: number;
  // 預估步數
  estimatedSteps: number;
  // 是否會失敗（耐久或進度不足）
  willFail: boolean;
  // 失敗原因
  failureReason?: string;
}

/**
 * 預估製作結果
 */
export function estimateCraftingResult(
  recipe: Recipe,
  crafterStats: CrafterStats,
  actions: CraftAction[]
): CraftingEstimate {
  const state = simulateOnce(recipe, crafterStats, actions);
  
  let willFail = false;
  let failureReason: string | undefined;
  
  if (state.durability <= 0 && state.progress < recipe.difficulty) {
    willFail = true;
    failureReason = '耐久度耗盡但進度未完成';
  } else if (!state.isComplete && actions.length > 0) {
    // 技能執行完但製作未結束
    if (state.progress < recipe.difficulty) {
      willFail = true;
      failureReason = '技能執行完畢但進度不足';
    }
  }
  
  return {
    canComplete: state.isSuccess,
    estimatedProgress: state.progress,
    estimatedQuality: state.quality,
    estimatedHQChance: calculateHQChance(state.quality, recipe.quality),
    estimatedDurability: state.durability,
    estimatedCP: state.cp,
    estimatedSteps: state.step,
    willFail,
    failureReason,
  };
}

/**
 * 快速檢查技能序列是否可行
 */
export function validateActionSequence(
  recipe: Recipe,
  crafterStats: CrafterStats,
  actions: CraftAction[]
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  let state = createInitialCraftingState(recipe, crafterStats);
  
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    
    // CP 檢查
    if (state.cp < action.cpCost) {
      issues.push(`步驟 ${i + 1}: CP 不足以使用 ${action.nameZh}`);
    }
    
    // 耐久檢查
    if (state.durability <= 0 && action.durabilityCost > 0) {
      issues.push(`步驟 ${i + 1}: 耐久度已耗盡`);
    }
    
    state = executeCraftAction(state, action);
    
    if (state.isComplete) {
      if (i < actions.length - 1) {
        issues.push(`步驟 ${i + 1} 後製作已完成，後續 ${actions.length - i - 1} 個技能不會執行`);
      }
      break;
    }
  }
  
  if (!state.isComplete && !state.isSuccess && state.durability <= 0) {
    issues.push('製作會因耐久度耗盡而失敗');
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}
