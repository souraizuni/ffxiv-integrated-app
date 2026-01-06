// ============================================
// WASM 求解器整合層
// 提供與 ffxiv-best-craft WASM 模組的 TypeScript 介面
// ============================================

import type {
  WasmAttributes,
  WasmRecipe,
  WasmRecipeLevel,
  WasmStatus,
  WasmAction,
  WasmSimulateResult,
  WasmSimulateOneStepResult,
  WasmRandSimulationResult,
  WasmScopeResult,
  WasmCollectablesShopRefine,
} from './wasm-types';

// WASM 模組狀態
let wasmModule: any = null;
let wasmInitPromise: Promise<any> | null = null;
let isInitialized = false;

/**
 * 初始化 WASM 模組
 * 僅在客戶端可用
 */
export async function initWasm(): Promise<boolean> {
  // 伺服器端不執行
  if (typeof window === 'undefined') {
    console.warn('[WasmSolver] WASM 僅支援客戶端執行');
    return false;
  }

  // 已初始化
  if (isInitialized && wasmModule) {
    return true;
  }

  // 正在初始化中
  if (wasmInitPromise) {
    await wasmInitPromise;
    return isInitialized;
  }

  // 開始初始化
  wasmInitPromise = (async () => {
    try {
      // 動態載入 WASM 模組
      const module = await import('./app_wasm.js');
      
      // 從 public 目錄載入 WASM 二進位檔案
      // GitHub Pages 部署時 basePath 會是 /ffxiv-integrated-app
      const basePath = typeof window !== 'undefined' 
        ? (window as any).__NEXT_DATA__?.basePath || ''
        : '';
      const wasmUrl = `${basePath}/wasm/app_wasm_bg.wasm`;
      
      // 初始化
      await module.default(wasmUrl);
      wasmModule = module;
      isInitialized = true;
      
      console.log('[WasmSolver] WASM 模組初始化成功');
      return true;
    } catch (error) {
      console.error('[WasmSolver] WASM 初始化失敗:', error);
      isInitialized = false;
      return false;
    }
  })();

  return wasmInitPromise;
}

/**
 * 檢查 WASM 是否已初始化
 */
export function isWasmReady(): boolean {
  return isInitialized && wasmModule !== null;
}

/**
 * 取得 WASM 模組（需先初始化）
 */
function getWasm() {
  if (!isInitialized || !wasmModule) {
    throw new Error('WASM 模組尚未初始化，請先呼叫 initWasm()');
  }
  return wasmModule;
}

// ============================================
// 基礎 API
// ============================================

/**
 * 建立新的生產狀態
 */
export function newStatus(attrs: WasmAttributes, recipe: WasmRecipe): WasmStatus {
  return getWasm().new_status(attrs, recipe);
}

/**
 * 模擬技能序列
 */
export function simulate(status: WasmStatus, actions: WasmAction[]): WasmSimulateResult {
  return getWasm().simulate(status, actions);
}

/**
 * 模擬技能序列（詳細版本）
 */
export function simulateDetail(status: WasmStatus, actions: WasmAction[]): any {
  return getWasm().simulate_detail(status, actions);
}

/**
 * 模擬單步驟
 */
export function simulateOneStep(
  status: WasmStatus,
  action: WasmAction,
  forceSuccess: boolean = false
): WasmSimulateOneStepResult {
  return getWasm().simulate_one_step(status, action, forceSuccess);
}

/**
 * 取得可用技能列表
 */
export function allowedList(status: WasmStatus, skills: WasmAction[]): string[] {
  return getWasm().allowed_list(status, skills);
}

/**
 * 取得技能 CP 消耗列表
 */
export function craftpointsList(status: WasmStatus, skills: WasmAction[]): number[] {
  return getWasm().craftpoints_list(status, skills);
}

/**
 * 計算 HQ 機率
 */
export function highQualityProbability(status: WasmStatus): number | null {
  return getWasm().high_quality_probability(status);
}

// ============================================
// 隨機模擬 API
// ============================================

/**
 * 隨機模擬（用於評估技能序列的穩定性）
 */
export function randSimulation(
  status: WasmStatus,
  actions: WasmAction[],
  n: number = 1000,
  ignoreErrors: boolean = true
): WasmRandSimulationResult {
  return getWasm().rand_simulation(status, actions, n, ignoreErrors);
}

/**
 * 收藏品隨機模擬
 */
export function randCollectablesSimulation(
  status: WasmStatus,
  actions: WasmAction[],
  n: number,
  ignoreErrors: boolean,
  collectablesShopRefine: WasmCollectablesShopRefine
): any {
  return getWasm().rand_collectables_simulation(
    status,
    actions,
    n,
    ignoreErrors,
    collectablesShopRefine
  );
}

// ============================================
// 分析 API
// ============================================

/**
 * 計算屬性範圍
 * 分析技能序列需要的最低屬性
 */
export function calcAttributesScope(
  status: WasmStatus,
  actions: WasmAction[]
): WasmScopeResult {
  return getWasm().calc_attributes_scope(status, actions);
}

// ============================================
// 求解器 API
// ============================================

/**
 * Raphael 求解器（品質最高、速度最快）
 * 使用分支定界 + 動態規劃演算法
 */
export function raphaelSolve(
  status: WasmStatus,
  targetQuality: number | null = null,
  useManipulation: boolean = true,
  useHeartAndSoul: boolean = false,
  useQuickInnovation: boolean = false,
  useTrainedEye: boolean = false,
  backloadProgress: boolean = false,
  adversarial: boolean = false
): WasmAction[] {
  return getWasm().raphael_solve(
    status,
    targetQuality,
    useManipulation,
    useHeartAndSoul,
    useQuickInnovation,
    useTrainedEye,
    backloadProgress,
    adversarial
  );
}

/**
 * Rika 求解器（傳統演算法）
 */
export function rikaSolve(status: WasmStatus): WasmAction[] {
  return getWasm().rika_solve(status);
}

/**
 * DFS 深度優先搜尋求解器
 */
export function dfsSolve(
  status: WasmStatus,
  depth: number = 20,
  specialist: boolean = false
): WasmAction[] {
  return getWasm().dfs_solve(status, depth, specialist);
}

/**
 * NQ 求解器（不追求品質，快速完成）
 */
export function nqSolve(
  status: WasmStatus,
  depth: number = 20,
  specialist: boolean = false
): WasmAction[] {
  return getWasm().nq_solve(status, depth, specialist);
}

/**
 * Reflect 求解器（使用閒靜開場）
 */
export function reflectSolve(
  status: WasmStatus,
  useObserve: boolean = true
): WasmAction[] {
  return getWasm().reflect_solve(status, useObserve);
}

// ============================================
// 工具函數
// ============================================

/**
 * 將本專案的 Recipe 轉換為 WASM Recipe 格式
 * 
 * 重要：WASM 的 Recipe 結構中：
 * - rlv (RecipeLevel): 包含基礎配方等級表的數據（progress_divider, quality_divider 等）
 *   - rlv.difficulty, rlv.quality, rlv.durability 是 RecipeLevelTable 的**基礎值**
 * - difficulty, quality, durability: 是經過 factor 計算後的**實際配方值**
 * 
 * 計算公式：
 * - 實際難度 = Math.floor(基礎難度 * difficultyFactor / 100)
 * - 實際品質 = Math.floor(基礎品質 * qualityFactor / 100)  
 * - 實際耐久 = Math.floor(基礎耐久 * durabilityFactor / 100)
 * 
 * @param recipe - 本專案的 Recipe 物件
 * @param recipeLevel - 可選的 RecipeLevelTable 資料（如果提供，會使用這些作為 rlv 的基礎值）
 */
export function convertRecipeToWasm(
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
    recipeLevelId?: number;
  },
  recipeLevel?: {
    baseDifficulty?: number;
    baseQuality?: number;
    baseDurability?: number;
  }
): WasmRecipe {
  // 如果提供了 recipeLevel 基礎值，使用它們
  // 否則使用實際值作為基礎值（這可能導致計算錯誤，因為進度/品質計算依賴基礎值）
  const baseDifficulty = recipeLevel?.baseDifficulty ?? recipe.difficulty;
  const baseQuality = recipeLevel?.baseQuality ?? recipe.quality;
  const baseDurability = recipeLevel?.baseDurability ?? recipe.durability;

  // 建構完整的 RecipeLevel 物件
  const rlv: WasmRecipeLevel = {
    // RecipeLevelTable ID（WASM 必需）
    id: recipe.recipeLevelId || recipe.recipeLevel,
    class_job_level: recipe.craftTypeLevel || recipe.recipeLevel,
    stars: recipe.stars || 0,
    suggested_craftsmanship: recipe.requiredCraftsmanship || 0,
    suggested_control: recipe.requiredControl || null,
    // 這些是 RecipeLevelTable 的基礎值
    difficulty: baseDifficulty,
    quality: baseQuality,
    durability: baseDurability,
    // 這些是計算進度/品質的關鍵參數
    progress_divider: recipe.progressDivider || 100,
    quality_divider: recipe.qualityDivider || 100,
    progress_modifier: recipe.progressModifier || 100,
    quality_modifier: recipe.qualityModifier || 100,
    conditions_flag: recipe.conditionsFlag || 15,
  };

  return {
    rlv,
    job_level: recipe.craftTypeLevel || recipe.recipeLevel,
    // 這些是經過 factor 計算後的實際配方值
    difficulty: recipe.difficulty,
    quality: recipe.quality,
    durability: recipe.durability,
    conditions_flag: recipe.conditionsFlag || 15,
  };
}

/**
 * 將本專案的 CrafterStats 轉換為 WASM Attributes 格式
 */
export function convertStatsToWasm(stats: {
  level: number;
  craftsmanship: number;
  control: number;
  cp: number;
}): WasmAttributes {
  return {
    level: stats.level,
    craftsmanship: stats.craftsmanship,
    control: stats.control,
    craft_points: stats.cp,
  };
}

/**
 * 將 WASM Action 轉換為本專案的 action ID
 * 兩者使用相同的命名規則，所以直接返回
 */
export function convertWasmActionToLocal(action: WasmAction): string {
  return action;
}

/**
 * 將本專案的 action ID 轉換為 WASM Action
 */
export function convertLocalActionToWasm(actionId: string): WasmAction {
  return actionId as WasmAction;
}

// 重新匯出類型
export type {
  WasmAttributes,
  WasmRecipe,
  WasmStatus,
  WasmAction,
  WasmSimulateResult,
  WasmSimulateOneStepResult,
  WasmRandSimulationResult,
  WasmScopeResult,
  WasmCollectablesShopRefine,
} from './wasm-types';
