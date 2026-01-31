// ============================================
// 求解器設定彈窗元件
// 整合食物藥水、製作者數值、初期品質等設定
// 參考 ffxiv-best-craft 設計，優化 UI/UX
// ============================================

'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Enhancer,
  MEALS,
  MEDICINES,
  SOUL_OF_THE_CRAFTER,
  calculateEnhancedAttributes,
  getEnhancerDisplayName,
  getEnhancerEffectText,
  CRAFTER_PRESETS,
} from '@/data/enhancers';
import type { Recipe, CrafterStats, RecipeIngredient } from '@/types';
import type { RaphaelSolverOptions } from '@/lib/simulator/solver';

// ============================================
// 類型定義
// ============================================

export interface MaterialWithQuality {
  itemId: number;
  itemName: string;
  itemLevel: number;
  amount: number;
  hqAmount: number;
  canBeHQ: boolean;
}

// Re-export for convenience
export type { RaphaelSolverOptions } from '@/lib/simulator/solver';

export interface SolverSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: Recipe;
  initialCrafterStats: CrafterStats;
  onApply: (settings: {
    crafterStats: CrafterStats;
    solverOptions: RaphaelSolverOptions;
  }) => void;
  onSolve?: (settings: {
    crafterStats: CrafterStats;
    solverOptions: RaphaelSolverOptions;
  }) => void;
  isSolving?: boolean;
}

// ============================================
// 主要彈窗元件
// ============================================

export function SolverSettingsDialog({
  isOpen,
  onClose,
  recipe,
  initialCrafterStats,
  onApply,
  onSolve,
  isSolving = false,
}: SolverSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<'enhancers' | 'stats' | 'quality' | 'solver'>('enhancers');
  
  // 食物藥水狀態
  const [meal, setMeal] = useState<Enhancer | undefined>();
  const [medicine, setMedicine] = useState<Enhancer | undefined>();
  const [useSoulOfCrafter, setUseSoulOfCrafter] = useState(false);
  
  // 製作者數值狀態
  const [crafterStats, setCrafterStats] = useState<CrafterStats>(initialCrafterStats);
  
  // 初期品質狀態
  const [initialQuality, setInitialQuality] = useState(0);
  const [qualityInputMode, setQualityInputMode] = useState<'manual' | 'materials'>('manual');
  const [materials, setMaterials] = useState<MaterialWithQuality[]>([]);
  
  // 求解器選項狀態
  const [solverOptions, setSolverOptions] = useState<RaphaelSolverOptions>({
    useManipulation: true,
    useHeartAndSoul: false,
    useQuickInnovation: false,
    useTrainedEye: false,
    backloadProgress: false,
    adversarial: false,
  });

  // 計算增強後的屬性
  const enhancedStats = useMemo(() => {
    const enhancers: Enhancer[] = [];
    if (meal) enhancers.push(meal);
    if (medicine) enhancers.push(medicine);
    if (useSoulOfCrafter) enhancers.push(SOUL_OF_THE_CRAFTER);

    return calculateEnhancedAttributes(crafterStats, enhancers);
  }, [crafterStats, meal, medicine, useSoulOfCrafter]);

  // 初始化材料列表
  useEffect(() => {
    if (recipe.ingredients) {
      const mats: MaterialWithQuality[] = recipe.ingredients.map((ing: RecipeIngredient) => ({
        itemId: ing.itemId,
        itemName: ing.item?.name_zh || `物品 #${ing.itemId}`,
        itemLevel: ing.item?.itemLevel || 1,
        amount: ing.amount,
        hqAmount: 0,
        canBeHQ: !ing.item?.isUntradable, // 簡化判斷：可交易的通常可以HQ
      }));
      setMaterials(mats);
    }
  }, [recipe]);

  // 基於 HQ 材料計算初期品質
  useEffect(() => {
    if (qualityInputMode === 'materials' && materials.length > 0) {
      const totalLvCount = materials
        .filter(m => m.canBeHQ)
        .reduce((sum, m) => sum + m.amount * m.itemLevel, 0);
      
      const hqLvCount = materials
        .filter(m => m.canBeHQ)
        .reduce((sum, m) => sum + m.hqAmount * m.itemLevel, 0);
      
      const ratio = totalLvCount === 0 ? 0 : hqLvCount / totalLvCount;
      const maxInitQuality = Math.floor(
        recipe.quality * ((recipe.materialQualityFactor || 0) / 100)
      );
      const calculatedQuality = Math.floor(maxInitQuality * ratio);
      
      setInitialQuality(calculatedQuality);
    }
  }, [qualityInputMode, materials, recipe.quality, recipe.materialQualityFactor]);

  // 處理應用設定
  const handleApply = useCallback(() => {
    // 合併增強後的屬性與原始 crafterStats（保留 job, specialist 等）
    const finalStats: CrafterStats = {
      ...crafterStats,
      craftsmanship: enhancedStats.craftsmanship,
      control: enhancedStats.control,
      cp: enhancedStats.cp,
    };
    onApply({
      crafterStats: finalStats,
      solverOptions: { ...solverOptions, initialQuality },
    });
    onClose();
  }, [crafterStats, enhancedStats, solverOptions, initialQuality, onApply, onClose]);

  // 處理開始求解
  const handleSolve = useCallback(() => {
    if (onSolve) {
      const finalStats: CrafterStats = {
        ...crafterStats,
        craftsmanship: enhancedStats.craftsmanship,
        control: enhancedStats.control,
        cp: enhancedStats.cp,
      };
      onSolve({
        crafterStats: finalStats,
        solverOptions: { ...solverOptions, initialQuality },
      });
    }
  }, [crafterStats, enhancedStats, solverOptions, initialQuality, onSolve]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
        {/* 標題列 */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              求解器設定
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {recipe.item?.name_zh || '配方'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 標籤頁 */}
        <div className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex space-x-1 px-6">
            <TabButton
              active={activeTab === 'enhancers'}
              onClick={() => setActiveTab('enhancers')}
            >
              🍖 食物藥水
            </TabButton>
            <TabButton
              active={activeTab === 'stats'}
              onClick={() => setActiveTab('stats')}
            >
              ⚙️ 製作者數值
            </TabButton>
            <TabButton
              active={activeTab === 'quality'}
              onClick={() => setActiveTab('quality')}
            >
              ✨ 初期品質
            </TabButton>
            <TabButton
              active={activeTab === 'solver'}
              onClick={() => setActiveTab('solver')}
            >
              🎯 求解器選項
            </TabButton>
          </div>
        </div>

        {/* 內容區 */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {activeTab === 'enhancers' && (
            <EnhancersTab
              meal={meal}
              medicine={medicine}
              useSoulOfCrafter={useSoulOfCrafter}
              onMealChange={setMeal}
              onMedicineChange={setMedicine}
              onSoulOfCrafterChange={setUseSoulOfCrafter}
              baseStats={crafterStats}
              enhancedStats={enhancedStats}
            />
          )}

          {activeTab === 'stats' && (
            <StatsTab
              stats={crafterStats}
              onStatsChange={setCrafterStats}
            />
          )}

          {activeTab === 'quality' && (
            <QualityTab
              recipe={recipe}
              inputMode={qualityInputMode}
              onInputModeChange={setQualityInputMode}
              initialQuality={initialQuality}
              onInitialQualityChange={setInitialQuality}
              materials={materials}
              onMaterialsChange={setMaterials}
            />
          )}

          {activeTab === 'solver' && (
            <SolverTab
              recipe={recipe}
              options={solverOptions}
              onOptionsChange={setSolverOptions}
            />
          )}
        </div>

        {/* 底部按鈕 */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            取消
          </button>
          <button
            onClick={handleApply}
            className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600"
          >
            應用設定
          </button>
          {onSolve && (
            <button
              onClick={handleSolve}
              disabled={isSolving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {isSolving ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  求解中...
                </span>
              ) : (
                '開始求解'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Tab Button 元件
// ============================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
        active
          ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

// ============================================
// 食物藥水標籤頁
// ============================================

interface EnhancersTabProps {
  meal?: Enhancer;
  medicine?: Enhancer;
  useSoulOfCrafter: boolean;
  onMealChange: (meal?: Enhancer) => void;
  onMedicineChange: (medicine?: Enhancer) => void;
  onSoulOfCrafterChange: (use: boolean) => void;
  baseStats: CrafterStats;
  enhancedStats: ReturnType<typeof calculateEnhancedAttributes>;
}

function EnhancersTab({
  meal,
  medicine,
  useSoulOfCrafter,
  onMealChange,
  onMedicineChange,
  onSoulOfCrafterChange,
  baseStats,
  enhancedStats,
}: EnhancersTabProps) {
  return (
    <div className="space-y-6">
      {/* 食物選擇 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          食物
        </label>
        <select
          value={meal?.id ?? 0}
          onChange={(e) => {
            const id = parseInt(e.target.value);
            if (id === 0) {
              onMealChange(undefined);
            } else {
              const selected = MEALS.find(m => m.id === id);
              onMealChange(selected);
            }
          }}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option value={0}>無</option>
          {MEALS.map((m) => (
            <option key={m.id} value={m.id}>
              {getEnhancerDisplayName(m)} - {getEnhancerEffectText(m)}
            </option>
          ))}
        </select>
      </div>

      {/* 藥水選擇 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          藥水
        </label>
        <select
          value={medicine?.id ?? 0}
          onChange={(e) => {
            const id = parseInt(e.target.value);
            if (id === 0) {
              onMedicineChange(undefined);
            } else {
              const selected = MEDICINES.find(m => m.id === id);
              onMedicineChange(selected);
            }
          }}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option value={0}>無</option>
          {MEDICINES.map((m) => (
            <option key={m.id} value={m.id}>
              {getEnhancerDisplayName(m)} - {getEnhancerEffectText(m)}
            </option>
          ))}
        </select>
      </div>

      {/* 專家之證 */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          專家之證
        </label>
        <input
          type="checkbox"
          checked={useSoulOfCrafter}
          onChange={(e) => onSoulOfCrafterChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      </div>

      {/* 屬性加成顯示 */}
      {(enhancedStats.bonuses.cm > 0 || enhancedStats.bonuses.ct > 0 || enhancedStats.bonuses.cp > 0) && (
        <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
          <h4 className="mb-2 text-sm font-medium text-green-800 dark:text-green-300">
            屬性加成總計
          </h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-600 dark:text-gray-400">作業精度</div>
              <div className="font-semibold text-green-700 dark:text-green-300">
                {baseStats.craftsmanship} → {enhancedStats.craftsmanship}
                <span className="ml-1 text-xs">(+{enhancedStats.bonuses.cm})</span>
              </div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">加工精度</div>
              <div className="font-semibold text-green-700 dark:text-green-300">
                {baseStats.control} → {enhancedStats.control}
                <span className="ml-1 text-xs">(+{enhancedStats.bonuses.ct})</span>
              </div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">CP</div>
              <div className="font-semibold text-green-700 dark:text-green-300">
                {baseStats.cp} → {enhancedStats.cp}
                <span className="ml-1 text-xs">(+{enhancedStats.bonuses.cp})</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// 製作者數值標籤頁
// ============================================

interface StatsTabProps {
  stats: CrafterStats;
  onStatsChange: (stats: CrafterStats) => void;
}

function StatsTab({ stats, onStatsChange }: StatsTabProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>('custom');

  const handlePresetChange = (presetName: string) => {
    setSelectedPreset(presetName);
    const preset = CRAFTER_PRESETS.find(p => p.name === presetName);
    if (preset) {
      onStatsChange({
        ...stats,
        level: preset.level,
        craftsmanship: preset.craftsmanship,
        control: preset.control,
        cp: preset.cp,
      });
    }
  };

  const updateStat = (field: keyof CrafterStats, value: number) => {
    onStatsChange({ ...stats, [field]: value });
    if (field !== 'specialist') {
      setSelectedPreset('自訂');
    }
  };

  return (
    <div className="space-y-6">
      {/* 預設選擇 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          快速選擇配置
        </label>
        <select
          value={selectedPreset}
          onChange={(e) => handlePresetChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          {CRAFTER_PRESETS.map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </select>
      </div>

      {/* 數值輸入 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            等級
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={stats.level}
            onChange={(e) => updateStat('level', parseInt(e.target.value) || 1)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            作業精度
          </label>
          <input
            type="number"
            min={0}
            value={stats.craftsmanship}
            onChange={(e) => updateStat('craftsmanship', parseInt(e.target.value) || 0)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            加工精度
          </label>
          <input
            type="number"
            min={0}
            value={stats.control}
            onChange={(e) => updateStat('control', parseInt(e.target.value) || 0)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            CP
          </label>
          <input
            type="number"
            min={0}
            value={stats.cp}
            onChange={(e) => updateStat('cp', parseInt(e.target.value) || 0)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {/* 專家身份 */}
      <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
        <div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            專家身份
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            解鎖專家技能（需裝備靈魂水晶）
          </div>
        </div>
        <input
          type="checkbox"
          checked={stats.specialist}
          onChange={(e) => onStatsChange({ ...stats, specialist: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      </div>

      {/* 屬性總覽 */}
      <div className="rounded-md bg-blue-50 p-4 dark:bg-blue-900/20">
        <h4 className="mb-2 text-sm font-medium text-blue-800 dark:text-blue-300">
          當前屬性總覽
        </h4>
        <div className="grid grid-cols-4 gap-4 text-center text-sm">
          <div>
            <div className="text-gray-600 dark:text-gray-400">等級</div>
            <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
              {stats.level}
            </div>
          </div>
          <div>
            <div className="text-gray-600 dark:text-gray-400">作業精度</div>
            <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
              {stats.craftsmanship}
            </div>
          </div>
          <div>
            <div className="text-gray-600 dark:text-gray-400">加工精度</div>
            <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
              {stats.control}
            </div>
          </div>
          <div>
            <div className="text-gray-600 dark:text-gray-400">CP</div>
            <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
              {stats.cp}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 初期品質標籤頁
// ============================================

interface QualityTabProps {
  recipe: Recipe;
  inputMode: 'manual' | 'materials';
  onInputModeChange: (mode: 'manual' | 'materials') => void;
  initialQuality: number;
  onInitialQualityChange: (quality: number) => void;
  materials: MaterialWithQuality[];
  onMaterialsChange: (materials: MaterialWithQuality[]) => void;
}

function QualityTab({
  recipe,
  inputMode,
  onInputModeChange,
  initialQuality,
  onInitialQualityChange,
  materials,
  onMaterialsChange,
}: QualityTabProps) {
  const maxInitialQuality = Math.floor(
    recipe.quality * ((recipe.materialQualityFactor || 0) / 100)
  );
  const percentage = recipe.quality > 0 ? Math.round((initialQuality / recipe.quality) * 100) : 0;

  const updateMaterialHQ = (index: number, delta: number) => {
    const newMaterials = [...materials];
    const mat = newMaterials[index];
    const newHQ = Math.max(0, Math.min(mat.amount, mat.hqAmount + delta));
    newMaterials[index] = { ...mat, hqAmount: newHQ };
    onMaterialsChange(newMaterials);
  };

  const setAllMaterialsHQ = (percentage: number) => {
    const newMaterials = materials.map(mat => ({
      ...mat,
      hqAmount: mat.canBeHQ ? Math.floor(mat.amount * (percentage / 100)) : 0,
    }));
    onMaterialsChange(newMaterials);
  };

  return (
    <div className="space-y-6">
      {/* 輸入模式選擇 */}
      <div className="flex gap-2">
        <button
          onClick={() => onInputModeChange('manual')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            inputMode === 'manual'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          手動輸入
        </button>
        <button
          onClick={() => onInputModeChange('materials')}
          disabled={materials.length === 0}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            inputMode === 'materials'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          HQ材料計算
        </button>
      </div>

      {/* 當前初期品質顯示 */}
      <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            初期品質
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {initialQuality.toLocaleString()} / {recipe.quality.toLocaleString()} ({percentage}%)
          </span>
        </div>
        <div className="relative h-4 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
        {maxInitialQuality > 0 && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            材料品質係數: {recipe.materialQualityFactor}% (最大初期品質: {maxInitialQuality.toLocaleString()})
          </div>
        )}
      </div>

      {/* 手動輸入模式 */}
      {inputMode === 'manual' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              品質數值
            </label>
            <input
              type="number"
              min={0}
              max={recipe.quality}
              value={initialQuality}
              onChange={(e) => onInitialQualityChange(Math.min(Math.max(0, parseInt(e.target.value) || 0), recipe.quality))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          <input
            type="range"
            min={0}
            max={recipe.quality}
            value={initialQuality}
            onChange={(e) => onInitialQualityChange(parseInt(e.target.value))}
            className="w-full"
          />

          {maxInitialQuality > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => onInitialQualityChange(0)}
                className="flex-1 rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                0%
              </button>
              <button
                onClick={() => onInitialQualityChange(Math.floor(maxInitialQuality * 0.5))}
                className="flex-1 rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                50%
              </button>
              <button
                onClick={() => onInitialQualityChange(maxInitialQuality)}
                className="flex-1 rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                100%
              </button>
            </div>
          )}
        </div>
      )}

      {/* HQ材料計算模式 */}
      {inputMode === 'materials' && (
        <div className="space-y-4">
          {/* 快捷按鈕 */}
          <div className="flex gap-2">
            <button
              onClick={() => setAllMaterialsHQ(0)}
              className="flex-1 rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              全部 NQ
            </button>
            <button
              onClick={() => setAllMaterialsHQ(50)}
              className="flex-1 rounded-md bg-amber-100 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
            >
              50% HQ
            </button>
            <button
              onClick={() => setAllMaterialsHQ(100)}
              className="flex-1 rounded-md bg-green-100 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
            >
              全部 HQ
            </button>
          </div>

          {/* 材料列表 */}
          <div className="space-y-2">
            {materials.map((mat, index) => (
              <div
                key={mat.itemId}
                className={`rounded-lg border p-3 ${
                  mat.canBeHQ
                    ? 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                    : 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {mat.itemName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      需要: {mat.amount} 個 · 等級: {mat.itemLevel}
                    </div>
                  </div>
                  {!mat.canBeHQ && (
                    <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                      無法HQ
                    </span>
                  )}
                </div>
                
                {mat.canBeHQ && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateMaterialHQ(index, -1)}
                      disabled={mat.hqAmount === 0}
                      className="flex-1 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      NQ: {mat.amount - mat.hqAmount}
                    </button>
                    <button
                      onClick={() => updateMaterialHQ(index, 1)}
                      disabled={mat.hqAmount === mat.amount}
                      className="flex-1 rounded-md bg-blue-100 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                    >
                      HQ: {mat.hqAmount} ★
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {materials.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-900">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                此配方無材料資訊，請使用手動輸入模式
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// 求解器選項標籤頁
// ============================================

interface SolverTabProps {
  recipe: Recipe;
  options: RaphaelSolverOptions;
  onOptionsChange: (options: RaphaelSolverOptions) => void;
}

function SolverTab({ recipe, options, onOptionsChange }: SolverTabProps) {
  const updateOption = <K extends keyof RaphaelSolverOptions>(
    key: K,
    value: RaphaelSolverOptions[K]
  ) => {
    onOptionsChange({ ...options, [key]: value });
  };

  // 根據配方生成目標品質選項
  const targetQualityOptions = useMemo(() => {
    const opts: { label: string; value: number | 'full' }[] = [];
    
    if (!recipe.canHQ) {
      // 收藏品模式
      if (recipe.collectability) {
        opts.push({ label: `一檔 (${recipe.collectability.low})`, value: recipe.collectability.low });
        opts.push({ label: `二檔 (${recipe.collectability.mid})`, value: recipe.collectability.mid });
        opts.push({ label: `三檔 (${recipe.collectability.high})`, value: recipe.collectability.high });
      }
    }
    
    opts.push({ label: '最大品質', value: 'full' });
    
    return opts;
  }, [recipe]);

  return (
    <div className="space-y-6">
      {/* 目標品質 */}
      {targetQualityOptions.length > 1 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            目標品質
          </label>
          <div className="flex flex-wrap gap-2">
            {targetQualityOptions.map((opt) => (
              <button
                key={opt.label}
                onClick={() => updateOption('targetQuality', opt.value === 'full' ? undefined : opt.value)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  (opt.value === 'full' && options.targetQuality === undefined) ||
                  (opt.value !== 'full' && options.targetQuality === opt.value)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 技能開關 */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          使用技能
        </label>
        <div className="grid grid-cols-2 gap-3">
          <CheckboxOption
            label="掌握"
            checked={options.useManipulation ?? true}
            onChange={(checked) => updateOption('useManipulation', checked)}
            description="每回合恢復5耐久"
          />
          <CheckboxOption
            label="專心致志"
            checked={options.useHeartAndSoul ?? false}
            onChange={(checked) => updateOption('useHeartAndSoul', checked)}
            description="無視狀態使用集中技能"
          />
          <CheckboxOption
            label="快速改革"
            checked={options.useQuickInnovation ?? false}
            onChange={(checked) => updateOption('useQuickInnovation', checked)}
            description="立即獲得改革效果"
          />
          <CheckboxOption
            label="工匠的神速技巧"
            checked={options.useTrainedEye ?? false}
            onChange={(checked) => updateOption('useTrainedEye', checked)}
            description="瞬間達到最大品質"
          />
        </div>
      </div>

      {/* 求解器策略 */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          求解器策略
        </label>
        <div className="space-y-3">
          <CheckboxOption
            label="後置作業技能"
            checked={options.backloadProgress ?? false}
            onChange={(checked) => updateOption('backloadProgress', checked)}
            description="優先推品質，最後推進度（更快求解）"
          />
          <CheckboxOption
            label="確保100%可靠"
            checked={options.adversarial ?? false}
            onChange={(checked) => updateOption('adversarial', checked)}
            description="防止最壞情況（防黑球）"
          />
        </div>
      </div>

      {/* 說明 */}
      <div className="rounded-md bg-blue-50 p-4 dark:bg-blue-900/20">
        <div className="flex gap-3">
          <svg className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium">求解器提示：</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
              <li>啟用「後置作業技能」可加快求解速度，但可能需要更高的屬性</li>
              <li>「確保100%可靠」會假設所有狀態為最差，確保穩定完成</li>
              <li>工匠的神速技巧僅在配方等級與製作者等級差距≥10時可用</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Checkbox 選項元件
// ============================================

interface CheckboxOptionProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}

function CheckboxOption({ label, checked, onChange, description }: CheckboxOptionProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {label}
        </div>
        {description && (
          <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {description}
          </div>
        )}
      </div>
    </label>
  );
}

export default SolverSettingsDialog;
