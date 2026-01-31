'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { CraftingSimulatorV2 } from '@/components/crafting-simulator-v2';
import { SolverOptionsPanel } from '@/components/solver-options';
import { CRAFTER_PRESETS } from '@/data/enhancers';
import { getRecipeLevelTable, type RecipeLevel } from '@/lib/recipe-datasource';
import type { Recipe, CrafterStats, CraftJob } from '@/types';
import { CraftJobNames } from '@/types';

// 預設 RecipeLevelTable（Lv90 星級配方）
const defaultRecipeLevel: RecipeLevel = {
  id: 640,
  stars: 0,
  class_job_level: 90,
  suggested_craftsmanship: 3700,
  suggested_control: 3280,
  difficulty: 3500,
  quality: 7200,
  durability: 80,
  progress_divider: 130,
  quality_divider: 115,
  progress_modifier: 80,
  quality_modifier: 70,
  conditions_flag: 15,
};

// 預設配方（用於示範）
const demoRecipe: Recipe = {
  id: 1,
  itemId: 1,
  craftType: 'CRP',
  craftTypeLevel: 1,
  recipeLevel: 90,
  difficulty: 3500,
  durability: 80,
  quality: 7200,
  requiredCraftsmanship: 3200,
  requiredControl: 3200,
  ingredients: [],
  canQuickSynth: true,
  canHQ: true,
  stars: 0,
  // 材料品質係數（預設 75%）
  materialQualityFactor: 75,
  // 預設配方等級參數 (Lv90 星級配方參考值)
  progressDivider: 130,
  progressModifier: 80,
  qualityDivider: 115,
  qualityModifier: 70,
  conditionsFlag: 15,
  // RecipeLevelTable 基礎值（WASM 求解器需要）
  baseDifficulty: 3500,
  baseQuality: 7200,
  baseDurability: 80,
  recipeLevelId: 640,
};

export default function SimulatorPage() {
  // 製作者基礎屬性設定
  const [baseCrafterStats, setBaseCrafterStats] = useState<CrafterStats>({
    job: 'CRP',
    level: 90,
    craftsmanship: 3500,
    control: 3500,
    cp: 600,
    specialist: false,
  });

  // 增強後的屬性（含食物藥水加成）
  const [enhancedStats, setEnhancedStats] = useState<CrafterStats>(baseCrafterStats);

  // 配方設定（可調整）
  const [recipeSettings, setRecipeSettings] = useState({
    level: 90,
    difficulty: 3500,
    durability: 80,
    quality: 7200,
    materialQualityFactor: 75,
    isCollectable: false,
    collectability: {
      low: 1000,
      mid: 2000,
      high: 3000,
    },
  });

  // 目前使用的 RecipeLevelTable（用於 WASM 求解器的精確計算）
  const [currentRecipeLevel, setCurrentRecipeLevel] = useState<RecipeLevel>(defaultRecipeLevel);
  
  // 是否正在載入 RecipeLevelTable
  const [isLoadingRecipeLevel, setIsLoadingRecipeLevel] = useState(false);
  
  // 是否自動同步 RecipeLevelTable（預設啟用）
  const [autoSyncRecipeLevel, setAutoSyncRecipeLevel] = useState(true);

  // 預設選擇
  const [selectedPreset, setSelectedPreset] = useState<string>(CRAFTER_PRESETS[0].name);
  
  // 當配方等級變更時，自動取得對應的 RecipeLevelTable
  useEffect(() => {
    if (!autoSyncRecipeLevel) return;
    
    let cancelled = false;
    const requestedLevel = recipeSettings.level; // 捕獲當前請求的等級
    
    const fetchRecipeLevel = async () => {
      setIsLoadingRecipeLevel(true);
      console.log('[SimulatorPage] 開始取得 RecipeLevelTable, level=', requestedLevel);
      
      try {
        // 使用 recipeLevelTableByJobLevel API 取得配方等級表
        const url = `https://tnze.yyyy.games/api/datasource/zh-TW/recipe_level_table_by_job_level?job_level=${requestedLevel}`;
        console.log('[SimulatorPage] API URL:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Failed to fetch');
        
        const data = await response.json();
        console.log('[SimulatorPage] API 回應:', {
          requestedLevel,
          responseLevel: data.class_job_level,
          quality_divider: data.quality_divider,
          cancelled,
        });
        
        if (!cancelled && data) {
          // 再次驗證回應的等級是否匹配請求的等級
          if (data.class_job_level !== requestedLevel) {
            console.warn('[SimulatorPage] 等級不匹配！請求=', requestedLevel, '回應=', data.class_job_level);
          }
          
          const newRecipeLevel: RecipeLevel = {
            id: data.id,
            stars: 0,
            class_job_level: data.class_job_level,
            suggested_craftsmanship: data.suggested_craftsmanship,
            suggested_control: data.suggested_control || 0,
            difficulty: data.difficulty,
            quality: data.quality,
            durability: data.durability,
            progress_divider: data.progress_divider,
            quality_divider: data.quality_divider,
            progress_modifier: data.progress_modifier,
            quality_modifier: data.quality_modifier,
            conditions_flag: data.conditions_flag,
          };
          
          setCurrentRecipeLevel(newRecipeLevel);
          
          console.log('[SimulatorPage] RecipeLevelTable 更新完成:', {
            level: requestedLevel,
            baseDifficulty: newRecipeLevel.difficulty,
            baseQuality: newRecipeLevel.quality,
            baseDurability: newRecipeLevel.durability,
            progressDivider: newRecipeLevel.progress_divider,
            qualityDivider: newRecipeLevel.quality_divider,
          });
        }
      } catch (error) {
        console.warn('[SimulatorPage] 無法取得 RecipeLevelTable，使用預設值:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingRecipeLevel(false);
        }
      }
    };
    
    fetchRecipeLevel();
    
    return () => {
      console.log('[SimulatorPage] 取消 RecipeLevelTable 請求, level=', requestedLevel);
      cancelled = true;
    };
  }, [recipeSettings.level, autoSyncRecipeLevel]);

  // 檢查 RecipeLevelTable 是否與配方等級匹配
  const isRecipeLevelSynced = currentRecipeLevel.class_job_level === recipeSettings.level;

  // 組合配方（包含 RecipeLevelTable 基礎值）
  const recipe: Recipe = useMemo(
    () => {
      const result = {
        ...demoRecipe,
        recipeLevel: recipeSettings.level,
        difficulty: recipeSettings.difficulty,
        durability: recipeSettings.durability,
        quality: recipeSettings.quality,
        materialQualityFactor: recipeSettings.materialQualityFactor,
        craftType: baseCrafterStats.job,
        // 使用 RecipeLevelTable 的參數
        progressDivider: currentRecipeLevel.progress_divider,
        progressModifier: currentRecipeLevel.progress_modifier,
        qualityDivider: currentRecipeLevel.quality_divider,
        qualityModifier: currentRecipeLevel.quality_modifier,
        conditionsFlag: currentRecipeLevel.conditions_flag,
        // 傳遞 RecipeLevelTable 基礎值給 WASM 求解器
        baseDifficulty: currentRecipeLevel.difficulty,
        baseQuality: currentRecipeLevel.quality,
        baseDurability: currentRecipeLevel.durability,
        recipeLevelId: currentRecipeLevel.id,
      };
      
      // 調試日誌：顯示配方物件的關鍵參數
      console.log('[SimulatorPage] Recipe 物件建構:', {
        recipeLevel: result.recipeLevel,
        'rlv.class_job_level': currentRecipeLevel.class_job_level,
        'rlv.id': currentRecipeLevel.id,
        difficulty: result.difficulty,
        baseDifficulty: result.baseDifficulty,
        quality: result.quality,
        baseQuality: result.baseQuality,
        qualityDivider: result.qualityDivider,
        isRecipeLevelSynced,
      });
      
      return result;
    },
    [recipeSettings, baseCrafterStats.job, currentRecipeLevel, isRecipeLevelSynced]
  );

  // 處理預設選擇變更
  const handlePresetChange = useCallback((presetName: string) => {
    setSelectedPreset(presetName);
    const preset = CRAFTER_PRESETS.find(p => p.name === presetName);
    if (preset && presetName !== '自訂') {
      setBaseCrafterStats(prev => ({
        ...prev,
        level: preset.level,
        craftsmanship: preset.craftsmanship,
        control: preset.control,
        cp: preset.cp,
      }));
    }
  }, []);

  // 處理增強後屬性變更
  const handleStatsChange = useCallback((stats: CrafterStats) => {
    setEnhancedStats(stats);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">生產模擬器</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 設定面板 */}
        <div className="space-y-6">
          {/* 製作者屬性 */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4">製作者屬性</h2>
            
            <div className="space-y-4">
              {/* 預設選擇 */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">預設裝備</label>
                <select
                  value={selectedPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                >
                  {CRAFTER_PRESETS.map((preset) => (
                    <option key={preset.name} value={preset.name}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 職業選擇 */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">職業</label>
                <select
                  value={baseCrafterStats.job}
                  onChange={(e) =>
                    setBaseCrafterStats({
                      ...baseCrafterStats,
                      job: e.target.value as CraftJob,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                >
                  {Object.entries(CraftJobNames).map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 等級 */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">等級</label>
                <input
                  type="number"
                  value={baseCrafterStats.level}
                  onChange={(e) => {
                    setSelectedPreset('自訂');
                    setBaseCrafterStats({
                      ...baseCrafterStats,
                      level: parseInt(e.target.value) || 1,
                    });
                  }}
                  min={1}
                  max={100}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                />
              </div>

              {/* 作業精度 */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">
                  作業精度
                  {enhancedStats.craftsmanship > baseCrafterStats.craftsmanship && (
                    <span className="text-green-600 ml-2">
                      (+{enhancedStats.craftsmanship - baseCrafterStats.craftsmanship})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  value={baseCrafterStats.craftsmanship}
                  onChange={(e) => {
                    setSelectedPreset('自訂');
                    setBaseCrafterStats({
                      ...baseCrafterStats,
                      craftsmanship: parseInt(e.target.value) || 0,
                    });
                  }}
                  min={0}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                />
              </div>

              {/* 加工精度 */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">
                  加工精度
                  {enhancedStats.control > baseCrafterStats.control && (
                    <span className="text-green-600 ml-2">
                      (+{enhancedStats.control - baseCrafterStats.control})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  value={baseCrafterStats.control}
                  onChange={(e) => {
                    setSelectedPreset('自訂');
                    setBaseCrafterStats({
                      ...baseCrafterStats,
                      control: parseInt(e.target.value) || 0,
                    });
                  }}
                  min={0}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                />
              </div>

              {/* CP */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">
                  製作力 (CP)
                  {enhancedStats.cp > baseCrafterStats.cp && (
                    <span className="text-green-600 ml-2">
                      (+{enhancedStats.cp - baseCrafterStats.cp})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  value={baseCrafterStats.cp}
                  onChange={(e) => {
                    setSelectedPreset('自訂');
                    setBaseCrafterStats({
                      ...baseCrafterStats,
                      cp: parseInt(e.target.value) || 0,
                    });
                  }}
                  min={0}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                />
              </div>
            </div>
          </div>

          {/* 配方設定 */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4">配方設定</h2>
            
            <div className="space-y-4">
              {/* 配方等級 */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">
                  配方等級
                </label>
                <input
                  type="number"
                  value={recipeSettings.level}
                  onChange={(e) =>
                    setRecipeSettings({
                      ...recipeSettings,
                      level: parseInt(e.target.value) || 1,
                    })
                  }
                  min={1}
                  max={100}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                />
              </div>

              {/* 難度 */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">難度</label>
                <input
                  type="number"
                  value={recipeSettings.difficulty}
                  onChange={(e) =>
                    setRecipeSettings({
                      ...recipeSettings,
                      difficulty: parseInt(e.target.value) || 100,
                    })
                  }
                  min={100}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                />
              </div>

              {/* 耐久度 */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">
                  耐久度
                </label>
                <input
                  type="number"
                  value={recipeSettings.durability}
                  onChange={(e) =>
                    setRecipeSettings({
                      ...recipeSettings,
                      durability: parseInt(e.target.value) || 10,
                    })
                  }
                  min={10}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                />
              </div>

              {/* 最大品質 */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">
                  最大品質
                </label>
                <input
                  type="number"
                  value={recipeSettings.quality}
                  onChange={(e) =>
                    setRecipeSettings({
                      ...recipeSettings,
                      quality: parseInt(e.target.value) || 1000,
                    })
                  }
                  min={1000}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                />
              </div>

              {/* 材料品質係數 */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">
                  材料品質係數 (%)
                </label>
                <input
                  type="number"
                  value={recipeSettings.materialQualityFactor}
                  onChange={(e) =>
                    setRecipeSettings({
                      ...recipeSettings,
                      materialQualityFactor: parseInt(e.target.value) || 0,
                    })
                  }
                  min={0}
                  max={100}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                />
                <p className="text-xs text-gray-400 mt-1">
                  初期品質最大值 = 最大品質 × 材料品質係數
                </p>
              </div>

              {/* 收藏品設定 */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recipeSettings.isCollectable}
                    onChange={(e) =>
                      setRecipeSettings({
                        ...recipeSettings,
                        isCollectable: e.target.checked,
                      })
                    }
                    className="rounded text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    收藏品配方
                  </span>
                </label>
                {recipeSettings.isCollectable && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">普通</label>
                      <input
                        type="number"
                        value={recipeSettings.collectability.low}
                        onChange={(e) =>
                          setRecipeSettings({
                            ...recipeSettings,
                            collectability: {
                              ...recipeSettings.collectability,
                              low: parseInt(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-cyan-500 mb-1">精選</label>
                      <input
                        type="number"
                        value={recipeSettings.collectability.mid}
                        onChange={(e) =>
                          setRecipeSettings({
                            ...recipeSettings,
                            collectability: {
                              ...recipeSettings.collectability,
                              mid: parseInt(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-yellow-500 mb-1">特選</label>
                      <input
                        type="number"
                        value={recipeSettings.collectability.high}
                        onChange={(e) =>
                          setRecipeSettings({
                            ...recipeSettings,
                            collectability: {
                              ...recipeSettings.collectability,
                              high: parseInt(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              {/* RecipeLevelTable 自動同步 */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSyncRecipeLevel}
                    onChange={(e) => setAutoSyncRecipeLevel(e.target.checked)}
                    className="rounded text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    自動載入配方等級表
                  </span>
                  {isLoadingRecipeLevel && (
                    <span className="text-blue-500">⏳</span>
                  )}
                </label>
                <p className="text-xs text-gray-400 mt-1">
                  根據配方等級自動取得進度/品質計算參數
                </p>
              </div>
              
              {/* RecipeLevelTable 資訊顯示 */}
              {autoSyncRecipeLevel && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs">
                  <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                    📊 配方等級表 (Lv.{currentRecipeLevel.class_job_level})
                    {isLoadingRecipeLevel && (
                      <span className="ml-2 text-yellow-500">載入中...</span>
                    )}
                    {!isLoadingRecipeLevel && !isRecipeLevelSynced && (
                      <span className="ml-2 text-red-500">
                        ⚠️ 等級不匹配！(設定: Lv.{recipeSettings.level})
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-gray-500">
                    <div>基礎難度: {currentRecipeLevel.difficulty}</div>
                    <div>基礎品質: {currentRecipeLevel.quality}</div>
                    <div>作業係數: {currentRecipeLevel.progress_divider}</div>
                    <div>加工係數: {currentRecipeLevel.quality_divider}</div>
                    <div>作業修正: {currentRecipeLevel.progress_modifier}%</div>
                    <div>加工修正: {currentRecipeLevel.quality_modifier}%</div>
                  </div>
                  {!isRecipeLevelSynced && !isLoadingRecipeLevel && (
                    <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-red-600 dark:text-red-400">
                      RecipeLevelTable 與配方等級不同步。
                      <br />
                      目前 Lv.{currentRecipeLevel.class_job_level} 的基礎品質是 {currentRecipeLevel.quality}，
                      但您設定的配方品質是 {recipeSettings.quality}。
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 求解器選項面板 */}
          <SolverOptionsPanel
            recipe={recipe}
            crafterStats={baseCrafterStats}
            onStatsChange={handleStatsChange}
          />
        </div>

        {/* 模擬器 */}
        <div className="lg:col-span-2 space-y-6">
          <CraftingSimulatorV2
            recipe={recipe}
            crafterStats={enhancedStats}
            recipeName={`Lv.${recipeSettings.level} 配方`}
            collectability={recipeSettings.isCollectable ? recipeSettings.collectability : undefined}
          />
        </div>
      </div>
    </div>
  );
}
