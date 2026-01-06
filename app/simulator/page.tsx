'use client';

import { useState, useMemo } from 'react';
import { CraftingSimulator } from '@/components/crafting-simulator';
import type { Recipe, CrafterStats, CraftJob } from '@/types';
import { CraftJobNames } from '@/types';

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
  // 預設配方等級參數 (Lv90 星級配方參考值)
  progressDivider: 130,
  progressModifier: 80,
  qualityDivider: 115,
  qualityModifier: 70,
  conditionsFlag: 15,
};

export default function SimulatorPage() {
  // 製作者屬性設定
  const [crafterStats, setCrafterStats] = useState<CrafterStats>({
    job: 'CRP',
    level: 90,
    craftsmanship: 3500,
    control: 3500,
    cp: 600,
    specialist: false,
  });

  // 配方設定（可調整）
  const [recipeSettings, setRecipeSettings] = useState({
    level: 90,
    difficulty: 3500,
    durability: 80,
    quality: 7200,
  });

  // 組合配方
  const recipe: Recipe = useMemo(
    () => ({
      ...demoRecipe,
      recipeLevel: recipeSettings.level,
      difficulty: recipeSettings.difficulty,
      durability: recipeSettings.durability,
      quality: recipeSettings.quality,
      craftType: crafterStats.job,
    }),
    [recipeSettings, crafterStats.job]
  );

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
              {/* 職業選擇 */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">職業</label>
                <select
                  value={crafterStats.job}
                  onChange={(e) =>
                    setCrafterStats({
                      ...crafterStats,
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
                  value={crafterStats.level}
                  onChange={(e) =>
                    setCrafterStats({
                      ...crafterStats,
                      level: parseInt(e.target.value) || 1,
                    })
                  }
                  min={1}
                  max={100}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                />
              </div>

              {/* 作業精度 */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">
                  作業精度
                </label>
                <input
                  type="number"
                  value={crafterStats.craftsmanship}
                  onChange={(e) =>
                    setCrafterStats({
                      ...crafterStats,
                      craftsmanship: parseInt(e.target.value) || 0,
                    })
                  }
                  min={0}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                />
              </div>

              {/* 加工精度 */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">
                  加工精度
                </label>
                <input
                  type="number"
                  value={crafterStats.control}
                  onChange={(e) =>
                    setCrafterStats({
                      ...crafterStats,
                      control: parseInt(e.target.value) || 0,
                    })
                  }
                  min={0}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                />
              </div>

              {/* CP */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">
                  製作力 (CP)
                </label>
                <input
                  type="number"
                  value={crafterStats.cp}
                  onChange={(e) =>
                    setCrafterStats({
                      ...crafterStats,
                      cp: parseInt(e.target.value) || 0,
                    })
                  }
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
            </div>
          </div>
        </div>

        {/* 模擬器 */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <CraftingSimulator
            recipe={recipe}
            crafterStats={crafterStats}
          />
        </div>
      </div>
    </div>
  );
}
