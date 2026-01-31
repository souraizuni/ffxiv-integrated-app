'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Recipe, CrafterStats, CraftAction } from '@/types';
import {
  MEALS,
  MEDICINES,
  SPECIAL_ACTIONS,
  CRAFTER_PRESETS,
  calculateEnhancedAttributes,
  getEnhancerEffectText,
  getEnhancerDisplayName,
  type Enhancer,
  type SpecialActionOption,
} from '@/data/enhancers';
import {
  createInitialCraftingState,
  executeCraftAction,
  getAvailableActions,
  calculateHQChance,
} from '@/lib/simulator';
import { CraftingAnalyzer } from './crafting-analyzer';

interface CrafterStatusEditorProps {
  recipe: Recipe;
  onStatsChange?: (stats: CrafterStats) => void;
  onActionsGenerated?: (actions: CraftAction[]) => void;
}

export function CrafterStatusEditor({
  recipe,
  onStatsChange,
  onActionsGenerated,
}: CrafterStatusEditorProps) {
  // 基礎屬性
  const [baseStats, setBaseStats] = useState({
    level: 100,
    craftsmanship: 4956,
    control: 4963,
    cp: 687,
  });
  
  // 選擇的預設
  const [selectedPreset, setSelectedPreset] = useState<string>('7.0 畢業裝 (HQ 全附魔)');
  
  // 食物與藥水
  const [selectedMeal, setSelectedMeal] = useState<Enhancer | null>(null);
  const [selectedMedicine, setSelectedMedicine] = useState<Enhancer | null>(null);
  
  // 特殊技能選項
  const [enabledSpecialActions, setEnabledSpecialActions] = useState<Set<string>>(
    new Set(['manipulation', 'waste_not'])
  );
  
  // 生成的技能序列
  const [generatedActions, setGeneratedActions] = useState<CraftAction[]>([]);
  
  // 是否展開詳細設定
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // 是否顯示分析結果
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  // 正在求解中
  const [isSolving, setIsSolving] = useState(false);

  // 計算增強後的屬性
  const enhancedStats = useMemo((): CrafterStats => {
    const enhancers: Enhancer[] = [];
    if (selectedMeal && selectedMeal.id !== 0) enhancers.push(selectedMeal);
    if (selectedMedicine && selectedMedicine.id !== 0) enhancers.push(selectedMedicine);
    
    const result = calculateEnhancedAttributes(baseStats, enhancers);
    
    return {
      job: 'CRP',
      level: result.level,
      craftsmanship: result.craftsmanship,
      control: result.control,
      cp: result.cp,
      specialist: false,
    };
  }, [baseStats, selectedMeal, selectedMedicine]);

  // 計算屬性加成詳情
  const bonusDetails = useMemo(() => {
    const enhancers: Enhancer[] = [];
    if (selectedMeal && selectedMeal.id !== 0) enhancers.push(selectedMeal);
    if (selectedMedicine && selectedMedicine.id !== 0) enhancers.push(selectedMedicine);
    
    return calculateEnhancedAttributes(baseStats, enhancers).bonuses;
  }, [baseStats, selectedMeal, selectedMedicine]);

  // 通知外部屬性變化
  useEffect(() => {
    onStatsChange?.(enhancedStats);
  }, [enhancedStats, onStatsChange]);

  // 處理預設選擇
  const handlePresetChange = (presetName: string) => {
    setSelectedPreset(presetName);
    const preset = CRAFTER_PRESETS.find(p => p.name === presetName);
    if (preset) {
      setBaseStats({
        level: preset.level,
        craftsmanship: preset.craftsmanship,
        control: preset.control,
        cp: preset.cp,
      });
    }
  };

  // 切換特殊技能
  const toggleSpecialAction = (actionId: string) => {
    setEnabledSpecialActions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(actionId)) {
        newSet.delete(actionId);
      } else {
        newSet.add(actionId);
      }
      return newSet;
    });
  };

  // 自動求解
  const handleAutoSolve = useCallback(async () => {
    setIsSolving(true);
    
    // 使用 setTimeout 讓 UI 更新
    await new Promise(resolve => setTimeout(resolve, 10));
    
    try {
      const actions = solveRotation(
        recipe,
        enhancedStats,
        enabledSpecialActions
      );
      
      setGeneratedActions(actions);
      setShowAnalysis(true);
      onActionsGenerated?.(actions);
    } finally {
      setIsSolving(false);
    }
  }, [recipe, enhancedStats, enabledSpecialActions, onActionsGenerated]);

  // 匯出巨集
  const handleExportMacro = useCallback(() => {
    if (generatedActions.length === 0) return;
    
    const macroText = generateMacroText(generatedActions);
    navigator.clipboard.writeText(macroText);
    alert('巨集已複製到剪貼簿！');
  }, [generatedActions]);

  // 匯出多段巨集
  const handleExportMultiMacro = useCallback(() => {
    if (generatedActions.length === 0) return;
    
    const macros = generateMultiMacro(generatedActions);
    const fullText = macros.map((m, i) => `=== 巨集 ${i + 1} ===\n${m}`).join('\n\n');
    navigator.clipboard.writeText(fullText);
    alert(`已複製 ${macros.length} 段巨集到剪貼簿！`);
  }, [generatedActions]);

  return (
    <div className="space-y-4">
      {/* 預設選擇 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          職業配置
        </label>
        <select
          value={selectedPreset}
          onChange={(e) => handlePresetChange(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
        >
          {CRAFTER_PRESETS.map(preset => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </select>
      </div>

      {/* 基礎屬性顯示/編輯 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">等級</label>
          <input
            type="number"
            value={baseStats.level}
            onChange={(e) => setBaseStats(s => ({ ...s, level: Number(e.target.value) }))}
            className="w-full px-2 py-1.5 border rounded dark:bg-gray-800 dark:border-gray-600"
            min={1}
            max={100}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">CP</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={baseStats.cp}
              onChange={(e) => setBaseStats(s => ({ ...s, cp: Number(e.target.value) }))}
              className="flex-1 px-2 py-1.5 border rounded dark:bg-gray-800 dark:border-gray-600"
              min={0}
            />
            {bonusDetails.cp > 0 && (
              <span className="text-xs text-green-600">+{bonusDetails.cp}</span>
            )}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500">作業精度</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={baseStats.craftsmanship}
              onChange={(e) => setBaseStats(s => ({ ...s, craftsmanship: Number(e.target.value) }))}
              className="flex-1 px-2 py-1.5 border rounded dark:bg-gray-800 dark:border-gray-600"
              min={0}
            />
            {bonusDetails.cm > 0 && (
              <span className="text-xs text-green-600">+{bonusDetails.cm}</span>
            )}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500">加工精度</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={baseStats.control}
              onChange={(e) => setBaseStats(s => ({ ...s, control: Number(e.target.value) }))}
              className="flex-1 px-2 py-1.5 border rounded dark:bg-gray-800 dark:border-gray-600"
              min={0}
            />
            {bonusDetails.ct > 0 && (
              <span className="text-xs text-green-600">+{bonusDetails.ct}</span>
            )}
          </div>
        </div>
      </div>

      {/* 最終屬性摘要 */}
      <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
        <div className="text-xs text-gray-500 mb-1">最終屬性</div>
        <div className="grid grid-cols-4 gap-2 text-sm font-medium">
          <div>
            <span className="text-gray-500">Lv.</span>
            <span className="ml-1">{enhancedStats.level}</span>
          </div>
          <div>
            <span className="text-blue-600">{enhancedStats.craftsmanship}</span>
            <span className="text-xs text-gray-500 ml-0.5">作</span>
          </div>
          <div>
            <span className="text-amber-600">{enhancedStats.control}</span>
            <span className="text-xs text-gray-500 ml-0.5">加</span>
          </div>
          <div>
            <span className="text-purple-600">{enhancedStats.cp}</span>
            <span className="text-xs text-gray-500 ml-0.5">CP</span>
          </div>
        </div>
      </div>

      {/* 食物與藥水 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            食物 & 藥水
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {/* 食物選擇 */}
          <div>
            <label className="text-xs text-gray-500">食物</label>
            <select
              value={selectedMeal?.id || 0}
              onChange={(e) => {
                const meal = MEALS.find(m => m.id === Number(e.target.value));
                setSelectedMeal(meal || null);
              }}
              className="w-full px-2 py-1.5 border rounded dark:bg-gray-800 dark:border-gray-600 text-sm"
            >
              <option value={0}>無</option>
              {MEALS.map(meal => (
                <option key={meal.id} value={meal.id}>
                  {getEnhancerDisplayName(meal)} - {getEnhancerEffectText(meal)}
                </option>
              ))}
            </select>
          </div>
          
          {/* 藥水選擇 */}
          <div>
            <label className="text-xs text-gray-500">藥水</label>
            <select
              value={selectedMedicine?.id || 0}
              onChange={(e) => {
                const med = MEDICINES.find(m => m.id === Number(e.target.value));
                setSelectedMedicine(med || null);
              }}
              className="w-full px-2 py-1.5 border rounded dark:bg-gray-800 dark:border-gray-600 text-sm"
            >
              <option value={0}>無</option>
              {MEDICINES.map(med => (
                <option key={med.id} value={med.id}>
                  {getEnhancerDisplayName(med)} - {getEnhancerEffectText(med)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 進階選項切換 */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <svg
          className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        進階選項
      </button>

      {/* 特殊技能選項 */}
      {showAdvanced && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-2">
          <div className="text-xs font-medium text-gray-500 mb-2">使用的特殊技能</div>
          <div className="grid grid-cols-2 gap-2">
            {SPECIAL_ACTIONS.map(action => (
              <label
                key={action.id}
                className={`
                  flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors
                  ${enabledSpecialActions.has(action.id)
                    ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700'
                    : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                  }
                `}
              >
                <input
                  type="checkbox"
                  checked={enabledSpecialActions.has(action.id)}
                  onChange={() => toggleSpecialAction(action.id)}
                  className="mt-0.5 rounded"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{action.nameZh}</div>
                  <div className="text-xs text-gray-500 truncate">{action.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 求解按鈕 */}
      <div className="flex gap-2">
        <button
          onClick={handleAutoSolve}
          disabled={isSolving}
          className={`
            flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors
            ${isSolving
              ? 'bg-gray-300 text-gray-500 cursor-wait'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600'
            }
          `}
        >
          {isSolving ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              求解中...
            </span>
          ) : (
            '🔍 自動求解'
          )}
        </button>
      </div>

      {/* 生成的技能序列 */}
      {generatedActions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              技能序列 ({generatedActions.length} 步)
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleExportMacro}
                className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
              >
                複製巨集
              </button>
              <button
                onClick={handleExportMultiMacro}
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                多段巨集
              </button>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg max-h-32 overflow-y-auto">
            {generatedActions.map((action, index) => (
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
        </div>
      )}

      {/* 分析結果 */}
      {showAnalysis && generatedActions.length > 0 && (
        <div className="border-t pt-4">
          <CraftingAnalyzer
            recipe={recipe}
            crafterStats={enhancedStats}
            actions={generatedActions}
          />
        </div>
      )}
    </div>
  );
}

// ============================================
// 求解器函數
// ============================================

function solveRotation(
  recipe: Recipe,
  stats: CrafterStats,
  enabledSpecialActions: Set<string>
): CraftAction[] {
  const actions: CraftAction[] = [];
  let state = createInitialCraftingState(recipe, stats);
  const availableActions = getAvailableActions(stats.level);
  
  const useManipulation = enabledSpecialActions.has('manipulation');
  const useWasteNot = enabledSpecialActions.has('waste_not');
  
  // 找到特定技能
  const findAction = (id: string) => availableActions.find(a => a.id === id);
  
  const muscleMemory = findAction('muscle_memory');
  const reflect = findAction('reflect');
  const manipulation = findAction('manipulation');
  const wasteNot2 = findAction('waste_not_2');
  const wasteNot = findAction('waste_not');
  const innovation = findAction('innovation');
  const veneration = findAction('veneration');
  const greatStrides = findAction('great_strides');
  const basicTouch = findAction('basic_touch');
  const standardTouch = findAction('standard_touch');
  const advancedTouch = findAction('advanced_touch');
  const byregots = findAction('byregots_blessing');
  const prudentTouch = findAction('prudent_touch');
  const preparatoryTouch = findAction('preparatory_touch');
  const basicSynthesis = findAction('basic_synthesis');
  const carefulSynthesis = findAction('careful_synthesis');
  const groundwork = findAction('groundwork');
  const mastersMend = findAction('masters_mend');
  const observe = findAction('observe');
  const focusedSynthesis = findAction('focused_synthesis');
  const focusedTouch = findAction('focused_touch');
  
  // 執行動作的輔助函數
  const doAction = (action: CraftAction | undefined): boolean => {
    if (!action) return false;
    if (state.isComplete) return false;
    if (state.cp < action.cpCost) return false;
    if (state.durability <= 0) return false;
    if (action.durabilityCost > 0 && state.durability < action.durabilityCost) return false;
    
    state = executeCraftAction(state, action);
    actions.push(action);
    return true;
  };
  
  // 檢查是否有足夠的 CP 完成
  const canFinish = () => {
    const finishAction = carefulSynthesis || basicSynthesis;
    if (!finishAction) return false;
    return state.cp >= finishAction.cpCost;
  };
  
  // 獲取內靜層數
  const getInnerQuiet = () => {
    const buff = state.buffs.find(b => b.name === 'InnerQuiet');
    return buff?.stacks || 0;
  };
  
  // 檢查是否有 buff
  const hasBuff = (name: string) => state.buffs.some(b => b.name === name);
  
  // 第一步: 堅信 或 閃電
  if (muscleMemory && state.progress === 0) {
    doAction(muscleMemory);
  } else if (reflect && state.progress === 0) {
    doAction(reflect);
  }
  
  // 根據配方難度決定策略
  const needsMoreProgress = () => state.progress < recipe.difficulty;
  const needsMoreQuality = () => state.quality < recipe.quality;
  const progressPercent = () => state.progress / recipe.difficulty;
  const qualityPercent = () => state.quality / recipe.quality;
  
  // 主循環
  let maxIterations = 50;
  while (!state.isComplete && maxIterations-- > 0) {
    // 耐久度管理
    if (state.durability <= 10 && useManipulation && !hasBuff('Manipulation')) {
      if (doAction(manipulation)) continue;
    }
    if (state.durability <= 15 && mastersMend) {
      if (doAction(mastersMend)) continue;
    }
    
    // 如果進度快完成了，先確保品質
    if (progressPercent() >= 0.9 && needsMoreQuality() && state.durability > 10) {
      // 嘗試加品質
      if (!hasBuff('Innovation') && innovation && state.cp >= innovation.cpCost + 50) {
        doAction(innovation);
        continue;
      }
      
      // 使用比爾格的祝福
      if (getInnerQuiet() >= 8 && byregots && greatStrides) {
        if (!hasBuff('GreatStrides') && state.cp >= greatStrides.cpCost + byregots.cpCost) {
          doAction(greatStrides);
          continue;
        }
        if (hasBuff('GreatStrides')) {
          doAction(byregots);
          continue;
        }
      }
      
      // 普通加品質
      if (prudentTouch && !hasBuff('WasteNot') && !hasBuff('WasteNot2')) {
        doAction(prudentTouch);
        continue;
      }
      if (basicTouch) {
        doAction(basicTouch);
        continue;
      }
    }
    
    // 品質階段
    if (needsMoreQuality() && state.durability > 10 && getInnerQuiet() < 10) {
      // 使用改革
      if (!hasBuff('Innovation') && innovation && state.cp >= innovation.cpCost + 100) {
        doAction(innovation);
        continue;
      }
      
      // 儉約
      if (useWasteNot && !hasBuff('WasteNot') && !hasBuff('WasteNot2')) {
        if (wasteNot2 && state.cp >= wasteNot2.cpCost + 100) {
          doAction(wasteNot2);
          continue;
        }
        if (wasteNot && state.cp >= wasteNot.cpCost + 50) {
          doAction(wasteNot);
          continue;
        }
      }
      
      // 連擊加工
      if (basicTouch && standardTouch && advancedTouch) {
        const lastAction = actions[actions.length - 1];
        if (lastAction?.id === 'standard_touch' && state.cp >= advancedTouch.cpCost) {
          doAction(advancedTouch);
          continue;
        }
        if (lastAction?.id === 'basic_touch' && state.cp >= standardTouch.cpCost) {
          doAction(standardTouch);
          continue;
        }
        if (state.cp >= basicTouch.cpCost) {
          doAction(basicTouch);
          continue;
        }
      }
      
      // 謹慎加工
      if (prudentTouch && !hasBuff('WasteNot') && !hasBuff('WasteNot2')) {
        doAction(prudentTouch);
        continue;
      }
    }
    
    // 完成進度
    if (needsMoreProgress()) {
      // 崇敬
      if (!hasBuff('Veneration') && veneration && state.cp >= veneration.cpCost + 20) {
        doAction(veneration);
        continue;
      }
      
      // 坯料加工
      if (groundwork && state.durability >= 20) {
        doAction(groundwork);
        continue;
      }
      
      // 模範製作
      if (carefulSynthesis) {
        doAction(carefulSynthesis);
        continue;
      }
      
      // 基本製作
      if (basicSynthesis) {
        doAction(basicSynthesis);
        continue;
      }
    }
    
    // 已經完成
    if (state.isComplete) break;
    
    // 如果什麼都做不了，嘗試基本製作完成
    if (basicSynthesis && needsMoreProgress()) {
      doAction(basicSynthesis);
    }
    
    break;
  }
  
  return actions;
}

// ============================================
// 巨集生成函數
// ============================================

function generateMacroText(actions: CraftAction[]): string {
  const lines: string[] = [];
  
  for (const action of actions) {
    lines.push(`/ac "${action.name}" <wait.3>`);
  }
  
  // 添加音效提示
  lines.push('/echo Macro finished! <se.1>');
  
  return lines.join('\n');
}

function generateMultiMacro(actions: CraftAction[], maxLines: number = 14): string[] {
  const macros: string[] = [];
  let currentMacro: string[] = [];
  
  for (const action of actions) {
    currentMacro.push(`/ac "${action.name}" <wait.3>`);
    
    if (currentMacro.length >= maxLines) {
      currentMacro.push('/echo Next macro <se.9>');
      macros.push(currentMacro.join('\n'));
      currentMacro = [];
    }
  }
  
  // 添加最後一段
  if (currentMacro.length > 0) {
    currentMacro.push('/echo Craft complete! <se.1>');
    macros.push(currentMacro.join('\n'));
  }
  
  return macros;
}

// ============================================
// 輔助函數
// ============================================

function getCategoryPillColor(category: string): string {
  const colors: Record<string, string> = {
    progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    quality: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    durability: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    buff: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  };
  return colors[category] || 'bg-gray-100 text-gray-700';
}
