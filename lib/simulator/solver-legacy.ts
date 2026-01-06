// ============================================
// 生產模擬器 - 最佳化求解器
// 使用啟發式搜尋尋找最佳技能組合
// ============================================

import type {
  CraftingState,
  CrafterStats,
  Recipe,
  CraftAction,
} from '@/types';

import {
  createInitialCraftingState,
  createInitialCraftingStateDeterministic,
  executeCraftAction,
  executeCraftActionDeterministic,
  getAvailableActions,
  calculateHQChance,
} from './crafting-engine';

export interface SolverResult {
  actions: CraftAction[];
  finalState: CraftingState;
  hqChance: number;
  success: boolean;
  steps: number;
}

export interface SolverOptions {
  maxSteps?: number;
  targetHQChance?: number;
  prioritizeProgress?: boolean;
  prioritizeQuality?: boolean;
}

/**
 * Raphael 風格求解器選項
 */
export interface RaphaelSolverOptions {
  targetQuality?: number;         // 目標品質 (null = 最大品質)
  useManipulation?: boolean;      // 使用掌握
  useHeartAndSoul?: boolean;      // 使用能工巧匠圖紙
  useQuickInnovation?: boolean;   // 使用快速革新
  useTrainedEye?: boolean;        // 使用工匠的神速技巧
  backloadProgress?: boolean;     // 後置作業技能（快速求解）
  adversarial?: boolean;          // 確保 100% 可靠（防黑球）
}

/**
 * 根據等級和配方選擇最佳開場策略
 */
function selectOpenerStrategy(
  recipe: Recipe,
  crafterStats: CrafterStats,
  actions: CraftAction[]
): 'reflect' | 'muscle_memory' | 'standard' {
  const hasReflect = actions.some(a => a.id === 'reflect');
  const hasMuscleMemory = actions.some(a => a.id === 'muscle_memory');
  
  // 如果配方沒有品質要求（無法 HQ），優先用堅信
  if (recipe.quality === 0 && hasMuscleMemory) {
    return 'muscle_memory';
  }
  
  // 如果有高等級技能可用（Lv69+），閒靜通常更好
  if (hasReflect && crafterStats.level >= 69) {
    // 計算進度/品質比例
    const progressRatio = recipe.difficulty / (recipe.quality || 1);
    
    // 如果進度需求特別高（星級配方），考慮用堅信
    if (progressRatio > 3 && hasMuscleMemory) {
      return 'muscle_memory';
    }
    
    return 'reflect';
  }
  
  // 低等級時用堅信（如果有的話）
  if (hasMuscleMemory && crafterStats.level >= 54) {
    return 'muscle_memory';
  }
  
  return 'standard';
}

/**
 * 根據等級選擇最有效率的品質技能
 */
function selectBestQualityAction(
  state: CraftingState,
  actions: CraftAction[],
  hasInnovation: boolean
): CraftAction | null {
  const level = state.crafterStats.level;
  const innerQuiet = state.buffs.find(b => b.name === 'InnerQuiet');
  const iqStacks = innerQuiet?.stacks || 0;
  const hasWasteNot = state.buffs.some(b => 
    (b.name === 'WasteNot' || b.name === 'WasteNot2') && b.duration > 0
  );
  
  // 根據等級和狀態選擇最佳品質技能
  const candidates: { action: CraftAction; efficiency: number }[] = [];
  
  for (const action of actions) {
    if (action.category !== 'quality') continue;
    if (!isActionUsable(state, action)) continue;
    
    // 跳過比爾格（需要特殊時機使用）
    if (action.id === 'byregots_blessing') continue;
    
    // 計算效率 (品質/CP 比)
    let efficiency = 0;
    
    switch (action.id) {
      case 'trained_finesse': // Lv90: 不消耗耐久
        if (iqStacks === 10) efficiency = 100 / 32 * 2; // 額外加成因為不消耗耐久
        break;
      case 'preparatory_touch': // Lv71: 200% 效率 + 2 內靜
        if (iqStacks < 8) efficiency = 200 / 40 * 1.5; // 考慮內靜加成
        break;
      case 'prudent_touch': // Lv66: 100% 效率，只消耗 5 耐久
        if (!hasWasteNot) efficiency = 100 / 25 * 1.8; // 耐久效率高
        break;
      case 'advanced_touch': // Lv84: 150% 效率
        efficiency = 150 / 46;
        break;
      case 'standard_touch': // Lv18: 125% 效率
        efficiency = 125 / 32;
        break;
      case 'basic_touch': // Lv5: 100% 效率
        efficiency = 100 / 18;
        break;
    }
    
    if (hasInnovation) efficiency *= 1.5;
    
    if (efficiency > 0) {
      candidates.push({ action, efficiency });
    }
  }
  
  if (candidates.length === 0) return null;
  
  // 按效率排序
  candidates.sort((a, b) => b.efficiency - a.efficiency);
  return candidates[0].action;
}

/**
 * Raphael 風格求解器
 * 使用階段性策略求解
 */
export function raphaelSolver(
  recipe: Recipe,
  crafterStats: CrafterStats,
  options: RaphaelSolverOptions = {}
): SolverResult {
  const {
    targetQuality = recipe.quality,
    useManipulation = true,
    backloadProgress = false,
  } = options;

  // 根據等級取得可用技能
  const availableActions = getAvailableActions(crafterStats.level);
  
  // 過濾掉不使用的技能和不穩定技能
  const filteredActions = availableActions.filter(action => {
    if (!useManipulation && action.id === 'manipulation') return false;
    // 排除需要特殊條件的技能
    if (action.id === 'intensive_synthesis') return false; // 需要高品質
    if (action.id === 'precise_touch') return false; // 需要高品質
    if (action.id === 'rapid_synthesis') return false; // 有失敗率
    if (action.id === 'hasty_touch') return false; // 有失敗率
    return true;
  });
  
  // 選擇開場策略
  const openerStrategy = selectOpenerStrategy(recipe, crafterStats, filteredActions);

  // 使用階段性求解策略
  const result = phasedSolver(
    recipe,
    crafterStats,
    filteredActions,
    targetQuality,
    backloadProgress,
    openerStrategy
  );

  return result;
}

/**
 * 計算完成製作所需的最小資源
 * 使用實際模擬來精確估算
 */
function estimateFinishResources(state: CraftingState, actions: CraftAction[]): { cp: number; durability: number; steps: number } {
  const progressNeeded = state.recipe.difficulty - state.progress;
  if (progressNeeded <= 0) {
    return { cp: 0, durability: 0, steps: 0 };
  }
  
  let cpUsed = 0;
  let durabilityUsed = 0;
  let stepsUsed = 0;
  
  // 可用的進度技能
  const groundwork = actions.find(a => a.id === 'groundwork');
  const carefulSynthesis = actions.find(a => a.id === 'careful_synthesis');
  const basicSynthesis = actions.find(a => a.id === 'basic_synthesis');
  const veneration = actions.find(a => a.id === 'veneration');
  
  // 如果進度需求大，考慮使用崇敬
  const hasVeneration = state.buffs.some(b => b.name === 'Veneration' && b.duration > 0);
  if (!hasVeneration && progressNeeded > 1500 && veneration) {
    cpUsed += veneration.cpCost;
    stepsUsed++;
  }
  
  // 估算需要幾次進度技能（使用比較保守的估計）
  // 坯料製作在崇敬下約 1200 進度，無崇敬約 800
  const progressPerGroundwork = hasVeneration || progressNeeded > 1500 ? 1200 : 800;
  let actionsNeeded = Math.ceil(progressNeeded / progressPerGroundwork);
  
  if (groundwork) {
    cpUsed += groundwork.cpCost * actionsNeeded;
    durabilityUsed += 20 * actionsNeeded;
    stepsUsed += actionsNeeded;
  } else if (carefulSynthesis) {
    const progressPerCareful = 450;
    actionsNeeded = Math.ceil(progressNeeded / progressPerCareful);
    cpUsed += carefulSynthesis.cpCost * actionsNeeded;
    durabilityUsed += 10 * actionsNeeded;
    stepsUsed += actionsNeeded;
  } else if (basicSynthesis) {
    const progressPerBasic = 300;
    actionsNeeded = Math.ceil(progressNeeded / progressPerBasic);
    cpUsed += basicSynthesis.cpCost * actionsNeeded;
    durabilityUsed += 10 * actionsNeeded;
    stepsUsed += actionsNeeded;
  }
  
  // 加上比爾格的資源（如果有內靜）
  const innerQuiet = state.buffs.find(b => b.name === 'InnerQuiet');
  if (innerQuiet && (innerQuiet.stacks || 0) > 0) {
    cpUsed += 24; // 比爾格 CP
    durabilityUsed += 10;
    stepsUsed++;
    
    // 如果內靜低，可能還需要放改革
    if ((innerQuiet.stacks || 0) >= 3) {
      cpUsed += 18; // innovation
      stepsUsed++;
    }
  }
  
  // 如果耐久不夠，需要額外的恢復技能成本
  // 但我們不在這裡計算，因為 selectFinishActions 會處理
  
  return {
    cp: cpUsed,
    durability: Math.min(durabilityUsed, 50), // 最多預留 50 耐久
    steps: stepsUsed,
  };
}

/**
 * 階段性求解器
 * 分為三個階段：開場、品質提升、完成
 */
function phasedSolver(
  recipe: Recipe,
  crafterStats: CrafterStats,
  actions: CraftAction[],
  targetQuality: number,
  backloadProgress: boolean,
  openerStrategy: 'reflect' | 'muscle_memory' | 'standard' = 'reflect'
): SolverResult {
  let state = createInitialCraftingStateDeterministic(recipe, crafterStats);
  const selectedActions: CraftAction[] = [];
  const maxSteps = 35;
  
  // 階段 1: 開場（根據策略選擇）
  const opener = selectOpener(state, actions, openerStrategy);
  if (opener) {
    state = executeCraftActionDeterministic(state, opener);
    selectedActions.push(opener);
  }
  
  // 階段 2: 設置 Buff 並提升品質
  while (!state.isComplete && selectedActions.length < maxSteps) {
    // 計算完成製作需要的資源
    const finishResources = estimateFinishResources(state, actions);
    
    // 檢查是否需要完成
    const canFinish = canFinishCraft(state, actions);
    const qualityPercent = state.quality / recipe.quality;
    const targetPercent = targetQuality / recipe.quality;
    
    // 如果品質已經足夠且可以完成，就完成
    if (qualityPercent >= targetPercent && canFinish) {
      break;
    }
    
    // 預留比爾格的 CP 和耐久
    const reservedCp = finishResources.cp + 30; // 額外安全邊際
    const reservedDurability = finishResources.durability;
    
    // 如果資源不足以繼續加品質後完成，必須現在開始收尾
    const hasEnoughCpForQuality = state.cp > reservedCp;
    const hasEnoughDurabilityForQuality = state.durability > reservedDurability;
    
    if (!hasEnoughCpForQuality || !hasEnoughDurabilityForQuality) {
      break;
    }
    
    // 如果 CP 或耐久太低，必須完成
    if (mustFinish(state, actions)) {
      break;
    }
    
    // 選擇下一個動作
    const nextAction = selectNextAction(state, actions, targetQuality, backloadProgress);
    if (!nextAction) break;
    
    state = executeCraftActionDeterministic(state, nextAction);
    selectedActions.push(nextAction);
  }
  
  // 階段 3: 完成製作
  const finishActions = selectFinishActions(state, actions);
  for (const action of finishActions) {
    if (state.isComplete) break;
    state = executeCraftActionDeterministic(state, action);
    selectedActions.push(action);
  }
  
  return {
    actions: selectedActions,
    finalState: state,
    hqChance: calculateHQChance(state.quality, recipe.quality),
    success: state.isSuccess,
    steps: selectedActions.length,
  };
}

/**
 * 選擇開場技能
 */
function selectOpener(
  state: CraftingState,
  actions: CraftAction[],
  strategy: 'reflect' | 'muscle_memory' | 'standard' = 'reflect'
): CraftAction | null {
  if (strategy === 'reflect') {
    // 優先使用閒靜（品質開場）
    const reflect = actions.find(a => a.id === 'reflect');
    if (reflect && isActionUsable(state, reflect)) {
      return reflect;
    }
  }
  
  if (strategy === 'muscle_memory' || strategy === 'reflect') {
    // 使用堅信（進度開場）
    const muscleMemory = actions.find(a => a.id === 'muscle_memory');
    if (muscleMemory && isActionUsable(state, muscleMemory)) {
      return muscleMemory;
    }
  }
  
  return null;
}

/**
 * 檢查是否可以完成製作
 */
function canFinishCraft(state: CraftingState, actions: CraftAction[]): boolean {
  // 找到能完成製作的進度技能
  const progressActions = actions.filter(a => a.category === 'progress' && isActionUsable(state, a));
  
  for (const action of progressActions) {
    // 模擬執行
    const newState = executeCraftActionDeterministic(state, action);
    if (newState.progress >= state.recipe.difficulty) {
      return true;
    }
  }
  
  // 嘗試用崇敬 + 進度技能
  const veneration = actions.find(a => a.id === 'veneration');
  if (veneration && isActionUsable(state, veneration)) {
    const stateWithVen = executeCraftActionDeterministic(state, veneration);
    for (const action of progressActions) {
      if (!isActionUsable(stateWithVen, action)) continue;
      const newState = executeCraftActionDeterministic(stateWithVen, action);
      if (newState.progress >= state.recipe.difficulty) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * 檢查是否必須完成（資源不足）
 */
function mustFinish(state: CraftingState, actions: CraftAction[]): boolean {
  // CP 太低
  if (state.cp < 40) return true;
  
  // 耐久度太低
  if (state.durability <= 10) return true;
  
  return false;
}

/**
 * 選擇下一個動作
 */
function selectNextAction(
  state: CraftingState,
  actions: CraftAction[],
  targetQuality: number,
  backloadProgress: boolean
): CraftAction | null {
  const candidates: { action: CraftAction; score: number }[] = [];
  
  for (const action of actions) {
    if (!isActionUsable(state, action)) continue;
    
    // 計算優先度分數
    const score = calculateActionPriority(state, action, targetQuality, backloadProgress);
    if (score > 0) {
      candidates.push({ action, score });
    }
  }
  
  if (candidates.length === 0) return null;
  
  // 按分數排序，取最高的
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].action;
}

/**
 * 計算動作優先度分數
 */
function calculateActionPriority(
  state: CraftingState,
  action: CraftAction,
  targetQuality: number,
  backloadProgress: boolean
): number {
  let score = 0;
  const { recipe } = state;
  const qualityPercent = state.quality / recipe.quality;
  const targetPercent = targetQuality / recipe.quality;
  const durabilityPercent = state.durability / recipe.durability;
  const cpPercent = state.cp / state.crafterStats.cp;
  
  // 取得內靜層數
  const innerQuiet = state.buffs.find(b => b.name === 'InnerQuiet');
  const iqStacks = innerQuiet?.stacks || 0;
  
  // 取得現有 Buff
  const hasInnovation = state.buffs.some(b => b.name === 'Innovation' && b.duration > 0);
  const hasGreatStrides = state.buffs.some(b => b.name === 'GreatStrides' && b.duration > 0);
  const hasWasteNot = state.buffs.some(b => (b.name === 'WasteNot' || b.name === 'WasteNot2') && b.duration > 0);
  const hasManipulation = state.buffs.some(b => b.name === 'Manipulation' && b.duration > 0);
  const hasMuscleMemory = state.buffs.some(b => b.name === 'MuscleMemory' && b.duration > 0);
  
  switch (action.id) {
    // === Buff 技能 ===
    case 'innovation':
      // 有內靜且沒有改革時使用
      if (iqStacks >= 2 && !hasInnovation && qualityPercent < targetPercent) {
        score = 150;
      }
      break;
      
    case 'great_strides':
      // 內靜 >= 8 且有改革時使用，準備放比爾格
      if (iqStacks >= 8 && hasInnovation && !hasGreatStrides && qualityPercent < targetPercent) {
        score = 160;
      }
      break;
      
    case 'veneration':
      // 有肌肉記憶 buff 時使用，或者需要快速推進度
      if (hasMuscleMemory || backloadProgress) {
        score = 120;
      }
      break;
      
    case 'manipulation':
      // 耐久度低於 70% 且沒有掌握時使用
      if (durabilityPercent < 0.7 && !hasManipulation && cpPercent > 0.3) {
        score = 130;
      }
      break;
      
    case 'waste_not':
      // 準備大量加工時使用
      if (!hasWasteNot && durabilityPercent > 0.4 && qualityPercent < targetPercent) {
        score = 90;
      }
      break;
      
    case 'waste_not_2':
      // 長時間加工時使用 - 優先於掌握
      if (!hasWasteNot && !hasManipulation && durabilityPercent > 0.5 && qualityPercent < targetPercent * 0.7) {
        score = 140; // 比掌握略高
      }
      break;
      
    // === 品質技能 ===
    case 'byregots_blessing':
      // 內靜 >= 8 且有改革和闘魂時使用
      if (iqStacks >= 8 && hasInnovation && hasGreatStrides) {
        score = 200;
      } else if (iqStacks >= 10 && hasInnovation) {
        score = 180;
      } else if (iqStacks >= 10 && qualityPercent < targetPercent) {
        score = 160;
      }
      break;
      
    case 'basic_touch':
      // 基礎加工，用於堆疊內靜
      if (iqStacks < 10 && qualityPercent < targetPercent) {
        score = hasInnovation ? 100 : 70;
      }
      break;
      
    case 'standard_touch':
      // 中級加工
      if (iqStacks < 10 && qualityPercent < targetPercent) {
        score = hasInnovation ? 105 : 75;
      }
      break;
      
    case 'advanced_touch':
      // 上級加工
      if (iqStacks < 10 && qualityPercent < targetPercent) {
        score = hasInnovation ? 110 : 80;
      }
      break;
      
    case 'prudent_touch':
      // 儉約加工，耐久效率高
      if (iqStacks < 10 && qualityPercent < targetPercent) {
        score = hasInnovation ? 95 : 65;
        if (durabilityPercent < 0.4) score += 20; // 耐久低時更優先
      }
      break;
      
    case 'preparatory_touch':
      // 坯料加工，快速堆疊內靜
      if (iqStacks < 8 && qualityPercent < targetPercent && durabilityPercent > 0.4) {
        score = hasInnovation ? 115 : 85;
      }
      break;
      
    case 'trained_finesse':
      // 工匠的神技，不消耗耐久
      if (iqStacks === 10 && qualityPercent < targetPercent) {
        score = hasInnovation ? 140 : 90;
      }
      break;
      
    // === 進度技能 ===
    case 'groundwork':
      // 坯料製作，高效率進度
      if (hasMuscleMemory || backloadProgress) {
        score = 100;
      } else if (qualityPercent >= targetPercent) {
        score = 120;
      }
      break;
      
    case 'careful_synthesis':
      // 模範製作
      if (hasMuscleMemory) {
        score = 90;
      } else if (qualityPercent >= targetPercent) {
        score = 100;
      }
      break;
      
    case 'basic_synthesis':
      // 基礎製作
      if (qualityPercent >= targetPercent) {
        score = 80;
      }
      break;
      
    // === 耐久技能 ===
    case 'masters_mend':
      // 精修，低耐久時使用
      if (durabilityPercent < 0.3 && !hasManipulation) {
        score = 110;
      }
      break;
  }
  
  // CP 效率懲罰
  if (action.cpCost > 0 && cpPercent < 0.3) {
    score *= 0.8;
  }
  
  return score;
}

/**
 * 選擇完成動作序列
 */
function selectFinishActions(state: CraftingState, actions: CraftAction[]): CraftAction[] {
  const result: CraftAction[] = [];
  let currentState = state;
  const maxFinishSteps = 15; // 最多 15 步來完成
  
  // 計算完成製作需要多少耐久
  const progressNeeded = currentState.recipe.difficulty - currentState.progress;
  const estimatedDurabilityNeeded = Math.ceil(progressNeeded / 800) * 20 + 20; // 坯料製作消耗 + 比爾格
  
  // 如果耐久不夠完成，先用掌握或精修（只做一次）
  if (currentState.durability < estimatedDurabilityNeeded && !currentState.isComplete) {
    const manipulation = actions.find(a => a.id === 'manipulation');
    const mastersMend = actions.find(a => a.id === 'masters_mend');
    
    if (manipulation && isActionUsable(currentState, manipulation)) {
      result.push(manipulation);
      currentState = executeCraftActionDeterministic(currentState, manipulation);
    } else if (mastersMend && isActionUsable(currentState, mastersMend)) {
      result.push(mastersMend);
      currentState = executeCraftActionDeterministic(currentState, mastersMend);
    }
  }
  
  // 如果品質技能還可以用且有內靜，先用比爾格
  const innerQuiet = currentState.buffs.find(b => b.name === 'InnerQuiet');
  const iqStacks = innerQuiet?.stacks || 0;
  
  if (iqStacks > 0 && currentState.durability >= 10) {
    // 如果有闘魂或改革，先放
    const hasGreatStrides = currentState.buffs.some(b => b.name === 'GreatStrides' && b.duration > 0);
    const hasInnovation = currentState.buffs.some(b => b.name === 'Innovation' && b.duration > 0);
    
    if (!hasInnovation && currentState.cp >= 50) {
      const innovation = actions.find(a => a.id === 'innovation');
      if (innovation && isActionUsable(currentState, innovation)) {
        result.push(innovation);
        currentState = executeCraftActionDeterministic(currentState, innovation);
      }
    }
    
    if (!hasGreatStrides && iqStacks >= 5 && currentState.cp >= 50) {
      const greatStrides = actions.find(a => a.id === 'great_strides');
      if (greatStrides && isActionUsable(currentState, greatStrides)) {
        result.push(greatStrides);
        currentState = executeCraftActionDeterministic(currentState, greatStrides);
      }
    }
    
    const byregots = actions.find(a => a.id === 'byregots_blessing');
    if (byregots && isActionUsable(currentState, byregots)) {
      result.push(byregots);
      currentState = executeCraftActionDeterministic(currentState, byregots);
    }
  }
  
  // 推進度完成
  if (progressNeeded > 0 && !currentState.isComplete) {
    // 嘗試使用崇敬
    const veneration = actions.find(a => a.id === 'veneration');
    const hasVeneration = currentState.buffs.some(b => b.name === 'Veneration' && b.duration > 0);
    if (!hasVeneration && veneration && isActionUsable(currentState, veneration)) {
      const remainingProgress = currentState.recipe.difficulty - currentState.progress;
      if (remainingProgress > 300) {
        result.push(veneration);
        currentState = executeCraftActionDeterministic(currentState, veneration);
      }
    }
    
    // 迴圈使用進度技能直到完成
    while (!currentState.isComplete && result.length < maxFinishSteps) {
      // 如果耐久不夠，嘗試恢復
      if (currentState.durability < 10) {
        const manipulation = actions.find(a => a.id === 'manipulation');
        const mastersMend = actions.find(a => a.id === 'masters_mend');
        
        if (manipulation && isActionUsable(currentState, manipulation)) {
          result.push(manipulation);
          currentState = executeCraftActionDeterministic(currentState, manipulation);
          continue;
        } else if (mastersMend && isActionUsable(currentState, mastersMend)) {
          result.push(mastersMend);
          currentState = executeCraftActionDeterministic(currentState, mastersMend);
          continue;
        }
      }
      
      // 選擇最好的進度技能
      const progressActions = actions
        .filter(a => a.category === 'progress' && isActionUsable(currentState, a))
        .map(a => {
          const newState = executeCraftActionDeterministic(currentState, a);
          return {
            action: a,
            progressGain: newState.progress - currentState.progress,
            canComplete: newState.progress >= currentState.recipe.difficulty,
          };
        })
        .sort((a, b) => {
          // 優先選擇能完成的
          if (a.canComplete && !b.canComplete) return -1;
          if (b.canComplete && !a.canComplete) return 1;
          // 否則選擇進度最高的
          return b.progressGain - a.progressGain;
        });
      
      if (progressActions.length === 0) break;
      
      const best = progressActions[0];
      result.push(best.action);
      currentState = executeCraftActionDeterministic(currentState, best.action);
    }
  }
  
  // 最後安全檢查：如果進度差一點點，嘗試用小技能補足
  if (!currentState.isComplete && currentState.progress > 0) {
    const remainingProgress = currentState.recipe.difficulty - currentState.progress;
    if (remainingProgress > 0 && remainingProgress < 200) {
      // 嘗試用模範製作或基礎製作
      const carefulSynthesis = actions.find(a => a.id === 'careful_synthesis');
      const basicSynthesis = actions.find(a => a.id === 'basic_synthesis');
      
      if (carefulSynthesis && isActionUsable(currentState, carefulSynthesis)) {
        result.push(carefulSynthesis);
        currentState = executeCraftActionDeterministic(currentState, carefulSynthesis);
      } else if (basicSynthesis && isActionUsable(currentState, basicSynthesis)) {
        result.push(basicSynthesis);
        currentState = executeCraftActionDeterministic(currentState, basicSynthesis);
      }
    }
  }
  
  return result;
}

/**
 * 檢查技能是否可用
 */
function isActionUsable(state: CraftingState, action: CraftAction): boolean {
  if (state.isComplete) return false;
  if (state.cp < action.cpCost) return false;
  if (action.durabilityCost > 0 && state.durability <= 0) return false;
  
  // 特殊條件檢查
  const hasWasteNot = state.buffs.some(b => (b.name === 'WasteNot' || b.name === 'WasteNot2') && b.duration > 0);
  
  // 儉約技能在有儉約 buff 時不能用
  if ((action.id === 'prudent_synthesis' || action.id === 'prudent_touch') && hasWasteNot) {
    return false;
  }
  
  // 工匠神技需要內靜 10 層
  if (action.id === 'trained_finesse') {
    const innerQuiet = state.buffs.find(b => b.name === 'InnerQuiet');
    if (!innerQuiet || (innerQuiet.stacks || 0) < 10) return false;
  }
  
  // 第一步才能用的技能
  if ((action.id === 'muscle_memory' || action.id === 'reflect') && state.step > 0) {
    return false;
  }
  
  // 比爾格需要有內靜
  if (action.id === 'byregots_blessing') {
    const innerQuiet = state.buffs.find(b => b.name === 'InnerQuiet');
    if (!innerQuiet || (innerQuiet.stacks || 0) < 1) return false;
  }
  
  return true;
}

/**
 * 貪婪演算法求解器
 */
export function greedySolver(
  recipe: Recipe,
  crafterStats: CrafterStats,
  options: SolverOptions = {}
): SolverResult {
  return raphaelSolver(recipe, crafterStats, {
    targetQuality: recipe.quality,
    useManipulation: true,
    backloadProgress: false,
  });
}

/**
 * 產生推薦的技能循環
 */
export function generateRecommendedRotation(
  recipe: Recipe,
  crafterStats: CrafterStats
): CraftAction[] {
  const result = raphaelSolver(recipe, crafterStats, {
    targetQuality: recipe.quality,
    useManipulation: true,
  });

  return result.actions;
}

/**
 * 驗證技能序列是否有效
 */
export function validateRotation(
  recipe: Recipe,
  crafterStats: CrafterStats,
  actions: CraftAction[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  let state = createInitialCraftingState(recipe, crafterStats);

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];

    // 檢查等級要求
    if (action.levelRequirement > crafterStats.level) {
      errors.push(`步驟 ${i + 1}: ${action.nameZh} 需要等級 ${action.levelRequirement}`);
    }

    // 檢查 CP
    if (state.cp < action.cpCost) {
      errors.push(`步驟 ${i + 1}: CP 不足 (需要 ${action.cpCost}, 剩餘 ${state.cp})`);
    }

    // 檢查耐久度
    if (state.durability < action.durabilityCost) {
      errors.push(`步驟 ${i + 1}: 耐久度不足`);
    }

    if (state.isComplete) {
      errors.push(`步驟 ${i + 1}: 製作已結束`);
      break;
    }

    state = executeCraftAction(state, action);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
