'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { searchRecipes, getCraftTypeList, type RecipeInfo, type CraftType } from '@/lib/recipe-datasource';

interface RecipeSearchProps {
  onSelect: (recipe: RecipeInfo) => void;
  placeholder?: string;
}

export function RecipeSearch({
  onSelect,
  placeholder = '搜尋配方（支援繁體中文）...',
}: RecipeSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<RecipeInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [craftTypes, setCraftTypes] = useState<CraftType[]>([]);
  const [selectedCraftType, setSelectedCraftType] = useState<number | undefined>();
  const [levelRange, setLevelRange] = useState<{ min?: number; max?: number }>({});
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 載入職業列表
  useEffect(() => {
    getCraftTypeList()
      .then(setCraftTypes)
      .catch(console.error);
  }, []);

  // 處理點擊外部關閉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // 執行搜尋
  const doSearch = useCallback(async (
    searchQuery: string,
    page = 1,
    craftTypeId: number | undefined = undefined,
    jobLevelMin: number | undefined = undefined,
    jobLevelMax: number | undefined = undefined
  ) => {
    if (searchQuery.length < 1) {
      setResults([]);
      setTotalPages(1);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await searchRecipes(
        searchQuery,
        page,
        craftTypeId,
        jobLevelMin,
        jobLevelMax
      );
      setResults(result.results);
      setTotalPages(result.totalPages);
      setCurrentPage(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : '搜尋失敗');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 處理輸入變化（防抖）
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setIsOpen(true);
    setCurrentPage(1);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      doSearch(value, 1, selectedCraftType, levelRange.min, levelRange.max);
    }, 300);
  }, [doSearch, selectedCraftType, levelRange]);

  // 處理篩選變化
  const handleFilterChange = useCallback(() => {
    if (query.length >= 1) {
      doSearch(query, 1, selectedCraftType, levelRange.min, levelRange.max);
    }
  }, [query, selectedCraftType, levelRange, doSearch]);

  // 處理選擇
  const handleSelect = useCallback((recipe: RecipeInfo) => {
    onSelect(recipe);
    setQuery('');
    setIsOpen(false);
    setResults([]);
  }, [onSelect]);

  // 處理翻頁
  const handlePageChange = useCallback((page: number) => {
    doSearch(query, page, selectedCraftType, levelRange.min, levelRange.max);
  }, [query, selectedCraftType, levelRange, doSearch]);

  return (
    <div className="relative" ref={containerRef}>
      {/* 搜尋輸入框 */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        
        {/* 篩選按鈕 */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2 rounded-lg transition-colors ${
            showFilters || selectedCraftType || levelRange.min || levelRange.max
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
          }`}
          title="篩選條件"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
      </div>

      {/* 篩選面板 */}
      {showFilters && (
        <div className="mt-2 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 職業篩選 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                製作職業
              </label>
              <select
                value={selectedCraftType ?? ''}
                onChange={(e) => {
                  setSelectedCraftType(e.target.value ? Number(e.target.value) : undefined);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="">全部</option>
                {craftTypes.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* 等級範圍 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                最低等級
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={levelRange.min ?? ''}
                onChange={(e) => setLevelRange(prev => ({ ...prev, min: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                最高等級
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={levelRange.max ?? ''}
                onChange={(e) => setLevelRange(prev => ({ ...prev, max: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>
          
          {/* 套用按鈕 */}
          <div className="mt-4 flex gap-2 justify-end">
            <button
              onClick={() => {
                setSelectedCraftType(undefined);
                setLevelRange({});
              }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400"
            >
              清除篩選
            </button>
            <button
              onClick={handleFilterChange}
              className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              套用
            </button>
          </div>
        </div>
      )}

      {/* 搜尋結果 */}
      {isOpen && query.length >= 1 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {error && (
            <div className="p-4 text-red-500">
              搜尋失敗: {error}
            </div>
          )}

          {!error && results.length === 0 && !isLoading && (
            <div className="p-4 text-gray-500">
              找不到符合的配方
            </div>
          )}

          {results.map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => handleSelect(recipe)}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left border-b border-gray-100 dark:border-gray-700 last:border-b-0"
            >
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">
                  {recipe.item_name}
                </div>
                <div className="text-sm text-gray-500 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                    {recipe.job}
                  </span>
                  <span>Lv.{recipe.rlv}</span>
                  {recipe.can_hq && (
                    <span className="text-amber-500">HQ</span>
                  )}
                </div>
              </div>
              <div className="text-right text-xs text-gray-400">
                <div>難度 {recipe.difficulty_factor}%</div>
                <div>品質 {recipe.quality_factor}%</div>
              </div>
            </button>
          ))}

          {/* 分頁控制 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 p-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="px-3 py-1 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 disabled:opacity-50"
              >
                上一頁
              </button>
              <span className="text-sm text-gray-500">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="px-3 py-1 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 disabled:opacity-50"
              >
                下一頁
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
