'use client';

import { useState, useEffect, useCallback } from 'react';
import { RecipeSearch, MaterialTree, Sidebar, MaterialCostCalculator } from '@/components';
import { ItemSourceBadges, ItemSourceInfoPanel } from '@/components/item-source-info';
import { CraftingSimulator } from '@/components/crafting-simulator';
import { CrafterStatusEditor } from '@/components/crafter-status-editor';
import { fetchRecipe } from '@/hooks/use-xivapi';
import { buildMaterialTree, flattenMaterialTree } from '@/lib/recipe-tree';
import { useGearsets, JOB_NAMES } from '@/hooks/use-gearsets';
import { convertToRecipe, getItemInfo, type RecipeInfo } from '@/lib/recipe-datasource';
import type { MaterialTreeNode, CrafterStats, Recipe, CraftAction, CraftJob, FlattenedMaterial } from '@/types';

// 預設製作者屬性
const defaultCrafterStats: CrafterStats = {
  job: 'CRP',
  level: 100,
  craftsmanship: 4956,
  control: 4963,
  cp: 687,
  specialist: false,
};

// CAFEMAKER 圖標 URL
const CAFEMAKER_BASE = 'https://cafemaker.wakingsands.com';

export default function CraftingPage() {
  // 選擇的配方資訊（來自 yyyy.games API）
  const [selectedRecipeInfo, setSelectedRecipeInfo] = useState<RecipeInfo | null>(null);
  // 轉換後的配方（用於模擬器）
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  // 選擇的物品資訊（用於顯示）
  const [selectedItem, setSelectedItem] = useState<{ id: number; name: string; iconUrl: string } | null>(null);
  // 載入狀態
  const [isRecipeLoading, setIsRecipeLoading] = useState(false);
  
  const [materialTree, setMaterialTree] = useState<MaterialTreeNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatorRecipe, setSimulatorRecipe] = useState<Recipe | null>(null);
  const [simulatorItemName, setSimulatorItemName] = useState<string>('');
  const [showStatsEditor, setShowStatsEditor] = useState(false);
  const [showQuickAnalyzer, setShowQuickAnalyzer] = useState(false);
  const [generatedActions, setGeneratedActions] = useState<CraftAction[]>([]);
  const [showCostCalculator, setShowCostCalculator] = useState(false);

  // 使用配裝系統
  const { gearsets, getForJob, toCrafterStats, getDisplayName } = useGearsets();
  
  // 當前配裝選擇
  const [selectedGearsetId, setSelectedGearsetId] = useState<number>(0);
  const [currentJob, setCurrentJob] = useState<CraftJob>('CRP');
  
  // 從配裝取得 CrafterStats，如果沒有配裝則使用預設值
  const crafterStats = gearsets.length > 0 ? toCrafterStats(currentJob, selectedGearsetId) : defaultCrafterStats;

  // 當選擇配方時，轉換為完整配方並載入資料
  const handleRecipeSelect = useCallback(async (recipeInfo: RecipeInfo) => {
    setSelectedRecipeInfo(recipeInfo);
    setIsRecipeLoading(true);
    
    // 設定基本物品資訊（用於顯示）
    setSelectedItem({
      id: recipeInfo.item_id,
      name: recipeInfo.item_name,
      // 暫時使用空圖標，稍後會更新
      iconUrl: '',
    });
    
    try {
      // 並行執行：轉換配方和獲取物品詳細資訊
      const [fullRecipe, itemInfo] = await Promise.all([
        convertToRecipe(recipeInfo),
        getItemInfo(recipeInfo.item_id).catch(() => null),
      ]);
      
      setRecipe(fullRecipe);
      
      // 更新職業
      setCurrentJob(fullRecipe.craftType);
      
      // 自動選擇對應職業的配裝
      const jobGearset = getForJob(fullRecipe.craftType);
      if (jobGearset) {
        setSelectedGearsetId(jobGearset.id);
      }
      
      // 更新物品圖標（如果有）
      if (itemInfo) {
        setSelectedItem(prev => prev ? {
          ...prev,
          // 使用 CAFEMAKER 獲取圖標
          iconUrl: `${CAFEMAKER_BASE}/i/${Math.floor(itemInfo.id / 1000) * 1000}/${String(itemInfo.id).padStart(6, '0')}.png`,
        } : null);
      }
    } catch (error) {
      console.error('Failed to convert recipe:', error);
    } finally {
      setIsRecipeLoading(false);
    }
  }, [getForJob]);

  // 當選擇物品時，建構材料樹
  useEffect(() => {
    if (!selectedItem) {
      setMaterialTree(null);
      return;
    }

    const loadMaterialTree = async () => {
      setIsLoading(true);
      try {
        const tree = await buildMaterialTree(selectedItem.id, 1, 0, 5);
        setMaterialTree(tree);
      } catch (error) {
        console.error('Failed to build material tree:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMaterialTree();
  }, [selectedItem]);

  // 開啟模擬器
  const openSimulator = useCallback((recipeToSimulate: Recipe, itemName?: string) => {
    setSimulatorRecipe(recipeToSimulate);
    setSimulatorItemName(itemName || `配方 ${recipeToSimulate.id}`);
    setShowSimulator(true);
    // 更新當前職業
    setCurrentJob(recipeToSimulate.craftType);
  }, []);

  // 處理點擊物品（開啟模擬器）
  const handleItemClick = async (itemId: number, itemName?: string) => {
    // 如果點擊的是根物品並且有配方
    if (recipe && recipe.itemId === itemId) {
      openSimulator(recipe, selectedItem?.name);
      return;
    }
    
    // 嘗試獲取中間製品的配方
    try {
      const itemRecipe = await fetchRecipe(itemId);
      if (itemRecipe) {
        openSimulator(itemRecipe, itemName);
      }
    } catch (e) {
      console.error('Failed to fetch recipe for item:', itemId);
    }
  };

  // 處理材料列表點擊（中間製品）
  const handleMaterialClick = async (material: FlattenedMaterial) => {
    if (!material.isBaseMaterial) {
      handleItemClick(material.itemId, material.item.name);
    }
  };

  const flattenedMaterials = materialTree
    ? flattenMaterialTree(materialTree, true)
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">生產指引</h1>
        
        <div className="flex gap-2">
          {/* 快速分析按鈕 */}
          <button
            onClick={() => setShowQuickAnalyzer(!showQuickAnalyzer)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showQuickAnalyzer 
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-sm">快速分析</span>
          </button>
          
          {/* 製作者屬性按鈕 */}
          <button
            onClick={() => setShowStatsEditor(!showStatsEditor)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm">製作者屬性</span>
          </button>
        </div>
      </div>

      {/* 製作者屬性編輯器（使用配裝系統） */}
      {showStatsEditor && (
        <div className="mb-8 p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">製作者屬性</h3>
            <a
              href="/gearsets"
              className="text-sm text-blue-500 hover:text-blue-600"
            >
              管理配裝 →
            </a>
          </div>
          
          {/* 配裝選擇 */}
          {gearsets.length > 0 ? (
            <>
              <div className="mb-4">
                <label className="block text-sm text-gray-500 mb-2">選擇配裝</label>
                <select
                  value={selectedGearsetId}
                  onChange={(e) => setSelectedGearsetId(Number(e.target.value))}
                  className="w-full max-w-xs px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                >
                  {gearsets.map((g) => (
                    <option key={g.id} value={g.id}>
                      {getDisplayName(g)} (Lv.{g.value.level})
                    </option>
                  ))}
                </select>
              </div>
              
              {/* 屬性顯示 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                  <div className="text-xs text-gray-500 mb-1">等級</div>
                  <div className="text-xl font-bold text-blue-600">{crafterStats.level}</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                  <div className="text-xs text-gray-500 mb-1">作業精度</div>
                  <div className="text-xl font-bold text-green-600">{crafterStats.craftsmanship}</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                  <div className="text-xs text-gray-500 mb-1">加工精度</div>
                  <div className="text-xl font-bold text-amber-600">{crafterStats.control}</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                  <div className="text-xs text-gray-500 mb-1">製作力 (CP)</div>
                  <div className="text-xl font-bold text-purple-600">{crafterStats.cp}</div>
                </div>
              </div>
              
              {/* 當前職業 */}
              {recipe && (
                <div className="mt-4 text-sm text-gray-500">
                  當前配方職業: <span className="font-medium text-gray-700 dark:text-gray-300">{JOB_NAMES[recipe.craftType]}</span>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4 text-gray-500">
              <p className="mb-2">尚未設定任何配裝</p>
              <a
                href="/gearsets"
                className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                前往建立配裝
              </a>
            </div>
          )}
        </div>
      )}

      {/* 快速分析面板 */}
      {showQuickAnalyzer && recipe && (
        <div className="mb-8 p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-purple-800 dark:text-purple-300">
              🔧 快速分析 - {selectedItem?.name || ''}
            </h3>
            <button
              onClick={() => setShowQuickAnalyzer(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <CrafterStatusEditor
            recipe={recipe}
            onStatsChange={() => {}}
            onActionsGenerated={setGeneratedActions}
          />
        </div>
      )}

      {/* 無配方時的快速分析提示 */}
      {showQuickAnalyzer && !recipe && (
        <div className="mb-8 p-6 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
          <p className="text-amber-700 dark:text-amber-300 text-center">
            請先選擇一個配方以使用快速分析功能
          </p>
        </div>
      )}

      {/* 搜尋區塊 - 使用新的配方搜尋 */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          搜尋配方（支援繁體中文直接搜尋）
        </label>
        <RecipeSearch
          onSelect={handleRecipeSelect}
          placeholder="輸入配方名稱，例如：白鋼錠、玄鐵鑄錠..."
        />
        <p className="mt-2 text-xs text-gray-500">
          💡 提示：直接輸入繁體中文即可搜尋，無需轉換
        </p>
      </div>

      {/* 選中的配方 */}
      {selectedItem && (
        <div className="mb-8 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            {selectedItem.iconUrl ? (
              <img
                src={selectedItem.iconUrl}
                alt={selectedItem.name}
                className="w-12 h-12"
                onError={(e) => {
                  // 圖標載入失敗時顯示預設圖標
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                <span className="text-2xl">🔨</span>
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-xl font-bold">
                {selectedItem.name}
              </h2>
              {isRecipeLoading ? (
                <p className="text-sm text-gray-500">載入配方詳情中...</p>
              ) : recipe ? (
                <div className="text-sm text-gray-500 space-y-1">
                  <p>
                    <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs mr-2">
                      {JOB_NAMES[recipe.craftType]}
                    </span>
                    配方等級: {recipe.recipeLevel}
                  </p>
                  <p>
                    難度: {recipe.difficulty} | 
                    品質: {recipe.quality} |
                    耐久: {recipe.durability}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-amber-500">無法載入配方資訊</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (recipe) {
                    openSimulator(recipe, selectedItem?.name);
                  }
                }}
                disabled={!recipe || isRecipeLoading}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                開啟模擬器
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 載入狀態 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-gray-500">正在載入材料樹...</span>
        </div>
      )}

      {/* 材料顯示區 */}
      {materialTree && !isLoading && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 材料樹 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold mb-4">材料樹</h3>
              <MaterialTree
                tree={materialTree}
                onItemClick={handleItemClick}
              />
            </div>

            {/* 攤平的材料清單 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">所需材料</h3>
                <button
                  onClick={() => setShowCostCalculator(!showCostCalculator)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    showCostCalculator
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  💰 成本計算
                </button>
              </div>
              <MaterialListWithSimulator
                materials={flattenedMaterials}
                onOpenSimulator={handleMaterialClick}
              />
            </div>
          </div>

          {/* 成本計算器 */}
          {showCostCalculator && (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold mb-4">💰 材料成本計算</h3>
              <MaterialCostCalculator
                materials={flattenedMaterials}
                materialTree={materialTree}
                craftYield={recipe?.craftTypeLevel || 1}
              />
            </div>
          )}
        </div>
      )}

      {/* 空狀態 */}
      {!selectedItem && !isLoading && (
        <div className="text-center py-16 text-gray-500">
          <div className="text-6xl mb-4">🔨</div>
          <p className="text-lg">搜尋配方以查看製作指引</p>
          <p className="text-sm mt-2">
            使用繁體中文直接搜尋，系統會自動拆解材料樹
          </p>
        </div>
      )}

      {/* 生產模擬器側邊欄 */}
      <Sidebar
        isOpen={showSimulator}
        onClose={() => setShowSimulator(false)}
        title={`生產模擬器 - ${simulatorItemName}`}
        width="lg"
      >
        {simulatorRecipe ? (
          <CraftingSimulator
            recipe={simulatorRecipe}
            crafterStats={crafterStats}
            onClose={() => setShowSimulator(false)}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            請選擇一個配方
          </div>
        )}
      </Sidebar>
    </div>
  );
}

// 帶模擬器功能的材料列表
interface MaterialListWithSimulatorProps {
  materials: FlattenedMaterial[];
  onOpenSimulator: (material: FlattenedMaterial) => void;
}

function MaterialListWithSimulator({ materials, onOpenSimulator }: MaterialListWithSimulatorProps) {
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [showSourceInfo, setShowSourceInfo] = useState(false);
  
  const baseMaterials = materials.filter((m) => m.isBaseMaterial);
  const craftableMaterials = materials.filter((m) => !m.isBaseMaterial);

  const handleShowSource = (itemId: number) => {
    setSelectedItemId(itemId);
    setShowSourceInfo(true);
  };

  const selectedMaterial = materials.find(m => m.itemId === selectedItemId);

  return (
    <div className="space-y-6">
      {/* 物品來源詳情彈出視窗 */}
      {showSourceInfo && selectedItemId && selectedMaterial && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg">
            <ItemSourceInfoPanel
              itemId={selectedItemId}
              itemName={selectedMaterial.item.name}
              onClose={() => setShowSourceInfo(false)}
            />
          </div>
        </div>
      )}

      {/* 基礎材料 */}
      <div>
        <h4 className="text-sm font-semibold mb-3 text-green-600 dark:text-green-400">
          🌿 基礎材料（需採集/購買）
        </h4>
        <div className="grid grid-cols-1 gap-2">
          {baseMaterials.map((material) => (
            <div
              key={material.itemId}
              className="flex items-center gap-3 p-3 rounded-lg border bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700"
            >
              <img
                src={material.item.iconUrl}
                alt={material.item.name}
                className="w-8 h-8"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-sm">
                  {material.item.name}
                </div>
                <div className="text-xs text-gray-500">
                  ×{material.totalAmount}
                </div>
                {/* 來源標籤 - 顯示採集/購買地點 */}
                <div className="mt-1">
                  <ItemSourceBadges
                    itemId={material.itemId}
                    onClick={() => handleShowSource(material.itemId)}
                  />
                </div>
              </div>
              {/* 查看來源按鈕 */}
              <button
                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                onClick={() => handleShowSource(material.itemId)}
                title="查看取得方式"
              >
                📍
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 中間製品 - 可開啟模擬器 */}
      {craftableMaterials.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3 text-blue-600 dark:text-blue-400">
            🔧 中間製品（需製作）- 點擊開啟模擬器
          </h4>
          <div className="grid grid-cols-1 gap-2">
            {craftableMaterials.map((material) => (
              <button
                key={material.itemId}
                onClick={() => onOpenSimulator(material)}
                className="flex items-center gap-3 p-3 rounded-lg border bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left"
              >
                <img
                  src={material.item.iconUrl}
                  alt={material.item.name}
                  className="w-8 h-8"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-sm">
                    {material.item.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    需製作 ×{material.totalAmount}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-blue-500 text-xs">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  模擬
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
