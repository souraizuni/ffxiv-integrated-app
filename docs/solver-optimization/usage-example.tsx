// ============================================
// 求解器設定彈窗使用示例
// 展示如何在生產指引頁面中整合
// ============================================

'use client';

import { useState } from 'react';
import { SolverSettingsDialog } from '@/components/solver-settings-dialog';
import type { Recipe, CrafterStats } from '@/types';

// ============================================
// 示例：在生產指引頁面中使用
// ============================================

export default function ProductionPageExample() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  
  // 示例配方數據
  const exampleRecipe: Recipe = {
    id: 1,
    itemId: 12345,
    item: {
      id: 12345,
      name: '魔匠之杖',
      name_en: 'Craftsman\'s Staff',
      name_ja: '魔匠の杖',
      name_zh: '魔匠之杖',
      icon: '',
      iconUrl: '',
      itemLevel: 100,
      stackSize: 1,
      isUntradable: false,
      categoryId: 1,
      categoryName: 'Weapon',
    },
    craftType: 'CRP',
    craftTypeLevel: 100,
    recipeLevel: 680,
    difficulty: 6600,
    durability: 70,
    quality: 12000,
    requiredCraftsmanship: 4200,
    requiredControl: 4000,
    ingredients: [
      {
        itemId: 10001,
        item: {
          id: 10001,
          name: '特級木材',
          name_en: 'Special Lumber',
          name_ja: '特級木材',
          name_zh: '特級木材',
          icon: '',
          iconUrl: '',
          itemLevel: 90,
          stackSize: 99,
          isUntradable: false,
          categoryId: 2,
          categoryName: 'Material',
        },
        amount: 3,
        isHQ: false,
      },
      {
        itemId: 10002,
        item: {
          id: 10002,
          name: '魔力水晶',
          name_en: 'Magic Crystal',
          name_ja: '魔力水晶',
          name_zh: '魔力水晶',
          icon: '',
          iconUrl: '',
          itemLevel: 95,
          stackSize: 99,
          isUntradable: false,
          categoryId: 2,
          categoryName: 'Material',
        },
        amount: 2,
        isHQ: false,
      },
    ],
    canQuickSynth: false,
    canHQ: true,
    stars: 3,
    amountResult: 1,
    progressDivider: 130,
    progressModifier: 80,
    qualityDivider: 115,
    qualityModifier: 70,
    conditionsFlag: 15,
    materialQualityFactor: 50, // 材料品質係數 50%
    recipeLevelId: 680,
  };

  // 示例製作者屬性
  const [crafterStats, setCrafterStats] = useState<CrafterStats>({
    job: 'CRP',
    level: 100,
    craftsmanship: 4956,
    control: 4963,
    cp: 687,
    specialist: true,
  });

  // 處理應用設定
  const handleApplySettings = (settings: {
    crafterStats: CrafterStats;
    solverOptions: any;
  }) => {
    console.log('應用設定:', settings);
    setCrafterStats(settings.crafterStats);
    // 這裡可以更新其他狀態，比如將設定保存到 localStorage
    alert('設定已應用！');
  };

  // 處理開始求解
  const handleSolve = async (settings: {
    crafterStats: CrafterStats;
    solverOptions: any;
  }) => {
    console.log('開始求解:', settings);
    setIsSolving(true);
    
    try {
      // 這裡調用實際的求解器
      // 示例：模擬求解過程
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      alert('求解完成！');
      setIsDialogOpen(false);
    } catch (error) {
      console.error('求解失敗:', error);
      alert('求解失敗: ' + (error as Error).message);
    } finally {
      setIsSolving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            生產指引
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            使用求解器優化你的製作流程
          </p>
        </div>

        {/* 配方資訊卡片 */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            當前配方
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">配方名稱</div>
              <div className="text-lg font-medium text-gray-900 dark:text-white">
                {exampleRecipe.item?.name_zh}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">配方等級</div>
              <div className="text-lg font-medium text-gray-900 dark:text-white">
                {exampleRecipe.recipeLevel} {exampleRecipe.stars > 0 && `★${exampleRecipe.stars}`}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">目標進度</div>
              <div className="text-lg font-medium text-gray-900 dark:text-white">
                {exampleRecipe.difficulty}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">目標品質</div>
              <div className="text-lg font-medium text-gray-900 dark:text-white">
                {exampleRecipe.quality}
              </div>
            </div>
          </div>
        </div>

        {/* 製作者資訊卡片 */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            製作者屬性
          </h2>
          
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">等級</div>
              <div className="text-lg font-medium text-gray-900 dark:text-white">
                {crafterStats.level}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">作業精度</div>
              <div className="text-lg font-medium text-gray-900 dark:text-white">
                {crafterStats.craftsmanship}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">加工精度</div>
              <div className="text-lg font-medium text-gray-900 dark:text-white">
                {crafterStats.control}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">CP</div>
              <div className="text-lg font-medium text-gray-900 dark:text-white">
                {crafterStats.cp}
              </div>
            </div>
          </div>
        </div>

        {/* 求解器按鈕 */}
        <div className="flex justify-center">
          <button
            onClick={() => setIsDialogOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            求解器設定
          </button>
        </div>

        {/* 提示資訊 */}
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex gap-3">
            <svg className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium">使用提示：</p>
              <ul className="mt-1 list-inside list-disc space-y-1 text-xs">
                <li>點擊「求解器設定」按鈕打開設定彈窗</li>
                <li>在彈窗中設定食物、藥水、製作者數值和初期品質</li>
                <li>使用 HQ 材料計算功能可自動計算初期品質</li>
                <li>設定完成後可直接開始求解或先應用設定</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 求解器設定彈窗 */}
      <SolverSettingsDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        recipe={exampleRecipe}
        initialCrafterStats={crafterStats}
        onApply={handleApplySettings}
        onSolve={handleSolve}
        isSolving={isSolving}
      />
    </div>
  );
}
