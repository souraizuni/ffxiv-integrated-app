// ============================================
// 求解器選項 UI 元件
// 提供初期品質、食物藥水、求解器設定等功能
// 參考 ffxiv-best-craft RaphaelSolver.vue
// ============================================

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Enhancer,
  MEALS,
  MEDICINES,
  calculateEnhancedAttributes,
} from '@/data/enhancers';
import type { Recipe, CrafterStats } from '@/types';
import type { RaphaelSolverOptions } from '@/lib/simulator/solver';

// ============================================
// 類型定義
// ============================================

export interface SolverOptionsProps {
  recipe: Recipe;
  crafterStats: CrafterStats;
  onStatsChange?: (stats: CrafterStats) => void;
  onOptionsChange?: (options: RaphaelSolverOptions) => void;
  onSolve?: (options: RaphaelSolverOptions) => void;
  isSolving?: boolean;
}

export interface EnhancerSelectorProps {
  enhancers: Enhancer[];
  value?: Enhancer;
  onChange: (enhancer: Enhancer | undefined) => void;
  label: string;
  useHQ?: boolean;
  onUseHQChange?: (useHQ: boolean) => void;
}

// ============================================
// 增強器選擇器元件
// ============================================

export function EnhancerSelector({
  enhancers,
  value,
  onChange,
  label,
  useHQ = true,
  onUseHQChange,
}: EnhancerSelectorProps) {
  // 過濾掉 "None" 選項以便單獨處理
  const validEnhancers = enhancers.filter(e => e.id !== 0);
  const noneOption = enhancers.find(e => e.id === 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        {onUseHQChange && (
          <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <input
              type="checkbox"
              checked={useHQ}
              onChange={(e) => onUseHQChange(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            HQ
          </label>
        )}
      </div>
      <select
        value={value?.id ?? 0}
        onChange={(e) => {
          const id = parseInt(e.target.value);
          if (id === 0) {
            onChange(undefined);
          } else {
            const enhancer = enhancers.find(e => e.id === id);
            onChange(enhancer);
          }
        }}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      >
        <option value={0}>{noneOption?.nameZh ?? '無'}</option>
        {validEnhancers.map((enhancer) => (
          <option key={enhancer.id} value={enhancer.id}>
            {enhancer.nameZh} (IL{enhancer.itemLevel})
          </option>
        ))}
      </select>
    </div>
  );
}

// ============================================
// 初期品質設定元件
// ============================================

export interface InitialQualitySettingProps {
  maxQuality: number;
  materialQualityFactor?: number;
  value: number;
  onChange: (value: number) => void;
}

export function InitialQualitySetting({
  maxQuality,
  materialQualityFactor = 0,
  value,
  onChange,
}: InitialQualitySettingProps) {
  const maxInitialQuality = Math.floor(maxQuality * (materialQualityFactor / 100));
  const percentage = maxQuality > 0 ? Math.round((value / maxQuality) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          初期品質
        </label>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {value.toLocaleString()} / {maxQuality.toLocaleString()} ({percentage}%)
        </span>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          max={maxQuality}
          value={value}
          onChange={(e) => onChange(Math.min(Math.max(0, parseInt(e.target.value) || 0), maxQuality))}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </div>
      {materialQualityFactor > 0 && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange(0)}
            className="flex-1 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            0%
          </button>
          <button
            type="button"
            onClick={() => onChange(Math.floor(maxInitialQuality * 0.5))}
            className="flex-1 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            50%
          </button>
          <button
            type="button"
            onClick={() => onChange(maxInitialQuality)}
            className="flex-1 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            100%
          </button>
        </div>
      )}
      <input
        type="range"
        min={0}
        max={maxQuality}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

// ============================================
// 求解器設定元件
// ============================================

export interface SolverSettingsProps {
  options: RaphaelSolverOptions;
  onChange: (options: RaphaelSolverOptions) => void;
  targetQualityOptions?: { label: string; value: number | 'full' }[];
}

export function SolverSettings({
  options,
  onChange,
  targetQualityOptions,
}: SolverSettingsProps) {
  const updateOption = <K extends keyof RaphaelSolverOptions>(
    key: K,
    value: RaphaelSolverOptions[K]
  ) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <div className="space-y-4">
      {/* 目標品質選擇 */}
      {targetQualityOptions && targetQualityOptions.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            目標品質
          </label>
          <div className="flex flex-wrap gap-2">
            {targetQualityOptions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => updateOption('targetQuality', opt.value === 'full' ? undefined : opt.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
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
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          使用技能
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={options.useManipulation ?? true}
              onChange={(e) => updateOption('useManipulation', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            掌握
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={options.useHeartAndSoul ?? false}
              onChange={(e) => updateOption('useHeartAndSoul', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            專心致志
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={options.useQuickInnovation ?? false}
              onChange={(e) => updateOption('useQuickInnovation', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            快速改革
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={options.useTrainedEye ?? false}
              onChange={(e) => updateOption('useTrainedEye', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            工匠的神速技巧
          </label>
        </div>
      </div>

      {/* 求解器選項 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          求解器選項
        </label>
        <div className="grid grid-cols-1 gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={options.backloadProgress ?? false}
              onChange={(e) => updateOption('backloadProgress', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            後置作業技能（快速求解）
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={options.adversarial ?? false}
              onChange={(e) => updateOption('adversarial', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            確保 100% 可靠（防黑球）
          </label>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 完整求解器選項面板
// ============================================

export function SolverOptionsPanel({
  recipe,
  crafterStats,
  onStatsChange,
  onOptionsChange,
  onSolve,
  isSolving = false,
}: SolverOptionsProps) {
  // 狀態
  const [meal, setMeal] = useState<Enhancer | undefined>();
  const [medicine, setMedicine] = useState<Enhancer | undefined>();
  const [useMealHQ, setUseMealHQ] = useState(true);
  const [useMedicineHQ, setUseMedicineHQ] = useState(true);
  const [initialQuality, setInitialQuality] = useState(0);
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
    if (meal) enhancers.push({ ...meal, hqMultiplier: useMealHQ ? 1.5 : 1 });
    if (medicine) enhancers.push({ ...medicine, hqMultiplier: useMedicineHQ ? 1.5 : 1 });

    // 計算食物藥水的加成
    const mealResult = meal ? calculateEnhancedAttributes(crafterStats, [meal], useMealHQ) : null;
    const medicineResult = medicine ? calculateEnhancedAttributes(crafterStats, [medicine], useMedicineHQ) : null;

    // 合併加成
    let totalCmBonus = 0;
    let totalCtBonus = 0;
    let totalCpBonus = 0;

    if (mealResult) {
      totalCmBonus += mealResult.bonuses.cm;
      totalCtBonus += mealResult.bonuses.ct;
      totalCpBonus += mealResult.bonuses.cp;
    }
    if (medicineResult) {
      totalCmBonus += medicineResult.bonuses.cm;
      totalCtBonus += medicineResult.bonuses.ct;
      totalCpBonus += medicineResult.bonuses.cp;
    }

    return {
      ...crafterStats,
      craftsmanship: crafterStats.craftsmanship + totalCmBonus,
      control: crafterStats.control + totalCtBonus,
      cp: crafterStats.cp + totalCpBonus,
      bonuses: {
        craftsmanship: totalCmBonus,
        control: totalCtBonus,
        cp: totalCpBonus,
      },
    };
  }, [crafterStats, meal, medicine, useMealHQ, useMedicineHQ]);

  // 當屬性變更時通知父元件
  React.useEffect(() => {
    onStatsChange?.(enhancedStats);
  }, [enhancedStats, onStatsChange]);

  // 當選項變更時通知父元件
  React.useEffect(() => {
    onOptionsChange?.({ ...solverOptions, initialQuality });
  }, [solverOptions, initialQuality, onOptionsChange]);

  // 建立目標品質選項
  const targetQualityOptions = useMemo(() => {
    const opts: { label: string; value: number | 'full' }[] = [];
    
    // 如果是收藏品，添加階段選項
    if (recipe.canHQ === false) {
      // 假設這是收藏品，添加典型的收藏品目標
      const quality = recipe.quality;
      opts.push({ label: '一階', value: Math.floor(quality * 0.3) });
      opts.push({ label: '二階', value: Math.floor(quality * 0.6) });
      opts.push({ label: '三階', value: Math.floor(quality * 0.9) });
    }
    
    opts.push({ label: '最大', value: 'full' });
    
    return opts;
  }, [recipe]);

  // 處理求解
  const handleSolve = useCallback(() => {
    onSolve?.({
      ...solverOptions,
      initialQuality,
    });
  }, [solverOptions, initialQuality, onSolve]);

  return (
    <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* 食物藥水選擇 */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          食物與藥水
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <EnhancerSelector
            enhancers={MEALS}
            value={meal}
            onChange={setMeal}
            label="食物"
            useHQ={useMealHQ}
            onUseHQChange={setUseMealHQ}
          />
          <EnhancerSelector
            enhancers={MEDICINES}
            value={medicine}
            onChange={setMedicine}
            label="藥水"
            useHQ={useMedicineHQ}
            onUseHQChange={setUseMedicineHQ}
          />
        </div>

        {/* 顯示屬性加成 */}
        {(enhancedStats.bonuses?.craftsmanship || enhancedStats.bonuses?.control || enhancedStats.bonuses?.cp) && (
          <div className="rounded-md bg-green-50 p-3 dark:bg-green-900/20">
            <div className="text-sm text-green-700 dark:text-green-300">
              <span className="font-medium">屬性加成：</span>
              {enhancedStats.bonuses.craftsmanship > 0 && (
                <span className="ml-2">
                  作業 +{enhancedStats.bonuses.craftsmanship}
                </span>
              )}
              {enhancedStats.bonuses.control > 0 && (
                <span className="ml-2">
                  加工 +{enhancedStats.bonuses.control}
                </span>
              )}
              {enhancedStats.bonuses.cp > 0 && (
                <span className="ml-2">
                  CP +{enhancedStats.bonuses.cp}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 初期品質設定 */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          初期品質
        </h3>
        <InitialQualitySetting
          maxQuality={recipe.quality}
          materialQualityFactor={recipe.materialQualityFactor}
          value={initialQuality}
          onChange={setInitialQuality}
        />
      </div>

      {/* 求解器設定 */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          求解器設定
        </h3>
        <SolverSettings
          options={solverOptions}
          onChange={setSolverOptions}
          targetQualityOptions={targetQualityOptions}
        />
      </div>

      {/* 求解按鈕 */}
      {onSolve && (
        <button
          type="button"
          onClick={handleSolve}
          disabled={isSolving}
          className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {isSolving ? (
            <span className="flex items-center justify-center gap-2">
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
            '開始求解 (Raphael)'
          )}
        </button>
      )}
    </div>
  );
}

export default SolverOptionsPanel;
