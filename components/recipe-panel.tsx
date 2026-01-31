'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { searchRecipes, getCraftTypeList, type RecipeInfo, type CraftType } from '@/lib/recipe-datasource';

// 等級區間選項
const LEVEL_RANGES = [
  { label: '全部', min: undefined, max: undefined },
  { label: '1-10', min: 1, max: 10 },
  { label: '11-20', min: 11, max: 20 },
  { label: '21-30', min: 21, max: 30 },
  { label: '31-40', min: 31, max: 40 },
  { label: '41-50', min: 41, max: 50 },
  { label: '51-60', min: 51, max: 60 },
  { label: '61-70', min: 61, max: 70 },
  { label: '71-80', min: 71, max: 80 },
  { label: '81-90', min: 81, max: 90 },
  { label: '91-100', min: 91, max: 100 },
];

interface RecipePanelProps {
  onSelect: (recipe: RecipeInfo) => void;
  selectedRecipeId?: number;
}

export function RecipePanel({ onSelect, selectedRecipeId }: RecipePanelProps) {
  // 篩選條件
  const [craftTypes, setCraftTypes] = useState<CraftType[]>([]);
  const [selectedCraftType, setSelectedCraftType] = useState<number | undefined>();
  const [selectedLevelRange, setSelectedLevelRange] = useState<typeof LEVEL_RANGES[0]>(LEVEL_RANGES[0]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 配方列表
  const [recipes, setRecipes] = useState<RecipeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // 載入職業列表
  useEffect(() => {
    getCraftTypeList()
      .then(setCraftTypes)
      .catch(console.error);
  }, []);

  // 查詢配方（自動觸發）
  const fetchRecipes = useCallback(async (page: number = 1) => {
    // 必須選擇職業或有搜尋關鍵字
    if (!selectedCraftType && !searchQuery) {
      setRecipes([]);
      setTotalPages(1);
      return;
    }

    setIsLoading(true);
    try {
      const result = await searchRecipes(
        searchQuery,
        page,
        selectedCraftType,
        selectedLevelRange.min,
        selectedLevelRange.max
      );
      setRecipes(result.results);
      setTotalPages(result.totalPages);
      setCurrentPage(page);
    } catch (error) {
      console.error('載入配方失敗:', error);
      setRecipes([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCraftType, selectedLevelRange, searchQuery]);

  // 當篩選條件變化時重新載入
  useEffect(() => {
    fetchRecipes(1);
  }, [fetchRecipes]);

  // 處理翻頁
  const handlePageChange = (page: number) => {
    fetchRecipes(page);
  };

  // 處理職業變更
  const handleCraftTypeChange = (craftTypeId: number | undefined) => {
    setSelectedCraftType(craftTypeId);
    setCurrentPage(1);
  };

  // 處理等級範圍變更
  const handleLevelRangeChange = (range: typeof LEVEL_RANGES[0]) => {
    setSelectedLevelRange(range);
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* 標題 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">📜 配方列表</h2>
      </div>

      {/* 篩選區域 */}
      <div className="p-4 space-y-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        {/* 搜尋框 */}
        <div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋配方名稱..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        {/* 職業選擇 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            製作職業
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleCraftTypeChange(undefined)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                selectedCraftType === undefined
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              全部
            </button>
            {craftTypes.map((ct) => (
              <button
                key={ct.id}
                onClick={() => handleCraftTypeChange(ct.id)}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                  selectedCraftType === ct.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {ct.name}
              </button>
            ))}
          </div>
        </div>

        {/* 等級範圍 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            等級範圍
          </label>
          <div className="flex flex-wrap gap-1.5">
            {LEVEL_RANGES.map((range) => (
              <button
                key={range.label}
                onClick={() => handleLevelRangeChange(range)}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                  selectedLevelRange.label === range.label
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 配方列表 */}
      <div className="flex-1 overflow-y-auto">
        {/* 載入中 */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-2 text-sm text-gray-500">載入中...</span>
          </div>
        )}

        {/* 空狀態 */}
        {!isLoading && recipes.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-sm">
              {selectedCraftType || searchQuery 
                ? '找不到符合條件的配方' 
                : '請選擇職業或輸入關鍵字'}
            </p>
          </div>
        )}

        {/* 配方清單 */}
        {!isLoading && recipes.length > 0 && (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {recipes.map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => onSelect(recipe)}
                className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                  selectedRecipeId === recipe.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                    {recipe.item_name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                      {recipe.job}
                    </span>
                    <span className="text-xs text-gray-500">Lv.{recipe.rlv}</span>
                    {recipe.can_hq && (
                      <span className="text-xs text-amber-500 font-medium">HQ</span>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-400 shrink-0">
                  <div>難度 {recipe.difficulty_factor}%</div>
                  <div>品質 {recipe.quality_factor}%</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 分頁控制 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
            className="px-3 py-1.5 text-xs rounded-lg bg-gray-200 dark:bg-gray-700 disabled:opacity-50 hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            ← 上一頁
          </button>
          <span className="text-xs text-gray-500">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
            className="px-3 py-1.5 text-xs rounded-lg bg-gray-200 dark:bg-gray-700 disabled:opacity-50 hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            下一頁 →
          </button>
        </div>
      )}
    </div>
  );
}
