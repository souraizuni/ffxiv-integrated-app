// ============================================
// 生產模擬器 - 最佳化求解器
// 整合 ffxiv-best-craft WASM 模組的高效能求解器
// 同時保留 TypeScript 備用求解器
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
  craftActions,
} from './crafting-engine';

// WASM 模組類型定義
interface WasmSolverModule {
  initWasm: () => Promise<boolean>;
  isWasmReady: () => boolean;
  convertStatsToWasm: (stats: { level: number; craftsmanship: number; control: number; cp: number }) => any;
  convertRecipeToWasm: (
    recipe: {
      recipeLevel: number;
      difficulty: number;
      quality: number;
      durability: number;
      craftTypeLevel?: number;
      stars?: number;
      conditionsFlag?: number;
      progressDivider?: number;
      progressModifier?: number;
      qualityDivider?: number;
      qualityModifier?: number;
      requiredCraftsmanship?: number;
      requiredControl?: number;
    },
    recipeLevel?: {
      baseDifficulty?: number;
      baseQuality?: number;
      baseDurability?: number;
    }
  ) => any;
  newStatus: (attrs: any, recipe: any) => any;
  simulate: (status: any, actions: string[]) => { status: any; errors: any[] };
  highQualityProbability: (status: any) => number | null;
  raphaelSolve: (status: any, targetQuality: number | null, useManipulation: boolean, useHeartAndSoul: boolean, useQuickInnovation: boolean, useTrainedEye: boolean, backloadProgress: boolean, adversarial: boolean) => string[];
  rikaSolve: (status: any) => string[];
  dfsSolve: (status: any, depth: number, specialist: boolean) => string[];
}

// WASM 模組的延遲載入
let wasmSolver: WasmSolverModule | null = null;
let wasmInitPromise: Promise<boolean> | null = null;

/**
 * 初始化 WASM 求解器（僅客戶端）
 */
async function initWasmSolver(): Promise<boolean> {
  // 伺服器端不執行
  if (typeof window === 'undefined') {
    return false;
  }

  // 已經嘗試過初始化
  if (wasmInitPromise) {
    return wasmInitPromise;
  }

  wasmInitPromise = (async () => {
    try {
      // 動態載入 WASM 模組
      const module = await import('@/lib/wasm');
      const success = await module.initWasm();
      if (success) {
        wasmSolver = module as WasmSolverModule;
        console.log('[Solver] WASM 求解器初始化成功');
        return true;
      }
      console.warn('[Solver] WASM 初始化失敗，將使用 TypeScript 備用求解器');
      return false;
    } catch (error) {
      console.warn('[Solver] WASM 載入失敗:', error);
      return false;
    }
  })();

  return wasmInitPromise;
}

/**
 * 檢查 WASM 是否可用
 */
export function isWasmSolverAvailable(): boolean {
  return wasmSolver !== null && wasmSolver.isWasmReady();
}

// ============================================
// 類型定義
// ============================================

export interface SolverResult {
  actions: CraftAction[];
  finalState: CraftingState;
  hqChance: number;
  success: boolean;
  steps: number;
  solverUsed: 'wasm-raphael' | 'wasm-rika' | 'wasm-dfs' | 'typescript';
}

export interface SolverOptions {
  maxSteps?: number;
  targetHQChance?: number;
  prioritizeProgress?: boolean;
  prioritizeQuality?: boolean;
  preferWasm?: boolean;  // 是否優先使用 WASM（預設 true）
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
  preferWasm?: boolean;           // 是否優先使用 WASM
}

// ============================================
// WASM 求解器整合
// ============================================

/**
 * 使用 WASM Raphael 求解器（最佳品質）
 */
async function wasmRaphaelSolve(
  recipe: Recipe,
  crafterStats: CrafterStats,
  options: RaphaelSolverOptions = {}
): Promise<SolverResult | null> {
  if (!wasmSolver || !wasmSolver.isWasmReady()) {
    const success = await initWasmSolver();
    if (!success || !wasmSolver) return null;
  }

  try {
    // 轉換為 WASM 格式，傳遞 RecipeLevelTable 基礎值
    const wasmAttrs = wasmSolver.convertStatsToWasm(crafterStats);
    const wasmRecipe = wasmSolver.convertRecipeToWasm(recipe, {
      baseDifficulty: recipe.baseDifficulty,
      baseQuality: recipe.baseQuality,
      baseDurability: recipe.baseDurability,
    });
    
    // 調試日誌
    console.log('[WASM Debug] Recipe 轉換結果:', {
      'recipe.quality': recipe.quality,
      'recipe.baseQuality': recipe.baseQuality,
      'wasmRecipe.quality': wasmRecipe.quality,
      'wasmRecipe.rlv.quality': wasmRecipe.rlv.quality,
      'wasmRecipe.rlv.quality_divider': wasmRecipe.rlv.quality_divider,
    });
    
    // 建立初始狀態
    const wasmStatus = wasmSolver.newStatus(wasmAttrs, wasmRecipe);
    
    // 檢查是否可以使用 Trained Eye（需要玩家等級比配方等級高 10 級以上）
    // 配方的 recipeLevel 是 ClassJobLevel（如 81 級配方）
    const canUseTrainedEye = crafterStats.level >= recipe.recipeLevel + 10;
    const useTrainedEye = (options.useTrainedEye ?? false) && canUseTrainedEye;
    
    // 求解器選項調試日誌
    const solverParams = {
      targetQuality: options.targetQuality ?? null,
      useManipulation: options.useManipulation ?? true,
      useHeartAndSoul: options.useHeartAndSoul ?? false,
      useQuickInnovation: options.useQuickInnovation ?? false,
      useTrainedEye,
      backloadProgress: options.backloadProgress ?? false,
      adversarial: options.adversarial ?? false,
    };
    
    console.log('[WASM Debug] 求解器參數:', solverParams);
    console.log('[WASM Debug] 製作者屬性:', {
      level: crafterStats.level,
      craftsmanship: crafterStats.craftsmanship,
      control: crafterStats.control,
      cp: crafterStats.cp,
    });
    
    // 執行求解
    const wasmActions = wasmSolver.raphaelSolve(
      wasmStatus,
      solverParams.targetQuality,
      solverParams.useManipulation,
      solverParams.useHeartAndSoul,
      solverParams.useQuickInnovation,
      solverParams.useTrainedEye,
      solverParams.backloadProgress,
      solverParams.adversarial
    );
    
    // 轉換動作序列為本專案格式
    const actions = convertWasmActionsToLocal(wasmActions);
    
    console.log('[WASM Debug] 求解動作序列:', wasmActions);
    
    // 使用 WASM 模擬來獲取正確的最終狀態
    const wasmSimResult = wasmSolver.simulate(wasmStatus, wasmActions);
    const wasmFinalStatus = wasmSimResult.status;
    
    // 使用 WASM 計算 HQ 機率
    const wasmHqProbability = wasmSolver.highQualityProbability(wasmFinalStatus);
    
    console.log('[WASM Debug] WASM 模擬結果:', {
      progress: wasmFinalStatus.progress,
      quality: wasmFinalStatus.quality,
      durability: wasmFinalStatus.durability,
      craft_points: wasmFinalStatus.craft_points,
      hqProbability: wasmHqProbability,
    });
    
    // 將 WASM 結果轉換為本地 CraftingState 格式（用於 UI 顯示）
    const finalState = convertWasmStatusToLocal(wasmFinalStatus, recipe, crafterStats);
    
    // 使用 WASM 的 HQ 機率（如果可用）
    const hqChance = wasmHqProbability !== null ? wasmHqProbability : calculateHQChance(finalState.quality, recipe.quality);
    
    return {
      actions,
      finalState,
      hqChance,
      success: wasmFinalStatus.progress >= recipe.difficulty,
      steps: actions.length,
      solverUsed: 'wasm-raphael',
    };
  } catch (error) {
    console.error('[Solver] WASM Raphael 求解失敗:', error);
    return null;
  }
}

/**
 * 使用 WASM Rika 求解器
 */
async function wasmRikaSolve(
  recipe: Recipe,
  crafterStats: CrafterStats
): Promise<SolverResult | null> {
  if (!wasmSolver || !wasmSolver.isWasmReady()) {
    const success = await initWasmSolver();
    if (!success || !wasmSolver) return null;
  }

  try {
    const wasmAttrs = wasmSolver.convertStatsToWasm(crafterStats);
    const wasmRecipe = wasmSolver.convertRecipeToWasm(recipe, {
      baseDifficulty: recipe.baseDifficulty,
      baseQuality: recipe.baseQuality,
      baseDurability: recipe.baseDurability,
    });
    const wasmStatus = wasmSolver.newStatus(wasmAttrs, wasmRecipe);
    
    const wasmActions = wasmSolver.rikaSolve(wasmStatus);
    const actions = convertWasmActionsToLocal(wasmActions);
    
    // 使用 WASM 模擬來獲取正確的最終狀態
    const wasmSimResult = wasmSolver.simulate(wasmStatus, wasmActions);
    const wasmFinalStatus = wasmSimResult.status;
    const wasmHqProbability = wasmSolver.highQualityProbability(wasmFinalStatus);
    
    // 將 WASM 結果轉換為本地 CraftingState 格式
    const finalState = convertWasmStatusToLocal(wasmFinalStatus, recipe, crafterStats);
    const hqChance = wasmHqProbability !== null ? wasmHqProbability : calculateHQChance(finalState.quality, recipe.quality);
    
    return {
      actions,
      finalState,
      hqChance,
      success: wasmFinalStatus.progress >= recipe.difficulty,
      steps: actions.length,
      solverUsed: 'wasm-rika',
    };
  } catch (error) {
    console.error('[Solver] WASM Rika 求解失敗:', error);
    return null;
  }
}

/**
 * 使用 WASM DFS 求解器
 */
async function wasmDfsSolve(
  recipe: Recipe,
  crafterStats: CrafterStats,
  depth: number = 20,
  specialist: boolean = false
): Promise<SolverResult | null> {
  if (!wasmSolver || !wasmSolver.isWasmReady()) {
    const success = await initWasmSolver();
    if (!success || !wasmSolver) return null;
  }

  try {
    const wasmAttrs = wasmSolver.convertStatsToWasm(crafterStats);
    const wasmRecipe = wasmSolver.convertRecipeToWasm(recipe, {
      baseDifficulty: recipe.baseDifficulty,
      baseQuality: recipe.baseQuality,
      baseDurability: recipe.baseDurability,
    });
    const wasmStatus = wasmSolver.newStatus(wasmAttrs, wasmRecipe);
    
    const wasmActions = wasmSolver.dfsSolve(wasmStatus, depth, specialist);
    const actions = convertWasmActionsToLocal(wasmActions);
    
    // 使用 WASM 模擬來獲取正確的最終狀態
    const wasmSimResult = wasmSolver.simulate(wasmStatus, wasmActions);
    const wasmFinalStatus = wasmSimResult.status;
    const wasmHqProbability = wasmSolver.highQualityProbability(wasmFinalStatus);
    
    // 將 WASM 結果轉換為本地 CraftingState 格式
    const finalState = convertWasmStatusToLocal(wasmFinalStatus, recipe, crafterStats);
    const hqChance = wasmHqProbability !== null ? wasmHqProbability : calculateHQChance(finalState.quality, recipe.quality);
    
    return {
      actions,
      finalState,
      hqChance,
      success: wasmFinalStatus.progress >= recipe.difficulty,
      steps: actions.length,
      solverUsed: 'wasm-dfs',
    };
  } catch (error) {
    console.error('[Solver] WASM DFS 求解失敗:', error);
    return null;
  }
}

/**
 * 將 WASM 動作轉換為本專案的 CraftAction
 */
function convertWasmActionsToLocal(wasmActions: string[]): CraftAction[] {
  return wasmActions
    .map(actionId => craftActions.find(a => a.id === actionId))
    .filter((a): a is CraftAction => a !== undefined);
}

/**
 * 將 WASM Status 轉換為本專案的 CraftingState 格式
 */
function convertWasmStatusToLocal(
  wasmStatus: any,
  recipe: Recipe,
  crafterStats: CrafterStats
): CraftingState {
  const isComplete = wasmStatus.progress >= recipe.difficulty || wasmStatus.durability <= 0;
  const isSuccess = wasmStatus.progress >= recipe.difficulty && wasmStatus.durability >= 0;
  
  return {
    recipe,
    crafterStats,
    progress: wasmStatus.progress,
    quality: wasmStatus.quality,
    durability: wasmStatus.durability,
    cp: wasmStatus.craft_points,
    step: wasmStatus.step || 0,
    condition: 'Normal',
    buffs: [], // WASM 不返回完整的 buff 狀態，使用空陣列
    actions: [], // 動作序列由外部處理
    isComplete,
    isSuccess,
    isHQ: wasmStatus.quality >= recipe.quality,
  };
}

/**
 * 使用本地引擎模擬
 */
function simulateWithLocalEngine(
  recipe: Recipe,
  crafterStats: CrafterStats,
  actions: CraftAction[]
): CraftingState {
  let state = createInitialCraftingStateDeterministic(recipe, crafterStats);
  for (const action of actions) {
    if (state.isComplete) break;
    state = executeCraftActionDeterministic(state, action);
  }
  return state;
}

// ============================================
// 主要求解器 API
// ============================================

/**
 * Raphael 風格求解器（自動選擇 WASM 或 TypeScript）
 */
export async function raphaelSolver(
  recipe: Recipe,
  crafterStats: CrafterStats,
  options: RaphaelSolverOptions = {}
): Promise<SolverResult> {
  const { preferWasm = true } = options;
  
  // 嘗試使用 WASM 求解器
  if (preferWasm && typeof window !== 'undefined') {
    const wasmResult = await wasmRaphaelSolve(recipe, crafterStats, options);
    if (wasmResult) {
      return wasmResult;
    }
  }
  
  // 回退到 TypeScript 求解器
  return typescriptSolver(recipe, crafterStats, options);
}

/**
 * 同步版本的 TypeScript 求解器（用於回退）
 */
export function raphaelSolverSync(
  recipe: Recipe,
  crafterStats: CrafterStats,
  options: RaphaelSolverOptions = {}
): SolverResult {
  return typescriptSolver(recipe, crafterStats, options);
}

/**
 * TypeScript 備用求解器
 */
function typescriptSolver(
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
    if (action.id === 'intensive_synthesis') return false;
    if (action.id === 'precise_touch') return false;
    if (action.id === 'rapid_synthesis') return false;
    if (action.id === 'hasty_touch') return false;
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

  return {
    ...result,
    solverUsed: 'typescript',
  };
}

// ============================================
// TypeScript 求解器輔助函數
// ============================================

function selectOpenerStrategy(
  recipe: Recipe,
  crafterStats: CrafterStats,
  actions: CraftAction[]
): 'reflect' | 'muscle_memory' | 'standard' {
  const hasReflect = actions.some(a => a.id === 'reflect');
  const hasMuscleMemory = actions.some(a => a.id === 'muscle_memory');
  
  if (recipe.quality === 0 && hasMuscleMemory) {
    return 'muscle_memory';
  }
  
  if (hasReflect && crafterStats.level >= 69) {
    const progressRatio = recipe.difficulty / (recipe.quality || 1);
    if (progressRatio > 3 && hasMuscleMemory) {
      return 'muscle_memory';
    }
    return 'reflect';
  }
  
  if (hasMuscleMemory && crafterStats.level >= 54) {
    return 'muscle_memory';
  }
  
  return 'standard';
}

function phasedSolver(
  recipe: Recipe,
  crafterStats: CrafterStats,
  actions: CraftAction[],
  targetQuality: number,
  backloadProgress: boolean,
  openerStrategy: 'reflect' | 'muscle_memory' | 'standard' = 'reflect'
): Omit<SolverResult, 'solverUsed'> {
  let state = createInitialCraftingStateDeterministic(recipe, crafterStats);
  const selectedActions: CraftAction[] = [];
  const maxSteps = 35;
  
  // 階段 1: 開場
  const opener = selectOpener(state, actions, openerStrategy);
  if (opener) {
    state = executeCraftActionDeterministic(state, opener);
    selectedActions.push(opener);
  }
  
  // 階段 2: 品質提升
  while (!state.isComplete && selectedActions.length < maxSteps) {
    const finishResources = estimateFinishResources(state, actions);
    const canFinish = canFinishCraft(state, actions);
    const qualityPercent = state.quality / recipe.quality;
    const targetPercent = targetQuality / recipe.quality;
    
    if (qualityPercent >= targetPercent && canFinish) break;
    
    const reservedCp = finishResources.cp + 30;
    const reservedDurability = finishResources.durability;
    
    if (state.cp <= reservedCp || state.durability <= reservedDurability) break;
    if (mustFinish(state, actions)) break;
    
    const nextAction = selectNextAction(state, actions, targetQuality, backloadProgress);
    if (!nextAction) break;
    
    state = executeCraftActionDeterministic(state, nextAction);
    selectedActions.push(nextAction);
  }
  
  // 階段 3: 完成
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

function selectOpener(
  state: CraftingState,
  actions: CraftAction[],
  strategy: 'reflect' | 'muscle_memory' | 'standard'
): CraftAction | null {
  if (strategy === 'reflect') {
    const reflect = actions.find(a => a.id === 'reflect');
    if (reflect && isActionUsable(state, reflect)) return reflect;
  }
  
  if (strategy === 'muscle_memory' || strategy === 'reflect') {
    const muscleMemory = actions.find(a => a.id === 'muscle_memory');
    if (muscleMemory && isActionUsable(state, muscleMemory)) return muscleMemory;
  }
  
  return null;
}

function estimateFinishResources(state: CraftingState, actions: CraftAction[]): { cp: number; durability: number; steps: number } {
  const progressNeeded = state.recipe.difficulty - state.progress;
  if (progressNeeded <= 0) return { cp: 0, durability: 0, steps: 0 };
  
  let cpUsed = 0;
  let durabilityUsed = 0;
  let stepsUsed = 0;
  
  const groundwork = actions.find(a => a.id === 'groundwork');
  const carefulSynthesis = actions.find(a => a.id === 'careful_synthesis');
  const basicSynthesis = actions.find(a => a.id === 'basic_synthesis');
  const veneration = actions.find(a => a.id === 'veneration');
  
  const hasVeneration = state.buffs.some(b => b.name === 'Veneration' && b.duration > 0);
  if (!hasVeneration && progressNeeded > 1500 && veneration) {
    cpUsed += veneration.cpCost;
    stepsUsed++;
  }
  
  const progressPerGroundwork = hasVeneration || progressNeeded > 1500 ? 1200 : 800;
  let actionsNeeded = Math.ceil(progressNeeded / progressPerGroundwork);
  
  if (groundwork) {
    cpUsed += groundwork.cpCost * actionsNeeded;
    durabilityUsed += 20 * actionsNeeded;
    stepsUsed += actionsNeeded;
  } else if (carefulSynthesis) {
    actionsNeeded = Math.ceil(progressNeeded / 450);
    cpUsed += carefulSynthesis.cpCost * actionsNeeded;
    durabilityUsed += 10 * actionsNeeded;
    stepsUsed += actionsNeeded;
  } else if (basicSynthesis) {
    actionsNeeded = Math.ceil(progressNeeded / 300);
    cpUsed += basicSynthesis.cpCost * actionsNeeded;
    durabilityUsed += 10 * actionsNeeded;
    stepsUsed += actionsNeeded;
  }
  
  const innerQuiet = state.buffs.find(b => b.name === 'InnerQuiet');
  if (innerQuiet && (innerQuiet.stacks || 0) > 0) {
    cpUsed += 24;
    durabilityUsed += 10;
    stepsUsed++;
    if ((innerQuiet.stacks || 0) >= 3) {
      cpUsed += 18;
      stepsUsed++;
    }
  }
  
  return { cp: cpUsed, durability: Math.min(durabilityUsed, 50), steps: stepsUsed };
}

function canFinishCraft(state: CraftingState, actions: CraftAction[]): boolean {
  const progressActions = actions.filter(a => a.category === 'progress' && isActionUsable(state, a));
  
  for (const action of progressActions) {
    const newState = executeCraftActionDeterministic(state, action);
    if (newState.progress >= state.recipe.difficulty) return true;
  }
  
  const veneration = actions.find(a => a.id === 'veneration');
  if (veneration && isActionUsable(state, veneration)) {
    const stateWithVen = executeCraftActionDeterministic(state, veneration);
    for (const action of progressActions) {
      if (!isActionUsable(stateWithVen, action)) continue;
      const newState = executeCraftActionDeterministic(stateWithVen, action);
      if (newState.progress >= state.recipe.difficulty) return true;
    }
  }
  
  return false;
}

function mustFinish(state: CraftingState, actions: CraftAction[]): boolean {
  return state.cp < 40 || state.durability <= 10;
}

function selectNextAction(
  state: CraftingState,
  actions: CraftAction[],
  targetQuality: number,
  backloadProgress: boolean
): CraftAction | null {
  const candidates: { action: CraftAction; score: number }[] = [];
  
  for (const action of actions) {
    if (!isActionUsable(state, action)) continue;
    const score = calculateActionPriority(state, action, targetQuality, backloadProgress);
    if (score > 0) candidates.push({ action, score });
  }
  
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].action;
}

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
  
  const innerQuiet = state.buffs.find(b => b.name === 'InnerQuiet');
  const iqStacks = innerQuiet?.stacks || 0;
  
  const hasInnovation = state.buffs.some(b => b.name === 'Innovation' && b.duration > 0);
  const hasGreatStrides = state.buffs.some(b => b.name === 'GreatStrides' && b.duration > 0);
  const hasWasteNot = state.buffs.some(b => (b.name === 'WasteNot' || b.name === 'WasteNot2') && b.duration > 0);
  const hasManipulation = state.buffs.some(b => b.name === 'Manipulation' && b.duration > 0);
  const hasMuscleMemory = state.buffs.some(b => b.name === 'MuscleMemory' && b.duration > 0);
  
  switch (action.id) {
    case 'innovation':
      if (iqStacks >= 2 && !hasInnovation && qualityPercent < targetPercent) score = 150;
      break;
    case 'great_strides':
      if (iqStacks >= 8 && hasInnovation && !hasGreatStrides && qualityPercent < targetPercent) score = 160;
      break;
    case 'veneration':
      if (hasMuscleMemory || backloadProgress) score = 120;
      break;
    case 'manipulation':
      if (durabilityPercent < 0.7 && !hasManipulation && cpPercent > 0.3) score = 130;
      break;
    case 'waste_not':
      if (!hasWasteNot && durabilityPercent > 0.4 && qualityPercent < targetPercent) score = 90;
      break;
    case 'waste_not_2':
      if (!hasWasteNot && !hasManipulation && durabilityPercent > 0.5 && qualityPercent < targetPercent * 0.7) score = 140;
      break;
    case 'byregots_blessing':
      if (iqStacks >= 8 && hasInnovation && hasGreatStrides) score = 200;
      else if (iqStacks >= 10 && hasInnovation) score = 180;
      else if (iqStacks >= 10 && qualityPercent < targetPercent) score = 160;
      break;
    case 'basic_touch':
      if (iqStacks < 10 && qualityPercent < targetPercent) score = hasInnovation ? 100 : 70;
      break;
    case 'standard_touch':
      if (iqStacks < 10 && qualityPercent < targetPercent) score = hasInnovation ? 105 : 75;
      break;
    case 'advanced_touch':
      if (iqStacks < 10 && qualityPercent < targetPercent) score = hasInnovation ? 110 : 80;
      break;
    case 'prudent_touch':
      if (iqStacks < 10 && qualityPercent < targetPercent) {
        score = hasInnovation ? 95 : 65;
        if (durabilityPercent < 0.4) score += 20;
      }
      break;
    case 'preparatory_touch':
      if (iqStacks < 8 && qualityPercent < targetPercent && durabilityPercent > 0.4) score = hasInnovation ? 115 : 85;
      break;
    case 'trained_finesse':
      if (iqStacks === 10 && qualityPercent < targetPercent) score = hasInnovation ? 140 : 90;
      break;
    case 'groundwork':
      if (hasMuscleMemory || backloadProgress) score = 100;
      else if (qualityPercent >= targetPercent) score = 120;
      break;
    case 'careful_synthesis':
      if (hasMuscleMemory) score = 90;
      else if (qualityPercent >= targetPercent) score = 100;
      break;
    case 'basic_synthesis':
      if (qualityPercent >= targetPercent) score = 80;
      break;
    case 'masters_mend':
      if (durabilityPercent < 0.3 && !hasManipulation) score = 110;
      break;
  }
  
  if (action.cpCost > 0 && cpPercent < 0.3) score *= 0.8;
  return score;
}

function selectFinishActions(state: CraftingState, actions: CraftAction[]): CraftAction[] {
  const result: CraftAction[] = [];
  let currentState = state;
  const maxFinishSteps = 15;
  
  const progressNeeded = currentState.recipe.difficulty - currentState.progress;
  const estimatedDurabilityNeeded = Math.ceil(progressNeeded / 800) * 20 + 20;
  
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
  
  const innerQuiet = currentState.buffs.find(b => b.name === 'InnerQuiet');
  const iqStacks = innerQuiet?.stacks || 0;
  
  if (iqStacks > 0 && currentState.durability >= 10) {
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
  
  if (progressNeeded > 0 && !currentState.isComplete) {
    const veneration = actions.find(a => a.id === 'veneration');
    const hasVeneration = currentState.buffs.some(b => b.name === 'Veneration' && b.duration > 0);
    if (!hasVeneration && veneration && isActionUsable(currentState, veneration)) {
      const remainingProgress = currentState.recipe.difficulty - currentState.progress;
      if (remainingProgress > 300) {
        result.push(veneration);
        currentState = executeCraftActionDeterministic(currentState, veneration);
      }
    }
    
    while (!currentState.isComplete && result.length < maxFinishSteps) {
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
          if (a.canComplete && !b.canComplete) return -1;
          if (b.canComplete && !a.canComplete) return 1;
          return b.progressGain - a.progressGain;
        });
      
      if (progressActions.length === 0) break;
      
      const best = progressActions[0];
      result.push(best.action);
      currentState = executeCraftActionDeterministic(currentState, best.action);
    }
  }
  
  if (!currentState.isComplete && currentState.progress > 0) {
    const remainingProgress = currentState.recipe.difficulty - currentState.progress;
    if (remainingProgress > 0 && remainingProgress < 200) {
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

function isActionUsable(state: CraftingState, action: CraftAction): boolean {
  if (state.isComplete) return false;
  if (state.cp < action.cpCost) return false;
  if (action.durabilityCost > 0 && state.durability <= 0) return false;
  
  const hasWasteNot = state.buffs.some(b => (b.name === 'WasteNot' || b.name === 'WasteNot2') && b.duration > 0);
  
  if ((action.id === 'prudent_synthesis' || action.id === 'prudent_touch') && hasWasteNot) {
    return false;
  }
  
  if (action.id === 'trained_finesse') {
    const innerQuiet = state.buffs.find(b => b.name === 'InnerQuiet');
    if (!innerQuiet || (innerQuiet.stacks || 0) < 10) return false;
  }
  
  if ((action.id === 'muscle_memory' || action.id === 'reflect') && state.step > 0) {
    return false;
  }
  
  if (action.id === 'byregots_blessing') {
    const innerQuiet = state.buffs.find(b => b.name === 'InnerQuiet');
    if (!innerQuiet || (innerQuiet.stacks || 0) < 1) return false;
  }
  
  return true;
}

// ============================================
// 公開 API
// ============================================

/**
 * 貪婪演算法求解器
 */
export async function greedySolver(
  recipe: Recipe,
  crafterStats: CrafterStats,
  options: SolverOptions = {}
): Promise<SolverResult> {
  return raphaelSolver(recipe, crafterStats, {
    targetQuality: recipe.quality,
    useManipulation: true,
    backloadProgress: false,
    preferWasm: options.preferWasm ?? true,
  });
}

/**
 * 產生推薦的技能循環
 */
export async function generateRecommendedRotation(
  recipe: Recipe,
  crafterStats: CrafterStats
): Promise<CraftAction[]> {
  const result = await raphaelSolver(recipe, crafterStats, {
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

    if (action.levelRequirement > crafterStats.level) {
      errors.push(`步驟 ${i + 1}: ${action.nameZh} 需要等級 ${action.levelRequirement}`);
    }

    if (state.cp < action.cpCost) {
      errors.push(`步驟 ${i + 1}: CP 不足 (需要 ${action.cpCost}, 剩餘 ${state.cp})`);
    }

    if (state.durability < action.durabilityCost) {
      errors.push(`步驟 ${i + 1}: 耐久度不足`);
    }

    if (state.isComplete) {
      errors.push(`步驟 ${i + 1}: 製作已結束`);
      break;
    }

    state = executeCraftAction(state, action);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 初始化求解器（預載 WASM）
 */
export async function initSolver(): Promise<boolean> {
  return initWasmSolver();
}

// wasmRaphaelSolve, wasmRikaSolve, wasmDfsSolve 已在上面定義並匯出
