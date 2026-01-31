'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie';
import type {
  CraftingState,
  CraftAction,
  Recipe,
  CrafterStats,
} from '@/types';
import {
  createInitialCraftingState,
  executeCraftAction,
  getAvailableActions,
  calculateHQChance,
} from '@/lib/simulator';
import { raphaelSolver, type RaphaelSolverOptions, type SolverResult } from '@/lib/simulator/solver';
import { CraftingAnalyzer } from './crafting-analyzer';
import { MacroExporter } from './macro-exporter';
import { SolverSettingsDialog } from './solver-settings-dialog';
import { MEALS, MEDICINES, SOUL_OF_THE_CRAFTER, calculateEnhancedAttributes, getEnhancerEffectText, getEnhancerDisplayName, type Enhancer } from '@/data/enhancers';

// Cookie 鍵名
const SOLVER_OPTIONS_COOKIE_KEY = 'ffxiv-solver-options';

// 預設求解器選項（全部關閉）
const DEFAULT_SOLVER_OPTIONS: Omit<RaphaelSolverOptions, 'targetQuality'> = {
  useManipulation: false,
  useHeartAndSoul: false,
  useQuickInnovation: false,
  useTrainedEye: false,
  backloadProgress: false,
  adversarial: false,
};

// 從 cookie 讀取求解器選項
function loadSolverOptionsFromCookie(): Partial<RaphaelSolverOptions> {
  try {
    const saved = Cookies.get(SOLVER_OPTIONS_COOKIE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to parse solver options from cookie:', e);
  }
  return {};
}

// 儲存求解器選項到 cookie
function saveSolverOptionsToCookie(options: RaphaelSolverOptions) {
  // 只儲存非 targetQuality 的選項
  const { targetQuality, ...optionsToSave } = options;
  Cookies.set(SOLVER_OPTIONS_COOKIE_KEY, JSON.stringify(optionsToSave), { expires: 365 });
}

interface CraftingSimulatorProps {
  recipe: Recipe;
  crafterStats: CrafterStats;
  onClose?: () => void;
}

export function CraftingSimulator({
  recipe,
  crafterStats,
  onClose,
}: CraftingSimulatorProps) {
  const [state, setState] = useState<CraftingState>(() =>
    createInitialCraftingState(recipe, crafterStats)
  );
  const [selectedActions, setSelectedActions] = useState<CraftAction[]>([]);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [activeTab, setActiveTab] = useState<'simulator' | 'analyzer' | 'solver'>('solver');
  
  // 求解器選項（從 cookie 讀取，合併預設值）
  const [solverOptions, setSolverOptions] = useState<RaphaelSolverOptions>(() => {
    const savedOptions = loadSolverOptionsFromCookie();
    return {
      targetQuality: recipe.quality,
      ...DEFAULT_SOLVER_OPTIONS,
      ...savedOptions,
    };
  });
  const [isSolving, setIsSolving] = useState(false);
  const [solverResult, setSolverResult] = useState<SolverResult | null>(null);
  const [showMacroExport, setShowMacroExport] = useState(false);
  const [showSolverSettings, setShowSolverSettings] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  
  // 食物和藥水設定
  const [selectedMeal, setSelectedMeal] = useState<Enhancer | null>(null);
  const [selectedMedicine, setSelectedMedicine] = useState<Enhancer | null>(null);
  const [useSoulOfCrafter, setUseSoulOfCrafter] = useState(false);
  
  // 從進階設定彈窗返回的製作者數值（覆蓋原有設定）
  const [advancedCrafterStats, setAdvancedCrafterStats] = useState<CrafterStats | null>(null);
  
  // 計算增強後的屬性
  const enhancedStats = useMemo(() => {
    const enhancers: Enhancer[] = [];
    if (selectedMeal) enhancers.push(selectedMeal);
    if (selectedMedicine) enhancers.push(selectedMedicine);
    if (useSoulOfCrafter) enhancers.push(SOUL_OF_THE_CRAFTER);
    
    if (enhancers.length === 0) return null;
    
    return calculateEnhancedAttributes(
      {
        craftsmanship: crafterStats.craftsmanship,
        control: crafterStats.control,
        cp: crafterStats.cp,
        level: crafterStats.level,
      },
      enhancers
    );
  }, [crafterStats, selectedMeal, selectedMedicine, useSoulOfCrafter]);
  
  // 用於求解的實際屬性（優先使用進階設定，否則用食物/藥水加成）
  const effectiveStats: CrafterStats = useMemo(() => {
    // 如果有進階設定的製作者數值，優先使用
    if (advancedCrafterStats) {
      return advancedCrafterStats;
    }
    // 否則使用基礎屬性 + 食物/藥水加成
    if (!enhancedStats) return crafterStats;
    return {
      ...crafterStats,
      craftsmanship: enhancedStats.craftsmanship,
      control: enhancedStats.control,
      cp: enhancedStats.cp,
    };
  }, [crafterStats, enhancedStats, advancedCrafterStats]);
  
  // 當選項改變時儲存到 cookie
  useEffect(() => {
    saveSolverOptionsToCookie(solverOptions);
  }, [solverOptions]);

  // 當 recipe 改變時重置
  useEffect(() => {
    setState(createInitialCraftingState(recipe, crafterStats));
    setSelectedActions([]);
    setSolverResult(null);
    
    // 自動設定目標品質
    // 收藏品配方：預設目標為特選（最高）門檻
    // 一般配方：預設目標為最大品質
    const defaultTargetQuality = recipe.isCollectable && recipe.collectability
      ? recipe.collectability.high * 10  // 特選門檻 * 10 = 品質值
      : recipe.quality;
    
    setSolverOptions(prev => ({
      ...prev,
      targetQuality: defaultTargetQuality,
    }));
  }, [recipe, crafterStats]);

  const availableActions = useMemo(
    () => getAvailableActions(showAllSkills ? 100 : crafterStats.level),
    [crafterStats.level, showAllSkills]
  );

  const hqChance = useMemo(
    () => calculateHQChance(state.quality, recipe.quality),
    [state.quality, recipe.quality]
  );

  // 取得內靜層數
  const innerQuietStacks = useMemo(() => {
    const buff = state.buffs.find(b => b.name === 'InnerQuiet');
    return buff?.stacks || 0;
  }, [state.buffs]);

  // 執行技能
  const handleAction = (action: CraftAction) => {
    if (state.isComplete) return;
    
    const newState = executeCraftAction(state, action);
    setState(newState);
    setSelectedActions([...selectedActions, action]);
  };

  // 重置
  const handleReset = () => {
    setState(createInitialCraftingState(recipe, crafterStats));
    setSelectedActions([]);
    setSolverResult(null);
  };

  // 撤銷最後一步
  const handleUndo = () => {
    if (selectedActions.length === 0) return;
    
    // 重新模擬到前一步
    let newState = createInitialCraftingState(recipe, crafterStats);
    const newActions = selectedActions.slice(0, -1);
    
    for (const action of newActions) {
      newState = executeCraftAction(newState, action);
    }
    
    setState(newState);
    setSelectedActions(newActions);
  };

  // 匯出技能序列
  const handleExport = () => {
    const macroLines = selectedActions.map(action => `/ac "${action.name}"`);
    const macro = macroLines.join('\n');
    navigator.clipboard.writeText(macro);
    alert('技能宏已複製到剪貼簿！');
  };
  
  // 執行求解器
  const handleSolve = useCallback(async () => {
    setIsSolving(true);
    setSolverResult(null);
    
    // 調試日誌：顯示傳入的配方資訊
    console.log('[CraftingSimulator] handleSolve - Recipe:', {
      recipeLevel: recipe.recipeLevel,
      difficulty: recipe.difficulty,
      baseDifficulty: recipe.baseDifficulty,
      quality: recipe.quality,
      baseQuality: recipe.baseQuality,
      qualityDivider: recipe.qualityDivider,
      progressDivider: recipe.progressDivider,
      recipeLevelId: recipe.recipeLevelId,
    });
    
    // 調試日誌：顯示使用的屬性（包含食物/藥水加成）
    console.log('[CraftingSimulator] handleSolve - Stats:', {
      base: crafterStats,
      effective: effectiveStats,
      meal: selectedMeal ? getEnhancerDisplayName(selectedMeal) : undefined,
      medicine: selectedMedicine ? getEnhancerDisplayName(selectedMedicine) : undefined,
    });
    
    // 驗證 baseQuality 是否來自正確的 RecipeLevelTable
    // Lv85 應該是 baseQuality=6700, qualityDivider=109
    // 如果 baseQuality 等於 quality，表示 RecipeLevelTable 可能未正確載入
    if (recipe.baseQuality === recipe.quality && recipe.baseQuality !== undefined) {
      console.warn('[CraftingSimulator] 警告：baseQuality 等於 quality，RecipeLevelTable 可能未正確載入');
    }
    
    // 確保載入動畫至少顯示 300ms（避免閃爍）
    const startTime = Date.now();
    const MIN_LOADING_TIME = 300;
    
    try {
      // raphaelSolver 現在是非同步的，支援 WASM 後端
      // 使用 effectiveStats 包含食物/藥水加成
      const result = await raphaelSolver(recipe, effectiveStats, solverOptions);
      
      // 確保載入動畫顯示足夠時間
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_LOADING_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed));
      }
      
      setSolverResult(result);
    } catch (error) {
      console.error('Solver error:', error);
      alert('求解失敗，請嘗試調整參數');
    } finally {
      setIsSolving(false);
    }
  }, [recipe, effectiveStats, solverOptions, crafterStats, selectedMeal, selectedMedicine]);
  
  // 應用求解結果
  const handleApplySolverResult = useCallback(() => {
    if (!solverResult) return;
    
    setState(solverResult.finalState);
    setSelectedActions(solverResult.actions);
    setActiveTab('simulator');
  }, [solverResult]);

  return (
    <div className="space-y-4">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-amber-600 dark:text-amber-400">
          生產模擬器
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 分頁切換 */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <button
          onClick={() => setActiveTab('simulator')}
          className={`
            flex-1 px-3 py-1.5 text-sm rounded-md transition-colors flex items-center justify-center gap-1.5
            ${activeTab === 'simulator'
              ? 'bg-white dark:bg-gray-700 shadow-sm font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }
          `}
        >
          <span>🔧</span>
          模擬
        </button>
        <button
          onClick={() => setActiveTab('solver')}
          className={`
            flex-1 px-3 py-1.5 text-sm rounded-md transition-colors flex items-center justify-center gap-1.5
            ${activeTab === 'solver'
              ? 'bg-white dark:bg-gray-700 shadow-sm font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }
          `}
        >
          <span>🧮</span>
          求解
        </button>
        <button
          onClick={() => setActiveTab('analyzer')}
          className={`
            flex-1 px-3 py-1.5 text-sm rounded-md transition-colors flex items-center justify-center gap-1.5
            ${activeTab === 'analyzer'
              ? 'bg-white dark:bg-gray-700 shadow-sm font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }
          `}
        >
          <span>📊</span>
          分析
        </button>
      </div>

      {/* 配方資訊 */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium">{recipe.item?.name || `配方 ${recipe.id}`}</span>
          {recipe.isCollectable && (
            <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs font-medium">
              📦 收藏品
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
          <div>難度: {recipe.difficulty}</div>
          <div>品質: {recipe.quality}</div>
          <div>耐久: {recipe.durability}</div>
        </div>
        {/* 收藏品門檻資訊 */}
        {recipe.isCollectable && recipe.collectability && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">收藏價值門檻</div>
            <div className="flex gap-3 text-xs">
              <span style={{ color: '#79c7ec' }}>普通: {recipe.collectability.low}</span>
              <span style={{ color: '#fbc800' }}>精選: {recipe.collectability.mid}</span>
              <span style={{ color: '#22c55e' }}>特選: {recipe.collectability.high}</span>
            </div>
          </div>
        )}
      </div>

      {/* 製作者數值 */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-blue-800 dark:text-blue-300">⚒️ 製作者數值</span>
          {advancedCrafterStats && (
            <span className="text-xs text-green-600 dark:text-green-400">✓ 已套用進階設定</span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="flex flex-col">
            <span className="text-gray-500">等級</span>
            <span className="font-medium text-gray-900 dark:text-white">{effectiveStats.level}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500">作業精度</span>
            <span className={`font-medium ${advancedCrafterStats && advancedCrafterStats.craftsmanship !== crafterStats.craftsmanship ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
              {effectiveStats.craftsmanship}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500">加工精度</span>
            <span className={`font-medium ${advancedCrafterStats && advancedCrafterStats.control !== crafterStats.control ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
              {effectiveStats.control}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500">CP(製作力)</span>
            <span className={`font-medium ${advancedCrafterStats && advancedCrafterStats.cp !== crafterStats.cp ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
              {effectiveStats.cp}
            </span>
          </div>
        </div>
      </div>

      {/* 分析器分頁 */}
      {activeTab === 'analyzer' && (
        <CraftingAnalyzer
          recipe={recipe}
          crafterStats={crafterStats}
          actions={selectedActions}
          currentState={state}
        />
      )}
      
      {/* 求解器分頁 */}
      {activeTab === 'solver' && (
        <div className="space-y-4 relative">
          {/* 求解中載入遮罩 */}
          {isSolving && (
            <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 z-10 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
              <div className="text-lg font-medium text-purple-600 dark:text-purple-400">求解中...</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">正在計算最佳技能序列</div>
            </div>
          )}
          
          {/* 求解結果（放最上方） */}
          {solverResult && (
            <div className="space-y-4">
              {/* 結果摘要 */}
              <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold">求解結果</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">步數: <span className="font-bold text-blue-600">{solverResult.steps}</span></span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      solverResult.success
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {solverResult.success ? '成功' : '失敗'}
                    </span>
                  </div>
                </div>
                
                {/* 進度條顯示 */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <StatusBar
                    label="進度"
                    current={solverResult.finalState.progress}
                    max={recipe.difficulty}
                    color="blue"
                  />
                  <StatusBar
                    label={recipe.isCollectable ? "品質 (收藏品)" : "品質"}
                    current={solverResult.finalState.quality}
                    max={recipe.quality}
                    color="amber"
                    collectabilityThresholds={recipe.isCollectable && recipe.collectability ? {
                      low: recipe.collectability.low * 10,
                      mid: recipe.collectability.mid * 10,
                      high: recipe.collectability.high * 10,
                    } : undefined}
                  />
                </div>
                
                {/* HQ 機率（非收藏品時顯示） */}
                {!recipe.isCollectable && (
                  <div className="mb-4 p-2 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">HQ 機率</span>
                      <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{solverResult.hqChance}%</span>
                    </div>
                  </div>
                )}
                
                {/* 技能序列預覽 */}
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-2">技能序列</div>
                  <div className="flex flex-wrap gap-1 p-2 bg-gray-50 dark:bg-gray-800 rounded max-h-32 overflow-y-auto">
                    {solverResult.actions.map((action, index) => (
                      <span
                        key={index}
                        className={`px-1.5 py-0.5 rounded text-xs ${getCategoryPillColor(action.category)}`}
                      >
                        {index + 1}. {action.nameZh}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* 套用按鈕 */}
                <button
                  onClick={handleApplySolverResult}
                  className="w-full px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  套用到模擬器
                </button>
              </div>
              
              {/* 巨集匯出 */}
              <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold mb-4">📋 巨集匯出</h4>
                <MacroExporter actions={solverResult.actions} />
              </div>
            </div>
          )}
          
          {/* 求解器選項（可收闔） */}
          <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
            {/* 標題與收闔按鈕 */}
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowSolverSettings(!showSolverSettings)}
            >
              <h3 className="font-semibold text-purple-800 dark:text-purple-300">
                🧮 Raphael 求解器
              </h3>
              <span className="text-gray-500">{showSolverSettings ? '▼' : '▶'}</span>
            </div>
            
            {/* 收闔的設定區域 */}
            {showSolverSettings && (
              <div className="mt-4 space-y-4">
                {/* 目標品質 */}
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {recipe.isCollectable ? '目標收藏價值' : '目標品質'}
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {/* 收藏品門檻快速選項 */}
                    {recipe.isCollectable && recipe.collectability ? (
                      <>
                        <button
                          onClick={() => setSolverOptions(prev => ({ ...prev, targetQuality: recipe.collectability!.high * 10 }))}
                          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            solverOptions.targetQuality === recipe.collectability.high * 10
                              ? 'text-white'
                              : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                          }`}
                          style={solverOptions.targetQuality === recipe.collectability.high * 10 ? { backgroundColor: '#22c55e' } : {}}
                        >
                          特選 ({recipe.collectability.high})
                        </button>
                        <button
                          onClick={() => setSolverOptions(prev => ({ ...prev, targetQuality: recipe.collectability!.mid * 10 }))}
                          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            solverOptions.targetQuality === recipe.collectability.mid * 10
                              ? 'text-white'
                              : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                          }`}
                          style={solverOptions.targetQuality === recipe.collectability.mid * 10 ? { backgroundColor: '#fbc800', color: '#854d0e' } : {}}
                        >
                          精選 ({recipe.collectability.mid})
                        </button>
                        <button
                          onClick={() => setSolverOptions(prev => ({ ...prev, targetQuality: recipe.collectability!.low * 10 }))}
                          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            solverOptions.targetQuality === recipe.collectability.low * 10
                              ? 'text-white'
                              : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                          }`}
                          style={solverOptions.targetQuality === recipe.collectability.low * 10 ? { backgroundColor: '#79c7ec', color: '#0369a1' } : {}}
                        >
                          普通 ({recipe.collectability.low})
                        </button>
                      </>
                    ) : (
                      /* 非收藏品的百分比選項 */
                      <>
                        <button
                          onClick={() => setSolverOptions(prev => ({ ...prev, targetQuality: recipe.quality }))}
                          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            solverOptions.targetQuality === recipe.quality
                              ? 'bg-purple-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                          }`}
                        >
                          最大 ({recipe.quality})
                        </button>
                        <button
                          onClick={() => setSolverOptions(prev => ({ ...prev, targetQuality: Math.floor(recipe.quality * 0.7) }))}
                          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            solverOptions.targetQuality === Math.floor(recipe.quality * 0.7)
                              ? 'bg-purple-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                          }`}
                        >
                          70%
                        </button>
                        <button
                          onClick={() => setSolverOptions(prev => ({ ...prev, targetQuality: Math.floor(recipe.quality * 0.5) }))}
                          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            solverOptions.targetQuality === Math.floor(recipe.quality * 0.5)
                              ? 'bg-purple-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                          }`}
                        >
                          50%
                        </button>
                      </>
                    )}
                    <input
                      type="number"
                      value={recipe.isCollectable ? Math.round((solverOptions.targetQuality ?? 0) / 10) : (solverOptions.targetQuality ?? 0)}
                      onChange={(e) => setSolverOptions(prev => ({ 
                        ...prev, 
                        targetQuality: recipe.isCollectable ? Number(e.target.value) * 10 : Number(e.target.value) 
                      }))}
                      className="px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600 w-24"
                      min={0}
                      max={recipe.isCollectable ? Math.round(recipe.quality / 10) : recipe.quality}
                    />
                  </div>
                </div>
                
                {/* 技能選項 */}
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">技能設定</div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 text-sm p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={solverOptions.useManipulation}
                        onChange={(e) => setSolverOptions(prev => ({ ...prev, useManipulation: e.target.checked }))}
                        className="rounded text-purple-500 focus:ring-purple-500"
                      />
                      <span>掌握</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={solverOptions.useHeartAndSoul}
                        onChange={(e) => setSolverOptions(prev => ({ ...prev, useHeartAndSoul: e.target.checked }))}
                        className="rounded text-purple-500 focus:ring-purple-500"
                      />
                      <span>專心致志</span>
                      <span className="text-xs text-amber-500" title="消耗能工巧匠圖紙">⚠️</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={solverOptions.useQuickInnovation}
                        onChange={(e) => setSolverOptions(prev => ({ ...prev, useQuickInnovation: e.target.checked }))}
                        className="rounded text-purple-500 focus:ring-purple-500"
                      />
                      <span>快速革新</span>
                      <span className="text-xs text-amber-500" title="消耗能工巧匠圖紙">⚠️</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={solverOptions.useTrainedEye}
                        onChange={(e) => setSolverOptions(prev => ({ ...prev, useTrainedEye: e.target.checked }))}
                        className="rounded text-purple-500 focus:ring-purple-500"
                      />
                      <span>工匠的神速技巧</span>
                      <span className="text-xs text-gray-400" title="需要等級比配方高10級">(Lv+10)</span>
                    </label>
                  </div>
                </div>
                
                {/* 食物與藥水 */}
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">食物、藥水與裝備</div>
                  <div className="space-y-3">
                    {/* 專家之證 */}
                    <label className="flex items-center gap-2 text-sm p-2 rounded bg-amber-50 dark:bg-amber-900/20 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useSoulOfCrafter}
                        onChange={(e) => setUseSoulOfCrafter(e.target.checked)}
                        className="rounded text-amber-500 focus:ring-amber-500"
                      />
                      <span>⭐ 專家之證</span>
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        {getEnhancerEffectText(SOUL_OF_THE_CRAFTER)}
                      </span>
                    </label>
                    
                    {/* 食物選擇 */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">🍽️ 食物</span>
                      </div>
                      <select
                        value={selectedMeal?.id || 0}
                        onChange={(e) => {
                          const id = Number(e.target.value);
                          setSelectedMeal(MEALS.find(m => m.id === id) || null);
                        }}
                        className="w-full px-2 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                      >
                        <option value={0}>無</option>
                        {MEALS.map(meal => (
                          <option key={meal.id} value={meal.id}>
                            {getEnhancerDisplayName(meal)} - {getEnhancerEffectText(meal)}
                          </option>
                        ))}
                      </select>
                      {selectedMeal && (
                        <div className="mt-1 text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                          <span>📊 {getEnhancerDisplayName(selectedMeal)}: {getEnhancerEffectText(selectedMeal)}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* 藥水選擇 */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">🧪 藥水</span>
                      </div>
                      <select
                        value={selectedMedicine?.id || 0}
                        onChange={(e) => {
                          const id = Number(e.target.value);
                          setSelectedMedicine(MEDICINES.find(m => m.id === id) || null);
                        }}
                        className="w-full px-2 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                      >
                        <option value={0}>無</option>
                        {MEDICINES.map(med => (
                          <option key={med.id} value={med.id}>
                            {getEnhancerDisplayName(med)} - {getEnhancerEffectText(med)}
                          </option>
                        ))}
                      </select>
                      {selectedMedicine && (
                        <div className="mt-1 text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                          <span>📊 {getEnhancerDisplayName(selectedMedicine)}: {getEnhancerEffectText(selectedMedicine)}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* 顯示加成效果 */}
                    {enhancedStats && (
                      <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-xs space-y-1">
                        <div className="text-green-700 dark:text-green-300 font-medium mb-1">📈 屬性加成總計</div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">作業精度:</span>
                          <span className="text-green-600 dark:text-green-400">
                            {crafterStats.craftsmanship} → {enhancedStats.craftsmanship}
                            <span className="ml-1">(+{enhancedStats.bonuses.cm})</span>
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">加工精度:</span>
                          <span className="text-green-600 dark:text-green-400">
                            {crafterStats.control} → {enhancedStats.control}
                            <span className="ml-1">(+{enhancedStats.bonuses.ct})</span>
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">CP:</span>
                          <span className="text-green-600 dark:text-green-400">
                            {crafterStats.cp} → {enhancedStats.cp}
                            <span className="ml-1">(+{enhancedStats.bonuses.cp})</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 求解選項 */}
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">求解設定</div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 text-sm p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={solverOptions.backloadProgress}
                        onChange={(e) => setSolverOptions(prev => ({ ...prev, backloadProgress: e.target.checked }))}
                        className="rounded text-purple-500 focus:ring-purple-500"
                      />
                      <span>後置進度</span>
                      <span className="text-xs text-green-500" title="快速求解">⚡</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={solverOptions.adversarial}
                        onChange={(e) => setSolverOptions(prev => ({ ...prev, adversarial: e.target.checked }))}
                        className="rounded text-purple-500 focus:ring-purple-500"
                      />
                      <span>防黑球</span>
                      <span className="text-xs text-blue-500" title="100%可靠">🛡️</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
            
            {/* 按鈕區域 */}
            <div className="flex gap-2 mt-4">
              {/* 進階設定按鈕 */}
              <button
                onClick={() => setShowAdvancedSettings(true)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center gap-2"
              >
                <span>⚙️</span>
                進階設定
              </button>
              
              {/* 求解按鈕 */}
              <button
                onClick={handleSolve}
                disabled={isSolving}
                className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSolving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    求解中...
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    開始求解
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 進階設定彈窗 */}
      <SolverSettingsDialog
        isOpen={showAdvancedSettings}
        onClose={() => setShowAdvancedSettings(false)}
        recipe={recipe}
        initialCrafterStats={advancedCrafterStats || crafterStats}
        isSolving={isSolving}
        onApply={(settings) => {
          // 更新製作者數值
          setAdvancedCrafterStats(settings.crafterStats);
          // 更新求解器選項
          setSolverOptions(prev => ({
            ...prev,
            ...settings.solverOptions,
          }));
          setShowAdvancedSettings(false);
        }}
        onSolve={(settings) => {
          // 更新製作者數值
          setAdvancedCrafterStats(settings.crafterStats);
          // 更新求解器選項
          setSolverOptions(prev => ({
            ...prev,
            ...settings.solverOptions,
          }));
          setShowAdvancedSettings(false);
          // 延遲執行求解，確保狀態已更新
          setTimeout(() => handleSolve(), 0);
        }}
      />

      {/* 模擬器分頁 */}
      {activeTab === 'simulator' && (
        <>

      {/* 狀態面板 */}
      <div className="grid grid-cols-2 gap-3">
        <StatusBar
          label="進度"
          current={state.progress}
          max={recipe.difficulty}
          color="blue"
        />
        <StatusBar
          label={recipe.isCollectable ? "品質 (收藏品)" : "品質"}
          current={state.quality}
          max={recipe.quality}
          color="amber"
          collectabilityThresholds={recipe.isCollectable && recipe.collectability ? {
            low: recipe.collectability.low * 10,   // 轉換收藏價值為品質值
            mid: recipe.collectability.mid * 10,
            high: recipe.collectability.high * 10,
          } : undefined}
        />
        <StatusBar
          label="耐久度"
          current={state.durability}
          max={recipe.durability}
          color="green"
        />
        <StatusBar
          label="製作力"
          current={state.cp}
          max={crafterStats.cp}
          color="purple"
        />
      </div>

      {/* HQ 機率與內靜 */}
      <div className="flex items-center gap-4 p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg">
        <div className="flex-1">
          <div className="text-xs text-gray-500">HQ 機率</div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
            {hqChance}%
          </div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-500">內靜</div>
          <div className="flex items-center gap-1">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${
                  i < innerQuietStacks
                    ? 'bg-blue-500'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 當前狀態與 Buff */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`
            px-2 py-1 rounded text-xs font-medium
            ${getConditionColor(state.condition)}
          `}
        >
          {getConditionName(state.condition)}
        </span>
        <span className="text-xs text-gray-500">
          步數: {state.step}
        </span>
        {state.buffs
          .filter(b => b.name !== 'InnerQuiet')
          .map((buff, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs"
            >
              {getBuffName(buff.name)} {buff.duration > 0 && `(${buff.duration})`}
            </span>
          ))}
      </div>

      {/* 完成狀態 */}
      {state.isComplete && (
        <div
          className={`
            p-4 rounded-lg text-center font-bold
            ${state.isSuccess
              ? state.isHQ
                ? 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 dark:from-amber-900/30 dark:to-yellow-900/30 dark:text-amber-300'
                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
            }
          `}
        >
          {state.isSuccess
            ? state.isHQ
              ? '🎉 製作成功！(HQ)'
              : '✓ 製作成功'
            : '✗ 製作失敗'}
        </div>
      )}

      {/* 操作按鈕 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleReset}
          className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
        >
          重置
        </button>
        <button
          onClick={handleUndo}
          disabled={selectedActions.length === 0}
          className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
        >
          撤銷
        </button>
        {selectedActions.length > 0 && (
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors"
          >
            匯出宏
          </button>
        )}
        <label className="flex items-center gap-1.5 text-xs text-gray-500 ml-auto">
          <input
            type="checkbox"
            checked={showAllSkills}
            onChange={(e) => setShowAllSkills(e.target.checked)}
            className="rounded"
          />
          顯示全部技能
        </label>
      </div>

      {/* 技能列表 */}
      <div className="space-y-3">
        {(['progress', 'quality', 'durability', 'buff'] as const).map((category) => {
          const actions = availableActions.filter((a) => a.category === category);
          if (actions.length === 0) return null;
          
          return (
            <div key={category}>
              <h4 className="text-xs font-medium text-gray-500 mb-1.5 uppercase">
                {getCategoryName(category)}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {actions.map((action) => {
                  const canUse = checkActionUsable(state, action);
                  
                  return (
                    <button
                      key={action.id}
                      onClick={() => handleAction(action)}
                      disabled={!canUse}
                      className={`
                        group relative px-2 py-1.5 rounded text-xs font-medium transition-all
                        ${canUse
                          ? getCategoryButtonColor(category)
                          : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed'
                        }
                      `}
                    >
                      {action.nameZh}
                      <span className="ml-1 opacity-60">
                        {action.cpCost}
                      </span>
                      
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                        {action.description}
                        <br />
                        <span className="text-gray-400">
                          CP: {action.cpCost} | 耐久: {action.durabilityCost}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 已使用技能序列 */}
      {selectedActions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-gray-500 uppercase">技能序列 ({selectedActions.length} 步)</h4>
            <button
              onClick={() => setShowMacroExport(!showMacroExport)}
              className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              {showMacroExport ? '隱藏巨集' : '匯出巨集'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg max-h-24 overflow-y-auto">
            {selectedActions.map((action, index) => (
              <span
                key={index}
                className={`
                  px-1.5 py-0.5 rounded text-xs
                  ${getCategoryPillColor(action.category)}
                `}
              >
                {index + 1}. {action.nameZh}
              </span>
            ))}
          </div>
          {/* 巨集匯出面板 */}
          {showMacroExport && (
            <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <MacroExporter actions={selectedActions} />
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}

// 檢查技能是否可用
function checkActionUsable(state: CraftingState, action: CraftAction): boolean {
  if (state.isComplete) return false;
  if (state.cp < action.cpCost) return false;
  if (action.durabilityCost > 0 && state.durability <= 0) return false;
  
  // 特殊條件檢查
  const hasWasteNot = state.buffs.some(b => b.name === 'WasteNot' || b.name === 'WasteNot2');
  if ((action.id === 'prudent_synthesis' || action.id === 'prudent_touch') && hasWasteNot) {
    return false; // 儉約類技能不能在儉約狀態使用
  }
  
  // 集中類技能需要高品質狀態
  if ((action.id === 'intensive_synthesis' || action.id === 'precise_touch') &&
      state.condition !== 'Good' && state.condition !== 'Excellent') {
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

// 狀態條組件
interface StatusBarProps {
  label: string;
  current: number;
  max: number;
  color: 'blue' | 'amber' | 'green' | 'purple';
  // 收藏品門檻支援
  collectabilityThresholds?: {
    low: number;   // 普通（一檔）- 品質值
    mid: number;   // 精選（二檔）- 品質值
    high: number;  // 特選（三檔）- 品質值
  };
}

function StatusBar({ label, current, max, color, collectabilityThresholds }: StatusBarProps) {
  const percentage = Math.min(100, (current / max) * 100);
  
  const colorClasses = {
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
  };

  // 計算收藏品門檻位置（轉換為百分比）
  const getThresholdPosition = (threshold: number) => {
    return Math.min(100, (threshold / max) * 100);
  };

  // 判斷當前收藏品等級
  const getCollectabilityLevel = () => {
    if (!collectabilityThresholds) return null;
    // 收藏價值 = 品質 / 10
    const collectability = current / 10;
    if (collectability >= collectabilityThresholds.high / 10) return 'high';
    if (collectability >= collectabilityThresholds.mid / 10) return 'mid';
    if (collectability >= collectabilityThresholds.low / 10) return 'low';
    return null;
  };

  const collectabilityLevel = collectabilityThresholds ? getCollectabilityLevel() : null;

  // 收藏品等級顏色
  const collectabilityColors = {
    low: '#79c7ec',   // 藍色 - 普通
    mid: '#fbc800',   // 金色 - 精選
    high: '#c0ffc0',  // 綠色 - 特選
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">{label}</span>
        <span className="font-medium flex items-center gap-2">
          {current} / {max}
          {collectabilityThresholds && collectabilityLevel && (
            <span 
              className="px-1.5 py-0.5 rounded text-xs font-bold"
              style={{ 
                backgroundColor: collectabilityColors[collectabilityLevel],
                color: collectabilityLevel === 'high' ? '#166534' : collectabilityLevel === 'mid' ? '#854d0e' : '#0369a1'
              }}
            >
              {collectabilityLevel === 'high' ? '特選' : collectabilityLevel === 'mid' ? '精選' : '普通'}
            </span>
          )}
        </span>
      </div>
      <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        {/* 進度條 */}
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
        {/* 收藏品門檻標記 */}
        {collectabilityThresholds && (
          <>
            {/* 普通門檻（一檔）- 藍色 */}
            <div
              className="absolute top-0 bottom-0 w-0.5"
              style={{ 
                left: `${getThresholdPosition(collectabilityThresholds.low)}%`,
                backgroundColor: collectabilityColors.low,
              }}
              title={`普通: ${collectabilityThresholds.low / 10}`}
            />
            {/* 精選門檻（二檔）- 金色 */}
            <div
              className="absolute top-0 bottom-0 w-0.5"
              style={{ 
                left: `${getThresholdPosition(collectabilityThresholds.mid)}%`,
                backgroundColor: collectabilityColors.mid,
              }}
              title={`精選: ${collectabilityThresholds.mid / 10}`}
            />
            {/* 特選門檻（三檔）- 綠色 */}
            <div
              className="absolute top-0 bottom-0 w-0.5"
              style={{ 
                left: `${getThresholdPosition(collectabilityThresholds.high)}%`,
                backgroundColor: collectabilityColors.high,
              }}
              title={`特選: ${collectabilityThresholds.high / 10}`}
            />
          </>
        )}
      </div>
      {/* 收藏品門檻數值 */}
      {collectabilityThresholds && (
        <div className="flex justify-between text-xs text-gray-400">
          <span style={{ color: collectabilityColors.low }}>
            普通: {collectabilityThresholds.low / 10}
          </span>
          <span style={{ color: collectabilityColors.mid }}>
            精選: {collectabilityThresholds.mid / 10}
          </span>
          <span style={{ color: collectabilityColors.high }}>
            特選: {collectabilityThresholds.high / 10}
          </span>
        </div>
      )}
    </div>
  );
}

// 工具函式
function getConditionName(condition: CraftingState['condition']): string {
  const names: Record<CraftingState['condition'], string> = {
    Normal: '通常',
    Good: '高品質',
    Excellent: '最高品質',
    Poor: '低品質',
    Centered: '安定',
    Sturdy: '堅固',
    Pliant: '柔韌',
    Malleable: '柔順',
    Primed: '長效',
  };
  return names[condition];
}

function getConditionColor(condition: CraftingState['condition']): string {
  const colors: Record<CraftingState['condition'], string> = {
    Normal: 'bg-gray-100 text-gray-700',
    Good: 'bg-orange-100 text-orange-700',
    Excellent: 'bg-rainbow-gradient text-white',
    Poor: 'bg-purple-100 text-purple-700',
    Centered: 'bg-yellow-100 text-yellow-700',
    Sturdy: 'bg-blue-100 text-blue-700',
    Pliant: 'bg-green-100 text-green-700',
    Malleable: 'bg-cyan-100 text-cyan-700',
    Primed: 'bg-pink-100 text-pink-700',
  };
  return colors[condition];
}

function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    progress: '進度',
    quality: '品質',
    durability: '耐久度',
    buff: '增益',
    other: '其他',
  };
  return names[category] || category;
}

function getBuffName(name: string): string {
  const names: Record<string, string> = {
    WasteNot: '儉約',
    WasteNot2: '長期儉約',
    Innovation: '改革',
    Veneration: '崇敬',
    GreatStrides: '闘魂',
    Manipulation: '掌握',
    MuscleMemory: '肌肉記憶',
    Observed: '觀察',
    InnerQuiet: '內靜',
  };
  return names[name] || name;
}

function getCategoryButtonColor(category: string): string {
  const colors: Record<string, string> = {
    progress: 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500',
    quality: 'bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500',
    durability: 'bg-green-500 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500',
    buff: 'bg-purple-500 text-white hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-500',
  };
  return colors[category] || 'bg-gray-500 text-white hover:bg-gray-600';
}

function getCategoryPillColor(category: string): string {
  const colors: Record<string, string> = {
    progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    quality: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    durability: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    buff: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  };
  return colors[category] || 'bg-gray-100 text-gray-700';
}
