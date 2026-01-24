// ============================================
// 材料總覽元件 - 計算並顯示清單所需的所有材料
// ============================================

'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { CraftingListItem } from '@/hooks/use-crafting-lists';
import type { Recipe, FlattenedMaterial, Item } from '@/types';
import { getRecipeByItemId, getItemInfo } from '@/lib/recipe-datasource';

// ---- 建構圖示 URL（統一格式）----
function buildIconUrl(itemId: number): string {
  const folder = Math.floor(itemId / 1000) * 1000;
  return `https://cafemaker.wakingsands.com/i/${folder}/${String(itemId).padStart(6, '0')}.png`;
}

// ---- 聚合材料資料 ----
export interface AggregatedMaterial {
  itemId: number;
  itemName: string;
  iconUrl?: string;
  totalAmount: number;
  isBaseMaterial: boolean;  // 是否為基礎材料（非製作品）
  usedBy: Array<{           // 被哪些清單物品使用
    itemId: number;
    itemName: string;
    amountPerUnit: number;
    totalAmount: number;
  }>;
}

// ---- 成本條目 ----
interface MaterialCostEntry {
  unitPrice: number;
  possession: 'buy' | 'have';
}

interface MaterialSummaryProps {
  items: CraftingListItem[];
  onClose?: () => void;
}

// 快取 key 產生器
function generateCacheKey(items: CraftingListItem[]): string {
  return items.map(i => `${i.itemId}:${i.quantity}`).sort().join('|');
}

export function MaterialSummary({ items, onClose }: MaterialSummaryProps) {
  const [materials, setMaterials] = useState<AggregatedMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showIntermediates, setShowIntermediates] = useState(true); // 預設勾選
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  
  // 成本計算狀態
  const [costEntries, setCostEntries] = useState<Map<number, MaterialCostEntry>>(new Map());
  const [showCostCalculator, setShowCostCalculator] = useState(false);
  
  // 快取計算結果
  const cacheRef = useRef<Map<string, AggregatedMaterial[]>>(new Map());
  const lastCacheKeyRef = useRef<string>('');

  // 計算所有物品的材料（帶快取）
  useEffect(() => {
    if (items.length === 0) {
      setMaterials([]);
      return;
    }

    const cacheKey = generateCacheKey(items);
    
    // 如果快取中有結果，直接使用
    if (cacheRef.current.has(cacheKey) && lastCacheKeyRef.current === cacheKey) {
      return; // 已有快取，不需重新計算
    }

    calculateMaterials(cacheKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const calculateMaterials = async (cacheKey: string) => {
    // 檢查快取
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setMaterials(cached);
      lastCacheKeyRef.current = cacheKey;
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const materialMap = new Map<number, AggregatedMaterial>();

      // 為每個清單物品獲取配方和材料（始終計算包含中間產物的完整樹）
      for (const listItem of items) {
        const recipe = await getRecipeByItemId(listItem.itemId);
        
        if (!recipe) {
          // 無配方，可能不是製作品
          continue;
        }

        // 遞歸計算材料（考慮物品數量）- 始終包含中間產物
        await calculateItemMaterials(
          recipe,
          listItem.quantity,
          listItem.itemId,
          listItem.itemName,
          materialMap,
          true, // 始終計算中間產物，顯示由 UI 控制
          0
        );
      }

      // 轉為陣列並排序
      const sortedMaterials = Array.from(materialMap.values()).sort((a, b) => {
        // 基礎材料優先
        if (a.isBaseMaterial !== b.isBaseMaterial) {
          return a.isBaseMaterial ? -1 : 1;
        }
        // 按數量排序
        return b.totalAmount - a.totalAmount;
      });

      // 儲存到快取
      cacheRef.current.set(cacheKey, sortedMaterials);
      lastCacheKeyRef.current = cacheKey;
      
      setMaterials(sortedMaterials);
      
      // 初始化成本條目
      const newCostEntries = new Map<number, MaterialCostEntry>();
      sortedMaterials.forEach(m => {
        newCostEntries.set(m.itemId, { unitPrice: 0, possession: 'buy' });
      });
      setCostEntries(newCostEntries);
    } catch (e) {
      console.error('計算材料失敗:', e);
      setError(e instanceof Error ? e.message : '計算材料時發生錯誤');
    } finally {
      setIsLoading(false);
    }
  };

  // 更新單價
  const updateUnitPrice = useCallback((itemId: number, price: number) => {
    setCostEntries(prev => {
      const newMap = new Map(prev);
      const entry = newMap.get(itemId);
      if (entry) {
        newMap.set(itemId, { ...entry, unitPrice: price });
      }
      return newMap;
    });
  }, []);

  // 更新已擁有狀態
  const updatePossession = useCallback((itemId: number, possession: 'buy' | 'have') => {
    setCostEntries(prev => {
      const newMap = new Map(prev);
      const entry = newMap.get(itemId);
      if (entry) {
        newMap.set(itemId, { ...entry, possession });
      }
      return newMap;
    });
  }, []);

  // 切換展開/收合
  const toggleExpand = (itemId: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // 材料分類
  const baseMaterials = useMemo(
    () => materials.filter(m => m.isBaseMaterial),
    [materials]
  );

  const intermediateMaterials = useMemo(
    () => materials.filter(m => !m.isBaseMaterial),
    [materials]
  );

  // 計算總成本（僅基礎材料）
  const totalCost = useMemo(() => {
    let cost = 0;
    baseMaterials.forEach(m => {
      const entry = costEntries.get(m.itemId);
      if (entry && entry.possession === 'buy') {
        cost += entry.unitPrice * m.totalAmount;
      }
    });
    return cost;
  }, [baseMaterials, costEntries]);

  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">📦 材料總覽</h3>
          {onClose && (
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          )}
        </div>
        <p className="text-gray-500 text-center py-8">清單中尚無物品，請先新增裝備</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">📦 材料總覽</h3>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showIntermediates}
              onChange={(e) => setShowIntermediates(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>顯示中間產物</span>
          </label>
          {onClose && (
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-8">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-gray-500">計算材料中...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-6">
          {/* 基礎材料 */}
          <div>
            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
              <span>🪨 基礎材料</span>
              <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                {baseMaterials.length} 種
              </span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {baseMaterials.map((material) => (
                <MaterialCard
                  key={material.itemId}
                  material={material}
                  expanded={expandedItems.has(material.itemId)}
                  onToggle={() => toggleExpand(material.itemId)}
                />
              ))}
            </div>
          </div>

          {/* 中間產物 */}
          {showIntermediates && intermediateMaterials.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
                <span>⚒️ 中間產物</span>
                <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                  {intermediateMaterials.length} 種
                </span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {intermediateMaterials.map((material) => (
                  <MaterialCard
                    key={material.itemId}
                    material={material}
                    expanded={expandedItems.has(material.itemId)}
                    onToggle={() => toggleExpand(material.itemId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 統計資訊 */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">
              共需要 <span className="font-semibold text-gray-900 dark:text-white">{baseMaterials.length}</span> 種基礎材料
              {showIntermediates && intermediateMaterials.length > 0 && (
                <>
                  ，<span className="font-semibold text-gray-900 dark:text-white">{intermediateMaterials.length}</span> 種中間產物
                </>
              )}
            </p>
          </div>

          {/* 成本計算區 */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowCostCalculator(!showCostCalculator)}
              className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              <span>💰 成本計算</span>
              <span>{showCostCalculator ? '▲' : '▼'}</span>
            </button>

            {showCostCalculator && (
              <div className="mt-4 space-y-4">
                {/* 基礎材料成本輸入 */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">材料</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">需求量</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-400">狀態</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">單價</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">小計</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {baseMaterials.map((material) => {
                        const entry = costEntries.get(material.itemId);
                        const isHave = entry?.possession === 'have';
                        const subtotal = isHave ? 0 : (entry?.unitPrice || 0) * material.totalAmount;

                        return (
                          <tr key={material.itemId} className={`${isHave ? 'opacity-50' : ''}`}>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                {material.iconUrl && (
                                  <img src={material.iconUrl} alt={material.itemName} className="w-6 h-6" />
                                )}
                                <span className="truncate max-w-[120px]">{material.itemName}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                              {material.totalAmount}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => updatePossession(material.itemId, isHave ? 'buy' : 'have')}
                                className={`px-2 py-1 text-xs rounded ${
                                  isHave 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                }`}
                              >
                                {isHave ? '已擁有' : '需購買'}
                              </button>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                value={entry?.unitPrice || 0}
                                onChange={(e) => updateUnitPrice(material.itemId, Math.max(0, parseInt(e.target.value) || 0))}
                                disabled={isHave}
                                className="w-24 px-2 py-1 text-right text-sm border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 disabled:opacity-50"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {isHave ? '-' : subtotal.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 成本總計 */}
                <div className="flex justify-between items-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">基礎材料總成本</span>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {totalCost.toLocaleString()} Gil
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- 材料卡片 ----
function MaterialCard({
  material,
  expanded,
  onToggle,
}: {
  material: AggregatedMaterial;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 text-left"
      >
        {material.iconUrl && (
          <img
            src={material.iconUrl}
            alt={material.itemName}
            className="w-8 h-8 rounded"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate">
            {material.itemName}
          </p>
          <p className="text-sm text-gray-500">
            需要 <span className="font-semibold text-blue-600 dark:text-blue-400">{material.totalAmount}</span> 個
          </p>
        </div>
        <span className="text-gray-400">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* 展開詳情 */}
      {expanded && material.usedBy.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
          <p className="text-xs text-gray-500 mb-2">用於：</p>
          {material.usedBy.map((usage, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400 truncate">
                {usage.itemName}
              </span>
              <span className="text-gray-500 whitespace-nowrap ml-2">
                {usage.amountPerUnit} × {usage.totalAmount / usage.amountPerUnit} = {usage.totalAmount}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- 遞歸計算材料 ----
async function calculateItemMaterials(
  recipe: Recipe,
  quantity: number,
  rootItemId: number,
  rootItemName: string,
  materialMap: Map<number, AggregatedMaterial>,
  includeIntermediates: boolean,
  depth: number,
  visited: Set<number> = new Set()
): Promise<void> {
  // 防止無限遞歸
  if (depth > 10 || visited.has(recipe.itemId)) {
    return;
  }
  visited.add(recipe.itemId);

  // 計算每次製作產出數量（預設為 1）
  const craftYield = recipe.craftTypeLevel || 1;
  // 計算需要製作的次數
  const craftCount = Math.ceil(quantity / craftYield);

  for (const ingredient of recipe.ingredients) {
    const requiredAmount = ingredient.amount * craftCount;
    
    // 嘗試獲取此材料的配方
    const ingredientRecipe = await getRecipeByItemId(ingredient.itemId);
    const isBaseMaterial = !ingredientRecipe;

    // 獲取材料名稱
    let itemName = `Item ${ingredient.itemId}`;
    let iconUrl = buildIconUrl(ingredient.itemId);
    try {
      const itemInfo = await getItemInfo(ingredient.itemId);
      itemName = itemInfo.name;
    } catch {
      // 忽略錯誤
    }

    // 加入材料清單（基礎材料或指定顯示中間產物）
    if (isBaseMaterial || includeIntermediates) {
      const existing = materialMap.get(ingredient.itemId);
      if (existing) {
        existing.totalAmount += requiredAmount;
        // 更新使用來源
        const usageIdx = existing.usedBy.findIndex(u => u.itemId === rootItemId);
        if (usageIdx >= 0) {
          existing.usedBy[usageIdx].totalAmount += requiredAmount;
        } else {
          existing.usedBy.push({
            itemId: rootItemId,
            itemName: rootItemName,
            amountPerUnit: ingredient.amount,
            totalAmount: requiredAmount,
          });
        }
      } else {
        materialMap.set(ingredient.itemId, {
          itemId: ingredient.itemId,
          itemName,
          iconUrl,
          totalAmount: requiredAmount,
          isBaseMaterial,
          usedBy: [{
            itemId: rootItemId,
            itemName: rootItemName,
            amountPerUnit: ingredient.amount,
            totalAmount: requiredAmount,
          }],
        });
      }
    }

    // 如果不是基礎材料，遞歸處理
    if (!isBaseMaterial && ingredientRecipe) {
      await calculateItemMaterials(
        ingredientRecipe,
        requiredAmount,
        rootItemId,
        rootItemName,
        materialMap,
        includeIntermediates,
        depth + 1,
        new Set(visited)
      );
    }
  }
}
