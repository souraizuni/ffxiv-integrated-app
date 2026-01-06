// ============================================
// WASM 模組 TypeScript 類型定義
// 與 ffxiv-best-craft 專案的 WASM 介面對應
// ============================================

/**
 * 生產者屬性
 */
export interface WasmAttributes {
  level: number;
  craftsmanship: number;
  control: number;
  craft_points: number;
}

/**
 * 配方等級資訊
 * 這個結構包含計算進度/品質所需的所有基礎參數
 */
export interface WasmRecipeLevel {
  id: number;  // RecipeLevelTable ID（必需）
  class_job_level: number;
  stars: number;
  suggested_craftsmanship: number;
  suggested_control: number | null;
  difficulty: number;
  quality: number;
  progress_divider: number;
  quality_divider: number;
  progress_modifier: number;
  quality_modifier: number;
  durability: number;
  conditions_flag: number;
}

/**
 * 配方資料
 * rlv 欄位應該是完整的 RecipeLevel 物件，不是數字！
 */
export interface WasmRecipe {
  rlv: WasmRecipeLevel;
  job_level: number;
  difficulty: number;
  quality: number;
  durability: number;
  conditions_flag: number;
}

/**
 * Buff 狀態
 */
export interface WasmBuffs {
  muscle_memory: number;
  the_creators_name: number;
  inner_quiet: number;
  great_strides: number;
  innovation: number;
  veneration: number;
  waste_not: number;
  manipulation: number;
  heart_and_soul: 'Unused' | 'Active' | 'Used';
  quick_innovation_used: boolean;
  trained_perfection: 'Unused' | 'Active' | 'Used';
  standard_touch_combo: boolean;
  advanced_touch_combo: boolean;
  basic_touch_combo: boolean;
  observed: boolean;
}

/**
 * 生產狀態
 */
export interface WasmStatus {
  attributes: WasmAttributes;
  recipe: WasmRecipe;
  durability: number;
  craft_points: number;
  progress: number;
  quality: number;
  step: number;
  condition: WasmCondition;
  buffs: WasmBuffs;
}

/**
 * 狀態條件
 */
export type WasmCondition =
  | 'Normal'
  | 'Good'
  | 'Excellent'
  | 'Poor'
  | 'Centered'
  | 'Sturdy'
  | 'Pliant'
  | 'Malleable'
  | 'Primed'
  | 'GoodOmen';

/**
 * 技能 ID（與 WASM 相同的命名）
 */
export type WasmAction =
  | 'basic_synthesis'
  | 'basic_touch'
  | 'masters_mend'
  | 'hasty_touch'
  | 'rapid_synthesis'
  | 'observe'
  | 'tricks_of_the_trade'
  | 'waste_not'
  | 'veneration'
  | 'standard_touch'
  | 'great_strides'
  | 'innovation'
  | 'final_appraisal'
  | 'waste_not_ii'
  | 'byregots_blessing'
  | 'precise_touch'
  | 'muscle_memory'
  | 'careful_synthesis'
  | 'manipulation'
  | 'prudent_touch'
  | 'reflect'
  | 'preparatory_touch'
  | 'groundwork'
  | 'delicate_synthesis'
  | 'intensive_synthesis'
  | 'trained_eye'
  | 'advanced_touch'
  | 'prudent_synthesis'
  | 'trained_finesse'
  | 'refined_touch'
  | 'daring_touch'
  | 'immaculate_mend'
  | 'trained_perfection'
  | 'quick_innovation'
  | 'trained_eye'
  | 'heart_and_soul'
  // 失敗版本（用於模擬）
  | 'rapid_synthesis_fail'
  | 'hasty_touch_fail'
  | 'daring_touch_fail';

/**
 * 模擬結果
 */
export interface WasmSimulateResult {
  status: WasmStatus;
  errors: {
    pos: number;
    err: string;
  }[];
}

/**
 * 單步模擬結果
 */
export interface WasmSimulateOneStepResult {
  status: WasmStatus;
  is_success: boolean;
}

/**
 * 隨機模擬統計結果
 */
export interface WasmRandSimulationResult {
  success_rate: number;
  avg_quality: number;
  avg_hq_percent: number;
  median_hq_percent: number;
}

/**
 * 收藏品模擬結果
 */
export interface WasmCollectablesResult {
  success_rate: number;
  tier1_rate: number;
  tier2_rate: number;
  tier3_rate: number;
}

/**
 * 屬性範圍結果
 */
export interface WasmScopeResult {
  craftsmanship_range: [number?, number?];
  control_range: number | null;
  craft_points: number;
}

/**
 * 收藏品等級門檻
 */
export interface WasmCollectablesShopRefine {
  low_collectability: number;
  mid_collectability: number;
  high_collectability: number;
}
