'use client';

import { useState, useEffect, useCallback } from 'react';
import { RecipePanel, MaterialTree, MaterialCostCalculator } from '@/components';
import { ItemSourceBadges, ItemSourceInfoPanel } from '@/components/item-source-info';
import { CraftingSimulator } from '@/components/crafting-simulator';
import { fetchRecipe } from '@/hooks/use-xivapi';
import { getItem } from '@/lib/data/items';
import { useIsDesktop } from '@/hooks/use-media-query';
import { buildMaterialTree, flattenMaterialTree } from '@/lib/recipe-tree';
import { useGearsets, JOB_NAMES } from '@/hooks/use-gearsets';
import { convertToRecipe, getRecipeByItemId, type RecipeInfo } from '@/lib/recipe-datasource';
import type { MaterialTreeNode, CrafterStats, Recipe, CraftJob, FlattenedMaterial } from '@/types';

// 預設製作者屬性
const defaultCrafterStats: CrafterStats = {
  job: 'CRP',
  level: 100,
  craftsmanship: 4956,
  control: 4963,
  cp: 687,
  specialist: false,
};

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
  const [showStatsEditor, setShowStatsEditor] = useState(false);

  // 側欄收合。桌機預設展開、手機預設收合；
  // 使用者手動切換過就以手動值為準（null 代表尚未手動干預）。
  const isDesktop = useIsDesktop();
  const [recipePanelManual, setRecipePanelManual] = useState<boolean | null>(null);
  const [simulatorManual, setSimulatorManual] = useState<boolean | null>(null);

  const recipePanelOpen = recipePanelManual ?? isDesktop;
  const simulatorOpen = simulatorManual ?? isDesktop;
  const [showCostCalculator, setShowCostCalculator] = useState(false);
  
  // 從生產紀錄載入的資料
  const [loadedProductionData, setLoadedProductionData] = useState<{
    multiplier: number;
    entries: any[];
  } | null>(null);
  const [showLoadedNotice, setShowLoadedNotice] = useState(false);

  // 使用配裝系統
  const { gearsets, getForJob, toCrafterStats, getDisplayName } = useGearsets();
  
  // 當前配裝選擇
  const [selectedGearsetId, setSelectedGearsetId] = useState<number>(0);
  const [currentJob, setCurrentJob] = useState<CraftJob>('CRP');
  
  // 從配裝取得 CrafterStats，如果沒有配裝則使用預設值
  const crafterStats = gearsets.length > 0 ? toCrafterStats(currentJob, selectedGearsetId) : defaultCrafterStats;

  // 檢查是否有從生產紀錄載入的資料
  useEffect(() => {
    // 檢查是否從需求清單導航過來
    const navigateData = sessionStorage.getItem('navigate_to_recipe');
    if (navigateData) {
      try {
        const { itemId, itemName } = JSON.parse(navigateData);
        loadRecipeByItemId(itemId, itemName);
        sessionStorage.removeItem('navigate_to_recipe');
        return; // 優先處理導航請求
      } catch (e) {
        console.error('Failed to parse navigate data:', e);
        sessionStorage.removeItem('navigate_to_recipe');
      }
    }

    // 檢查是否有從生產紀錄載入的資料
    const raw = sessionStorage.getItem('loaded_production_record');
    if (raw) {
      try {
        const record = JSON.parse(raw);
        setLoadedProductionData({
          multiplier: record.multiplier,
          entries: record.entries,
        });
        setShowCostCalculator(true);
        setShowLoadedNotice(true);
        
        // 如果有 targetItemId，自動載入對應配方
        if (record.targetItemId) {
          loadRecipeByItemId(record.targetItemId, record.materialTree?.name);
        }
        
        // 清除 sessionStorage
        sessionStorage.removeItem('loaded_production_record');
      } catch (e) {
        console.error('Failed to load production record:', e);
      }
    }
  }, []);

  // 透過 itemId 載入配方
  const loadRecipeByItemId = async (itemId: number, itemName?: string) => {
    setIsRecipeLoading(true);
    try {
      // 設定基本物品資訊（用於顯示）
      setSelectedItem({
        id: itemId,
        name: itemName || `物品 ${itemId}`,
        iconUrl: '',
      });

      // 取得配方
      const fullRecipe = await getRecipeByItemId(itemId);
      if (fullRecipe) {
        setRecipe(fullRecipe);
        setCurrentJob(fullRecipe.craftType);

        // 自動選擇對應職業的配裝
        const jobGearset = getForJob(fullRecipe.craftType);
        if (jobGearset) {
          setSelectedGearsetId(jobGearset.id);
        }
      }

      // 取得物品詳細資訊（圖示）
      // 圖示必須用 icon id 而非 item id 組路徑 —— 全庫 50,774 筆物品中，
      // iconId 恰好等於 itemId 的是 0 筆，先前的寫法等於每個物品都顯示錯誤圖示。
      const localItem = await getItem(itemId);
      if (localItem) {
        setSelectedItem((prev) =>
          prev
            ? {
                ...prev,
                name: localItem.name || prev.name,
                iconUrl: localItem.iconUrl,
              }
            : null
        );
      }
    } catch (error) {
      console.error('Failed to load recipe by item ID:', error);
    } finally {
      setIsRecipeLoading(false);
    }
  };

  // 當選擇配方時，轉換為完整配方並載入資料
  const handleRecipeSelect = useCallback(async (recipeInfo: RecipeInfo) => {
    setSelectedRecipeInfo(recipeInfo);
    setIsRecipeLoading(true);
    
    // 設定基本物品資訊（用於顯示）
    setSelectedItem({
      id: recipeInfo.item_id,
      name: recipeInfo.item_name,
      iconUrl: '',
    });
    
    try {
      // 並行執行：轉換配方和獲取物品詳細資訊（含正確的圖示）
      const [fullRecipe, localItem] = await Promise.all([
        convertToRecipe(recipeInfo),
        getItem(recipeInfo.item_id).catch(() => null),
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
      if (localItem) {
        setSelectedItem(prev => prev ? { ...prev, iconUrl: localItem.iconUrl } : null);
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

  // 處理點擊物品（切換配方）
  const handleItemClick = async (itemId: number, itemName?: string) => {
    // 嘗試尋找該物品的配方
    try {
      const itemRecipe = await fetchRecipe(itemId);
      if (itemRecipe) {
        // 找到配方，更新狀態
        setRecipe(itemRecipe);
        setSelectedItem({
          id: itemId,
          name: itemName || `物品 ${itemId}`,
          iconUrl: (await getItem(itemId))?.iconUrl || '',
        });
        setCurrentJob(itemRecipe.craftType);
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

  // 選了配方之後，手機上自動把配方清單收起來，直接看內容
  const handleRecipeSelectAndClose = useCallback(
    (recipeInfo: RecipeInfo) => {
      handleRecipeSelect(recipeInfo);
      if (!isDesktop) setRecipePanelManual(false);
    },
    [handleRecipeSelect, isDesktop]
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex relative overflow-hidden">
      {/* 手機：側欄以浮層呈現，開啟時用半透明遮罩讓使用者能點擊關閉 */}
      {!isDesktop && (recipePanelOpen || simulatorOpen) && (
        <div
          className="fixed inset-0 top-16 bg-black/40 z-30"
          onClick={() => {
            setRecipePanelManual(false);
            setSimulatorManual(false);
          }}
        />
      )}

      {/* 左側：配方列表面板 */}
      <div
        className={`
          shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900
          transition-transform duration-200
          ${isDesktop
            ? `${recipePanelOpen ? 'w-80' : 'w-0 overflow-hidden border-r-0'}`
            : `fixed inset-y-0 top-16 left-0 z-40 w-80 max-w-[85vw] shadow-xl
               ${recipePanelOpen ? 'translate-x-0' : '-translate-x-full'}`
          }
        `}
      >
        <RecipePanel
          onSelect={handleRecipeSelectAndClose}
          selectedRecipeId={selectedRecipeInfo?.id}
        />
      </div>

      {/* 中間：配方詳情與材料 */}
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          {/* 頂部標題列 */}
          <div className="flex items-center justify-between gap-2 mb-6">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setRecipePanelManual(!recipePanelOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
                aria-expanded={recipePanelOpen}
                title={recipePanelOpen ? '收起配方清單' : '展開配方清單'}
              >
                <span aria-hidden>{recipePanelOpen ? '◀' : '▶'}</span>
                <span className="hidden sm:inline">配方</span>
              </button>
              <h1 className="text-2xl font-bold truncate">生產指引</h1>
            </div>

            <div className="flex gap-2 shrink-0">
              {recipe && (
                <button
                  onClick={() => setSimulatorManual(!simulatorOpen)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    simulatorOpen
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  aria-expanded={simulatorOpen}
                  title={simulatorOpen ? '收起模擬器' : '展開模擬器'}
                >
                  ⚙️ <span className="hidden sm:inline">模擬器</span>
                </button>
              )}
              {/* 製作者屬性按鈕 */}
              <button
                onClick={() => setShowStatsEditor(!showStatsEditor)}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  showStatsEditor
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                ⚙️ 製作者屬性
              </button>
            </div>
          </div>

          {/* 製作者屬性編輯器 */}
          {showStatsEditor && (
            <div className="mb-6 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">製作者屬性</h3>
                <a href="/gearsets" className="text-xs text-blue-500 hover:text-blue-600">
                  管理配裝 →
                </a>
              </div>
              
              {gearsets.length > 0 ? (
                <>
                  <select
                    value={selectedGearsetId}
                    onChange={(e) => setSelectedGearsetId(Number(e.target.value))}
                    className="w-full max-w-xs px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600 mb-3"
                  >
                    {gearsets.map((g) => (
                      <option key={g.id} value={g.id}>
                        {getDisplayName(g)} (Lv.{g.value.level})
                      </option>
                    ))}
                  </select>
                  
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-center">
                      <div className="text-xs text-gray-500">等級</div>
                      <div className="text-lg font-bold text-blue-600">{crafterStats.level}</div>
                    </div>
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-center">
                      <div className="text-xs text-gray-500">作業</div>
                      <div className="text-lg font-bold text-green-600">{crafterStats.craftsmanship}</div>
                    </div>
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-center">
                      <div className="text-xs text-gray-500">加工</div>
                      <div className="text-lg font-bold text-amber-600">{crafterStats.control}</div>
                    </div>
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-center">
                      <div className="text-xs text-gray-500">CP</div>
                      <div className="text-lg font-bold text-purple-600">{crafterStats.cp}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  <p>尚未設定配裝</p>
                  <a href="/gearsets" className="text-blue-500 hover:text-blue-600">
                    前往建立 →
                  </a>
                </div>
              )}
            </div>
          )}

          {/* 選中的配方資訊 */}
          {selectedItem && recipe && (
            <div className="mb-6 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-4">
                {selectedItem.iconUrl ? (
                  <img
                    src={selectedItem.iconUrl}
                    alt={selectedItem.name}
                    className="w-14 h-14 rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                    <span className="text-2xl">🔨</span>
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold">{selectedItem.name}</h2>
                    {recipe.isCollectable && (
                      <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs font-medium">
                        📦 收藏品
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                      {JOB_NAMES[recipe.craftType]}
                    </span>
                    <span>Lv.{recipe.recipeLevel}</span>
                    <span>難度: {recipe.difficulty}</span>
                    <span>品質: {recipe.quality}</span>
                    <span>耐久: {recipe.durability}</span>
                  </div>
                  {/* 收藏品門檻 */}
                  {recipe.isCollectable && recipe.collectability && (
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <span className="text-gray-500">收藏價值門檻:</span>
                      <span style={{ color: '#79c7ec' }}>普通 {recipe.collectability.low}</span>
                      <span style={{ color: '#fbc800' }}>精選 {recipe.collectability.mid}</span>
                      <span style={{ color: '#22c55e' }}>特選 {recipe.collectability.high}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 載入狀態 */}
          {(isLoading || isRecipeLoading) && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-gray-500">載入中...</span>
            </div>
          )}

          {/* 材料顯示區 */}
          {materialTree && !isLoading && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 材料樹 */}
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="text-sm font-semibold mb-3">🌳 材料樹</h3>
                  <MaterialTree
                    tree={materialTree}
                    onItemClick={handleItemClick}
                  />
                </div>

                {/* 攤平的材料清單 */}
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">📦 所需材料</h3>
                    <button
                      onClick={() => setShowCostCalculator(!showCostCalculator)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        showCostCalculator
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      💰 成本
                    </button>
                  </div>
                  <MaterialListWithSource
                    materials={flattenedMaterials}
                    onCraftableClick={handleMaterialClick}
                  />
                </div>
              </div>

              {/* 成本計算器 */}
              {showCostCalculator && (
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">💰 材料成本計算</h3>
                    {showLoadedNotice && (
                      <div className="flex items-center gap-2 text-sm text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-3 py-1 rounded-lg">
                        <span>✅ 已載入生產紀錄資料</span>
                        <button
                          onClick={() => setShowLoadedNotice(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                  <MaterialCostCalculator
                    materials={flattenedMaterials}
                    materialTree={materialTree}
                    craftYield={recipe?.craftTypeLevel || 1}
                    initialData={loadedProductionData}
                    onDataLoaded={() => setLoadedProductionData(null)}
                  />
                </div>
              )}
            </div>
          )}

          {/* 空狀態 */}
          {!selectedItem && !isLoading && (
            <div className="text-center py-16 text-gray-500">
              <div className="text-6xl mb-4">🔨</div>
              <p className="text-lg">從左側選擇配方以開始</p>
              <p className="text-sm mt-2">
                選擇職業和等級範圍，或直接搜尋配方名稱
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 右側：模擬器 */}
      {recipe && (
        <div
          className={`
            shrink-0 border-l border-gray-200 dark:border-gray-800 overflow-y-auto
            bg-gray-50 dark:bg-gray-900/50 transition-transform duration-200
            ${isDesktop
              ? `${simulatorOpen ? 'w-96' : 'w-0 overflow-hidden border-l-0'}`
              : `fixed inset-y-0 top-16 right-0 z-40 w-96 max-w-[90vw] shadow-xl
                 ${simulatorOpen ? 'translate-x-0' : 'translate-x-full'}`
            }
          `}
        >
          <div className="p-4">
            <CraftingSimulator
              recipe={recipe}
              crafterStats={crafterStats}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// 帶來源資訊的材料列表
interface MaterialListWithSourceProps {
  materials: FlattenedMaterial[];
  onCraftableClick: (material: FlattenedMaterial) => void;
}

function MaterialListWithSource({ materials, onCraftableClick }: MaterialListWithSourceProps) {
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
    <div className="space-y-4">
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
      {baseMaterials.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-green-600 dark:text-green-400 mb-2">
            🌿 基礎材料
          </h4>
          <div className="space-y-1.5">
            {baseMaterials.map((material) => (
              <div
                key={material.itemId}
                className="flex items-center gap-2 p-2 rounded border bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700"
              >
                <img
                  src={material.item.iconUrl}
                  alt={material.item.name}
                  className="w-6 h-6"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{material.item.name}</div>
                  <ItemSourceBadges
                    itemId={material.itemId}
                    onClick={() => handleShowSource(material.itemId)}
                  />
                </div>
                <div className="text-sm font-medium text-gray-500">×{material.totalAmount}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 中間製品 */}
      {craftableMaterials.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">
            🔧 中間製品（點擊查看配方）
          </h4>
          <div className="space-y-1.5">
            {craftableMaterials.map((material) => (
              <button
                key={material.itemId}
                onClick={() => onCraftableClick(material)}
                className="w-full flex items-center gap-2 p-2 rounded border bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left"
              >
                <img
                  src={material.item.iconUrl}
                  alt={material.item.name}
                  className="w-6 h-6"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{material.item.name}</div>
                </div>
                <div className="text-sm font-medium text-gray-500">×{material.totalAmount}</div>
                <span className="text-blue-500 text-xs">→</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
