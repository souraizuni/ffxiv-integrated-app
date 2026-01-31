'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { FlattenedMaterial, MaterialTreeNode } from '@/types';

// 材料來源選擇：購買或自製
type MaterialSource = 'buy' | 'craft';
type MaterialPossession = 'buy' | 'craft' | 'have';

interface MaterialCostEntry {
  itemId: number;
  itemName?: string; // 物品名稱
  unitPrice: number;
  purchaseQty: number; // 實際購買數量
  source: MaterialSource;
  possession?: MaterialPossession; // 新增：已擁有狀態
  ownedQty?: number; // 已擁有的數量
  isHQ?: boolean; // 是否為優質材料
}

interface LoadedProductionData {
  multiplier: number;
  entries: MaterialCostEntry[];
  // 利潤計算相關（可選，舊紀錄可能沒有）
  profitSettings?: {
    sellPrice: number;
    taxRate: number;
    reserveQty: number;
  };
}

interface MaterialCostCalculatorProps {
  materials: FlattenedMaterial[];
  materialTree?: MaterialTreeNode | null;
  craftYield?: number;
  onCostChange?: (totalCost: number, costPerUnit: number) => void;
  initialData?: LoadedProductionData | null;
  onDataLoaded?: () => void;
}

export function MaterialCostCalculator({
  materials,
  materialTree,
  craftYield = 1,
  onCostChange,
  initialData,
  onDataLoaded,
}: MaterialCostCalculatorProps) {
  // 過濾掉根節點（目標成品本身），只保留真正的材料
  const actualMaterials = useMemo(() => {
    if (!materialTree) return materials;
    // 排除根節點（目標成品）
    return materials.filter((m) => m.itemId !== materialTree.itemId);
  }, [materials, materialTree]);

  // 分類材料
  const { baseMaterials, craftableMaterials } = useMemo(() => {
    const base = actualMaterials.filter((m) => m.isBaseMaterial);
    const craftable = actualMaterials.filter((m) => !m.isBaseMaterial);
    return { baseMaterials: base, craftableMaterials: craftable };
  }, [actualMaterials]);

  // 材料成本與來源設定
  const [costEntries, setCostEntries] = useState<Map<number, MaterialCostEntry>>(
    () => {
      const map = new Map<number, MaterialCostEntry>();
      actualMaterials.forEach((m) => {
        map.set(m.itemId, {
          itemId: m.itemId,
          unitPrice: 0,
          purchaseQty: m.totalAmount, // 預設購買數量 = 需求量
          source: m.isBaseMaterial ? 'buy' : 'craft',
          possession: 'buy', // 預設為購買（可切換為已擁有或自製）
          ownedQty: 0,
          isHQ: false, // 預設非優質
        });
      });
      return map;
    }
  );

  // 製作倍數
  const [multiplier, setMultiplier] = useState(1);

  // 利潤計算設定（提升到父元件以便儲存）
  const [sellPrice, setSellPrice] = useState(0);
  const [taxRate, setTaxRate] = useState(5);
  const [reserveQty, setReserveQty] = useState(0);

  // 瓶頸分析開關
  const [showBottleneck, setShowBottleneck] = useState(false);

  // 載入外部資料（從生產紀錄）
  useEffect(() => {
    if (initialData) {
      setMultiplier(initialData.multiplier);
      setCostEntries((prev) => {
        const newMap = new Map(prev);
        initialData.entries.forEach((e) => {
          newMap.set(e.itemId, e);
        });
        return newMap;
      });
      // 載入利潤計算設定（如果有的話）
      if (initialData.profitSettings) {
        setSellPrice(initialData.profitSettings.sellPrice);
        setTaxRate(initialData.profitSettings.taxRate);
        setReserveQty(initialData.profitSettings.reserveQty);
      }
      onDataLoaded?.();
    }
  }, [initialData, onDataLoaded]);

  // 當材料列表變化時，更新 costEntries
  useEffect(() => {
    setCostEntries((prev) => {
      const newMap = new Map(prev);
      actualMaterials.forEach((m) => {
        if (!newMap.has(m.itemId)) {
          newMap.set(m.itemId, {
            itemId: m.itemId,
            unitPrice: 0,
            purchaseQty: m.totalAmount * multiplier,
            source: m.isBaseMaterial ? 'buy' : 'craft',
          });
        }
      });
      return newMap;
    });
  }, [actualMaterials, multiplier]);

  // 更新單價
  const updateUnitPrice = useCallback((itemId: number, price: number) => {
    setCostEntries((prev) => {
      const newMap = new Map(prev);
      const entry = newMap.get(itemId);
      if (entry) {
        newMap.set(itemId, { ...entry, unitPrice: price });
      }
      return newMap;
    });
  }, []);

  // 更新購買數量
  const updatePurchaseQty = useCallback((itemId: number, qty: number) => {
    setCostEntries((prev) => {
      const newMap = new Map(prev);
      const entry = newMap.get(itemId);
      if (entry) {
        newMap.set(itemId, { ...entry, purchaseQty: qty });
      }
      return newMap;
    });
  }, []);

  // 更新來源（購買/自製）
  const updateSource = useCallback((itemId: number, source: MaterialSource) => {
    setCostEntries((prev) => {
      const newMap = new Map(prev);
      const entry = newMap.get(itemId);
      if (entry) {
        newMap.set(itemId, { ...entry, source });
      }
      return newMap;
    });
  }, []);

  const updatePossession = useCallback((itemId: number, possession: MaterialPossession) => {
    setCostEntries((prev) => {
      const newMap = new Map(prev);
      const entry = newMap.get(itemId);
      if (entry) {
        // 若切換到已擁有，保留 ownedQty（預設 0）
        newMap.set(itemId, { ...entry, possession });
      }
      return newMap;
    });
  }, []);

  const updateOwnedQty = useCallback((itemId: number, qty: number) => {
    setCostEntries((prev) => {
      const newMap = new Map(prev);
      const entry = newMap.get(itemId);
      if (entry) {
        newMap.set(itemId, { ...entry, ownedQty: qty });
      }
      return newMap;
    });
  }, []);

  // 更新是否為優質材料
  const updateIsHQ = useCallback((itemId: number, isHQ: boolean) => {
    setCostEntries((prev) => {
      const newMap = new Map(prev);
      const entry = newMap.get(itemId);
      if (entry) {
        newMap.set(itemId, { ...entry, isHQ });
      }
      return newMap;
    });
  }, []);

  // 計算實際需要購買的材料（考慮材料樹結構）
  const actualRequirements = useMemo((): Map<number, number> => {
    const requirements = new Map<number, number>();

    // 簡單模式：直接使用 flattenMaterialTree 計算的總量
    // flattenMaterialTree 已經正確計算了每個材料的總需求量
    // 我們只需要根據中間製品的購買/自製選擇來調整
    
    if (!materialTree) {
      // 沒有材料樹時，直接使用 materials 的數量
      actualMaterials.forEach((m) => {
        const entry = costEntries.get(m.itemId);
        // 若有已擁有數量，需求量應減去已擁有
        const owned = entry?.ownedQty || 0;
        const need = Math.max(0, m.totalAmount * multiplier - owned);
        if (m.isBaseMaterial || entry?.source === 'buy') {
          requirements.set(m.itemId, need);
        }
      });
      return requirements;
    }

    // 有材料樹時，需要根據購買選擇重新計算
    // 建立一個 itemId -> MaterialTreeNode 的映射，方便查找
    const nodeMap = new Map<number, MaterialTreeNode[]>();
    
    const collectNodes = (node: MaterialTreeNode) => {
      const nodes = nodeMap.get(node.itemId) || [];
      nodes.push(node);
      nodeMap.set(node.itemId, nodes);
      node.children.forEach(collectNodes);
    };
    materialTree.children.forEach(collectNodes);

    // 追蹤哪些中間製品選擇購買（它們的子材料不需要計算）
    const purchasedItemIds = new Set<number>();
    craftableMaterials.forEach((m) => {
      const entry = costEntries.get(m.itemId);
      if (entry?.source === 'buy') {
        purchasedItemIds.add(m.itemId);
      }
    });

    // 遞迴計算需求量，跳過已購買中間製品的子樹
    const calculateRequirements = (node: MaterialTreeNode, skipDescendants: boolean) => {
      const entry = costEntries.get(node.itemId);
      const isBuying = entry?.source === 'buy';
      const owned = entry?.ownedQty || 0;

      // 如果父節點已被購買，跳過這個節點
      if (skipDescendants) {
        return;
      }

      // 如果這個節點選擇購買
      if (isBuying) {
        const required = Math.max(0, node.amount * multiplier - owned);
        const current = requirements.get(node.itemId) || 0;
        requirements.set(node.itemId, current + required);
        // 不處理子節點
        return;
      }

      // 如果是基礎材料
      if (node.isBaseMaterial) {
        const required = Math.max(0, node.amount * multiplier - owned);
        const current = requirements.get(node.itemId) || 0;
        requirements.set(node.itemId, current + required);
        return;
      }

      // 選擇自製，處理子節點
      node.children.forEach((child) => {
        calculateRequirements(child, false);
      });
    };

    // 從根節點的直接子節點開始計算
    materialTree.children.forEach((child) => {
      calculateRequirements(child, false);
    });

    return requirements;
  }, [actualMaterials, materialTree, costEntries, multiplier, craftableMaterials]);

  // 計算總成本（使用實際購買數量）
  const calculations = useMemo(() => {
    let totalCost = 0;
    let totalCostByRequirement = 0; // 按需求量計算的成本（用於比較）

    // 基礎材料成本
    actualRequirements.forEach((requiredQty, itemId) => {
      const entry = costEntries.get(itemId);
      const material = actualMaterials.find((m) => m.itemId === itemId);
      if (entry && material?.isBaseMaterial) {
        // 實際成本 = 單價 × 購買數量
        const purchaseQty = entry.purchaseQty || requiredQty;
        totalCost += entry.unitPrice * purchaseQty;
        // 需求成本 = 單價 × 需求量
        totalCostByRequirement += entry.unitPrice * requiredQty;
      }
    });

    // 中間製品成本（選擇購買的）
    craftableMaterials.forEach((material) => {
      const entry = costEntries.get(material.itemId);
      if (entry?.source === 'buy') {
        const requiredQty = actualRequirements.get(material.itemId) || 0;
        const purchaseQty = entry.purchaseQty || requiredQty;
        totalCost += entry.unitPrice * purchaseQty;
        totalCostByRequirement += entry.unitPrice * requiredQty;
      }
    });

    const totalOutput = multiplier * craftYield;
    const costPerUnit = totalOutput > 0 ? totalCost / totalOutput : 0;
    const wastedCost = totalCost - totalCostByRequirement; // 多餘材料成本

    return { totalCost, totalOutput, costPerUnit, wastedCost, totalCostByRequirement };
  }, [actualRequirements, costEntries, multiplier, craftYield, actualMaterials, craftableMaterials]);

  // 計算成本細分（使用購買數量）
  const costBreakdown = useMemo(() => {
    let baseCost = 0;
    let craftableCost = 0;

    // 基礎材料成本
    actualRequirements.forEach((requiredQty, itemId) => {
      const material = actualMaterials.find((m) => m.itemId === itemId);
      const entry = costEntries.get(itemId);
      if (material && entry && material.isBaseMaterial) {
        const purchaseQty = entry.purchaseQty || requiredQty;
        const cost = entry.unitPrice * purchaseQty;
        baseCost += cost;
      }
    });

    // 中間製品成本（選擇購買的）
    craftableMaterials.forEach((material) => {
      const entry = costEntries.get(material.itemId);
      if (entry?.source === 'buy') {
        const actualQty = actualRequirements.get(material.itemId) || 0;
        const purchaseQty = entry.purchaseQty || actualQty;
        const cost = entry.unitPrice * purchaseQty;
        craftableCost += cost;
      }
    });

    return { baseCost, craftableCost };
  }, [actualRequirements, actualMaterials, costEntries, craftableMaterials]);

  // 計算瓶頸分析（哪個材料限制了製作數量）
  const bottleneckAnalysis = useMemo(() => {
    if (!materialTree) return [];

    const analysis: {
      itemId: number;
      name: string;
      iconUrl: string;
      requiredPerCraft: number; // 每次製作需要的數量
      currentPurchase: number; // 目前購買數量
      canCraft: number; // 可製作數量
      shortage: number; // 差多少可以多製作一個
      additionalCost: number; // 多製作一個需要的額外成本
    }[] = [];

    // 獲取每個基礎材料每次製作需要的數量
    baseMaterials.forEach((material) => {
      const entry = costEntries.get(material.itemId);
      const requiredQty = actualRequirements.get(material.itemId) || 0;
      if (!entry || requiredQty === 0) return;

      // 每次製作需要的數量 = 總需求 / 製作倍數
      const requiredPerCraft = requiredQty / multiplier;
      const currentPurchase = entry.purchaseQty || requiredQty;
      
      // 這個材料可以支撐幾次製作
      const canCraft = requiredPerCraft > 0 ? Math.floor(currentPurchase / requiredPerCraft) : Infinity;
      
      // 差多少可以多製作一次
      const nextCraftRequired = (canCraft + 1) * requiredPerCraft;
      const shortage = Math.max(0, Math.ceil(nextCraftRequired - currentPurchase));
      
      // 多製作一個需要的額外成本
      const additionalCost = shortage * entry.unitPrice;

      analysis.push({
        itemId: material.itemId,
        name: material.item.name,
        iconUrl: material.item.iconUrl,
        requiredPerCraft,
        currentPurchase,
        canCraft,
        shortage,
        additionalCost,
      });
    });

    // 按可製作數量排序（瓶頸在前）
    return analysis.sort((a, b) => a.canCraft - b.canCraft);
  }, [baseMaterials, costEntries, actualRequirements, multiplier, materialTree]);

  // 最大可製作數量（受限於購買數量最少的材料）
  const maxCraftable = useMemo(() => {
    if (bottleneckAnalysis.length === 0) return multiplier;
    return Math.min(...bottleneckAnalysis.map((b) => b.canCraft));
  }, [bottleneckAnalysis, multiplier]);

  // 通知父組件
  useEffect(() => {
    onCostChange?.(calculations.totalCost, calculations.costPerUnit);
  }, [calculations.totalCost, calculations.costPerUnit, onCostChange]);

  // 全部設為購買
  const setAllToBuy = useCallback(() => {
    setCostEntries((prev) => {
      const newMap = new Map(prev);
      actualMaterials.forEach((m) => {
        const entry = newMap.get(m.itemId);
        const requiredQty = actualRequirements.get(m.itemId) || m.totalAmount * multiplier;
        if (entry) {
          newMap.set(m.itemId, { ...entry, source: 'buy', purchaseQty: requiredQty });
        }
      });
      return newMap;
    });
  }, [actualMaterials, actualRequirements, multiplier]);

  // 全部設為自製
  const setAllToCraft = useCallback(() => {
    setCostEntries((prev) => {
      const newMap = new Map(prev);
      actualMaterials.forEach((m) => {
        const entry = newMap.get(m.itemId);
        const requiredQty = actualRequirements.get(m.itemId) || m.totalAmount * multiplier;
        if (entry) {
          newMap.set(m.itemId, {
            ...entry,
            source: m.isBaseMaterial ? 'buy' : 'craft',
            purchaseQty: m.isBaseMaterial ? requiredQty : entry.purchaseQty,
          });
        }
      });
      return newMap;
    });
  }, [actualMaterials, actualRequirements, multiplier]);

  // 同步購買數量到需求量
  const syncPurchaseToRequired = useCallback(() => {
    setCostEntries((prev) => {
      const newMap = new Map(prev);
      actualRequirements.forEach((requiredQty, itemId) => {
        const entry = newMap.get(itemId);
        if (entry) {
          newMap.set(itemId, { ...entry, purchaseQty: requiredQty });
        }
      });
      return newMap;
    });
  }, [actualRequirements]);

  // 儲存生產紀錄（localStorage 原型）
  const saveProductionRecord = useCallback(() => {
    try {
      // 建立 itemId -> 物品名稱的映射
      const itemNameMap = new Map<number, string>();
      actualMaterials.forEach((m) => {
        itemNameMap.set(m.itemId, m.item.name);
      });

      // 只儲存實際需要的材料（需求量 > 0 或購買中間製品）
      const filteredEntries = Array.from(costEntries.values())
        .filter((entry) => {
          const requiredQty = actualRequirements.get(entry.itemId) || 0;
          // 保留需求量 > 0 的材料，或者選擇購買的中間製品
          return requiredQty > 0 || (entry.source === 'buy' && entry.purchaseQty > 0);
        })
        .map((entry) => ({
          ...entry,
          itemName: itemNameMap.get(entry.itemId) || undefined,
        }));

      const record = {
        id: `rec_${Date.now()}`,
        createdAt: new Date().toISOString(),
        multiplier,
        craftYield,
        totalCost: calculations.totalCost,
        costPerUnit: calculations.costPerUnit,
        costBreakdown,
        entries: filteredEntries,
        materialTree: materialTree ? { itemId: materialTree.itemId, name: (materialTree as any).item?.name } : null,
        // 利潤計算相關設定
        profitSettings: {
          sellPrice,
          taxRate,
          reserveQty,
        },
      } as const;

      const key = 'production_records';
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      arr.unshift(record);
      localStorage.setItem(key, JSON.stringify(arr));
      alert('已儲存生產紀錄');
    } catch (e) {
      console.error(e);
      alert('儲存失敗');
    }
  }, [calculations, costBreakdown, costEntries, multiplier, craftYield, materialTree, sellPrice, taxRate, reserveQty]);

  if (actualMaterials.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">沒有需要計算成本的材料</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 控制列 */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            製作數量：
          </span>
          <input
            type="number"
            min={1}
            value={multiplier}
            onChange={(e) =>
              setMultiplier(Math.max(1, parseInt(e.target.value) || 1))
            }
            className="w-20 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={setAllToCraft}
            className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
          >
            全部自製
          </button>
          <button
            onClick={setAllToBuy}
            className="px-3 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
          >
            全部購買
          </button>
          <button
            onClick={syncPurchaseToRequired}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400"
          >
            同步購買量
          </button>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showBottleneck}
            onChange={(e) => setShowBottleneck(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-600 dark:text-gray-400">
            顯示瓶頸分析
          </span>
        </label>
      </div>

      {/* 中間製品（可製作的材料） */}
      {craftableMaterials.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-2">
            <span>🔧</span> 中間製品
            <span className="text-xs font-normal text-gray-500">
              （可選擇購買或自製）
            </span>
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-blue-50 dark:bg-blue-900/20">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                    材料
                  </th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-400">
                    來源
                  </th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-400">
                    HQ
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">
                    需求量
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">
                    購買量
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">
                    購買單價
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">
                    小計
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {craftableMaterials.map((material) => {
                  const entry = costEntries.get(material.itemId);
                  const isBuying = entry?.source === 'buy';
                  const actualQty = actualRequirements.get(material.itemId) || 0;
                  const originalQty = material.totalAmount * multiplier;
                  const subtotal = isBuying ? (entry?.unitPrice || 0) * actualQty : 0;

                  return (
                    <tr
                      key={material.itemId}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${
                        isBuying ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <img
                            src={material.item.iconUrl}
                            alt={material.item.name}
                            className="w-6 h-6"
                          />
                          <span className="font-medium truncate max-w-[150px]">
                            {material.item.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-center gap-2 items-center">
                          <button
                            onClick={() => { updateSource(material.itemId, 'craft'); updatePossession(material.itemId, 'craft'); }}
                            className={`px-2 py-1 text-xs rounded transition-colors ${!isBuying ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700'}`}
                          >
                            自製
                          </button>
                          <button
                            onClick={() => { updateSource(material.itemId, 'buy'); updatePossession(material.itemId, 'buy'); }}
                            className={`px-2 py-1 text-xs rounded transition-colors ${isBuying ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700'}`}
                          >
                            購買
                          </button>
                          <button
                            onClick={() => { updatePossession(material.itemId, 'have'); updateSource(material.itemId, 'buy'); }}
                            className={`px-2 py-1 text-xs rounded transition-colors ${entry?.possession === 'have' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700'}`}
                          >
                            已擁有
                          </button>
                          {entry?.possession === 'have' && (
                            <input
                              type="number"
                              min={0}
                              value={entry?.ownedQty || 0}
                              onChange={(e) => updateOwnedQty(material.itemId, Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-20 px-2 py-1 text-sm border rounded text-right"
                              title="已擁有數量"
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <label className="inline-flex items-center gap-1 cursor-pointer" title="優質材料（可用於計算初期品質）">
                          <input
                            type="checkbox"
                            checked={entry?.isHQ || false}
                            onChange={(e) => updateIsHQ(material.itemId, e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                          />
                          {entry?.isHQ && <span className="text-xs text-amber-500 font-bold">HQ</span>}
                        </label>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                        {isBuying ? (
                          <span>{actualQty}</span>
                        ) : (
                          <span className="text-gray-400 line-through">
                            {originalQty}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isBuying ? (
                          <div className="flex items-center justify-end gap-2">
                            <input
                              type="number"
                              min={0}
                              value={entry?.purchaseQty || actualQty}
                              onChange={(e) =>
                                updatePurchaseQty(
                                  material.itemId,
                                  Math.max(0, parseInt(e.target.value) || 0)
                                )
                              }
                              className={`w-20 px-2 py-1 text-right text-sm border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 ${(entry?.purchaseQty || actualQty) < actualQty ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : ''} ${(entry?.purchaseQty || actualQty) > actualQty ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' : ''}`}
                            />
                            {entry?.possession === 'have' && (
                              <span className="text-xs text-green-600">擁有 {entry?.ownedQty || 0}</span>
                            )}
                            {(entry?.purchaseQty || actualQty) > actualQty && (
                              <span className="text-xs text-amber-600" title="多餘數量">
                                +{(entry?.purchaseQty || actualQty) - actualQty}
                              </span>
                            )}
                            {(entry?.purchaseQty || actualQty) < actualQty && (
                              <span className="text-xs text-red-600" title="不足數量">
                                -{actualQty - (entry?.purchaseQty || actualQty)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          value={entry?.unitPrice || ''}
                          onChange={(e) =>
                            updateUnitPrice(
                              material.itemId,
                              Math.max(0, parseFloat(e.target.value) || 0)
                            )
                          }
                          disabled={!isBuying}
                          className={`w-24 px-2 py-1 text-right text-sm border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 ${
                            !isBuying ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          placeholder="市場價"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {isBuying && (() => {
                          const purchaseQty = entry?.purchaseQty || actualQty;
                          const cost = (entry?.unitPrice || 0) * purchaseQty;
                          return cost > 0 ? (
                            <span className="text-amber-600">
                              {cost.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          );
                        })()}
                        {!isBuying && <span className="text-gray-400">-</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 基礎材料 */}
      <div className="space-y-2">
        <h4 className="font-semibold text-green-600 dark:text-green-400 flex items-center gap-2">
          <span>🌿</span> 基礎材料
          <span className="text-xs font-normal text-gray-500">
            （需採集/購買）
          </span>
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-green-50 dark:bg-green-900/20">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                  材料
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">
                  需求量
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">
                  購買量
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">
                  單價
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">
                  小計
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {baseMaterials.map((material) => {
                const entry = costEntries.get(material.itemId);
                const actualQty = actualRequirements.get(material.itemId) || 0;
                const purchaseQty = entry?.purchaseQty || actualQty;
                const subtotal = (entry?.unitPrice || 0) * purchaseQty;
                const hasExcess = purchaseQty > actualQty;
                const hasShortage = purchaseQty < actualQty;

                return (
                  <tr
                    key={material.itemId}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      actualQty === 0 ? 'opacity-40' : ''
                    } ${hasShortage ? 'bg-red-50 dark:bg-red-900/10' : ''}`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <img
                          src={material.item.iconUrl}
                          alt={material.item.name}
                          className="w-6 h-6"
                        />
                        <span className="font-medium truncate max-w-[150px]">
                          {material.item.name}
                        </span>
                        {actualQty === 0 && (
                          <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded">
                            已購買中間製品
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                      {actualQty}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { updateSource(material.itemId, 'craft'); updatePossession(material.itemId, 'craft'); }}
                            className={`px-2 py-1 text-xs rounded ${entry?.possession === 'craft' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}
                          >
                            自製
                          </button>
                          <button
                            onClick={() => { updateSource(material.itemId, 'buy'); updatePossession(material.itemId, 'buy'); }}
                            className={`px-2 py-1 text-xs rounded ${entry?.possession === 'buy' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'}`}
                          >
                            購買
                          </button>
                          <button
                            onClick={() => { updatePossession(material.itemId, 'have'); updateSource(material.itemId, 'buy'); }}
                            className={`px-2 py-1 text-xs rounded ${entry?.possession === 'have' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}
                          >
                            已擁有
                          </button>
                        </div>
                        <input
                          type="number"
                          min={0}
                          value={purchaseQty}
                          onChange={(e) =>
                            updatePurchaseQty(
                              material.itemId,
                              Math.max(0, parseInt(e.target.value) || 0)
                            )
                          }
                          disabled={actualQty === 0}
                          className={`w-20 px-2 py-1 text-right text-sm border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 ${
                            actualQty === 0 ? 'opacity-50 cursor-not-allowed' : ''
                          } ${hasShortage ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : ''} ${
                            hasExcess ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' : ''
                          }`}
                        />
                        {entry?.possession === 'have' && (
                          <input
                            type="number"
                            min={0}
                            value={entry?.ownedQty || 0}
                            onChange={(e) => updateOwnedQty(material.itemId, Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-20 px-2 py-1 text-sm border rounded text-right"
                            title="已擁有數量"
                          />
                        )}
                        {hasExcess && (
                          <span className="text-xs text-amber-600" title="多餘數量">
                            +{purchaseQty - actualQty}
                          </span>
                        )}
                        {hasShortage && (
                          <span className="text-xs text-red-600" title="不足數量">
                            -{actualQty - purchaseQty}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        value={entry?.unitPrice || ''}
                        onChange={(e) =>
                          updateUnitPrice(
                            material.itemId,
                            Math.max(0, parseFloat(e.target.value) || 0)
                          )
                        }
                        disabled={actualQty === 0}
                        className={`w-24 px-2 py-1 text-right text-sm border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 ${
                          actualQty === 0 ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        placeholder="市場價"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {subtotal > 0 ? subtotal.toLocaleString() : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 瓶頸分析 */}
      {showBottleneck && bottleneckAnalysis.length > 0 && (
        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
          <h4 className="font-semibold mb-3 text-orange-700 dark:text-orange-400 flex items-center gap-2">
            <span>🔍</span> 瓶頸分析
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <span>目前購買量可製作：</span>
              <span className="font-bold text-lg text-orange-600">{maxCraftable}</span>
              <span>次</span>
              {maxCraftable < multiplier && (
                <span className="text-red-500 text-xs">
                  (不足 {multiplier - maxCraftable} 次)
                </span>
              )}
            </div>
            <div className="mt-3 space-y-1">
              <div className="text-xs text-gray-500 mb-2">
                要多製作一次，需要額外購買：
              </div>
              {bottleneckAnalysis
                .filter((b) => b.shortage > 0)
                .slice(0, 5)
                .map((b) => (
                  <div
                    key={b.itemId}
                    className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <img src={b.iconUrl} alt={b.name} className="w-5 h-5" />
                      <span className="font-medium">{b.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-500">
                        還需 <span className="text-orange-600 font-bold">{b.shortage}</span> 個
                      </span>
                      {b.additionalCost > 0 && (
                        <span className="text-blue-600">
                          (+{b.additionalCost.toLocaleString()} 金)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* 成本摘要 */}
      <div className="space-y-4">
        {/* 購買清單摘要 */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h4 className="font-semibold mb-3 text-gray-900 dark:text-white">
            📋 購買清單摘要
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">基礎材料成本：</span>
                <span className="font-medium">
                  {costBreakdown.baseCost.toLocaleString()}
                </span>
              </div>
              {costBreakdown.craftableCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">中間製品成本：</span>
                  <span className="font-medium text-amber-600">
                    {costBreakdown.craftableCost.toLocaleString()}
                  </span>
                </div>
              )}
              {calculations.wastedCost > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span className="text-amber-500">多餘材料成本：</span>
                  <span className="font-medium">
                    +{calculations.wastedCost.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="font-semibold">總成本：</span>
                <span className="font-bold text-blue-600">
                  {calculations.totalCost.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">製作次數：</span>
                <span className="font-medium">{multiplier} 次</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">每次產出：</span>
                <span className="font-medium">{craftYield} 個</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="font-semibold">總產出：</span>
                <span className="font-bold text-purple-600">
                  {calculations.totalOutput} 個
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 計算結果卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
          <div className="text-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">總成本</div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {calculations.totalCost.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">金幣</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">製作數量</div>
            <div className="text-xl font-bold text-green-600 dark:text-green-400">
              {multiplier}
            </div>
            <div className="text-xs text-gray-500">次</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">總產出</div>
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
              {calculations.totalOutput}
            </div>
            <div className="text-xs text-gray-500">個</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">單位成本</div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {calculations.costPerUnit > 0
                ? calculations.costPerUnit.toFixed(2)
                : '-'}
            </div>
            <div className="text-xs text-gray-500">金幣/個</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={saveProductionRecord}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          儲存生產紀錄
        </button>
      </div>

      {/* 利潤計算器 */}
      <ProfitCalculator
        costPerUnit={calculations.costPerUnit}
        totalOutput={calculations.totalOutput}
        totalCost={calculations.totalCost}
        sellPrice={sellPrice}
        onSellPriceChange={setSellPrice}
        taxRate={taxRate}
        onTaxRateChange={setTaxRate}
        reserveQty={reserveQty}
        onReserveQtyChange={setReserveQty}
      />
    </div>
  );
}

// 利潤計算器
function ProfitCalculator({
  costPerUnit,
  totalOutput,
  totalCost,
  sellPrice,
  onSellPriceChange,
  taxRate,
  onTaxRateChange,
  reserveQty,
  onReserveQtyChange,
}: {
  costPerUnit: number;
  totalOutput: number;
  totalCost: number;
  sellPrice: number;
  onSellPriceChange: (price: number) => void;
  taxRate: number;
  onTaxRateChange: (rate: number) => void;
  reserveQty: number;
  onReserveQtyChange: (qty: number) => void;
}) {
  // 實際可販售數量 = 總產出 - 保留數量
  const sellableOutput = Math.max(0, totalOutput - reserveQty);
  // 保留數量攤提到成本：實際用於銷售的成本 = 總成本 × (可販售 / 總產出)
  const adjustedCost = totalOutput > 0 ? totalCost * (sellableOutput / totalOutput) : 0;
  const adjustedCostPerUnit = sellableOutput > 0 ? adjustedCost / sellableOutput : 0;

  const profit = useMemo(() => {
    if (sellableOutput <= 0 || sellPrice <= 0) return null;

    const grossRevenue = sellPrice * sellableOutput;
    const tax = grossRevenue * (taxRate / 100);
    const netRevenue = grossRevenue - tax;
    const netProfit = netRevenue - adjustedCost;
    const profitPerUnit = netProfit / sellableOutput;
    const profitMargin = adjustedCost > 0 ? (netProfit / adjustedCost) * 100 : 0;

    return {
      grossRevenue,
      tax,
      netRevenue,
      netProfit,
      profitPerUnit,
      profitMargin,
      sellableOutput,
      reservedValue: reserveQty * costPerUnit, // 保留品價值
    };
  }, [sellPrice, taxRate, sellableOutput, adjustedCost, reserveQty, costPerUnit]);

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <h4 className="font-semibold mb-3 text-gray-900 dark:text-white">
        💰 利潤計算
      </h4>
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">
            售價：
          </label>
          <input
            type="number"
            min={0}
            value={sellPrice || ''}
            onChange={(e) =>
              onSellPriceChange(Math.max(0, parseFloat(e.target.value) || 0))
            }
            className="w-28 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
            placeholder="輸入售價"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">
            稅率：
          </label>
          <select
            value={taxRate}
            onChange={(e) => onTaxRateChange(parseFloat(e.target.value))}
            className="px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
          >
            <option value={0}>0% (免稅)</option>
            <option value={3}>3% (3級)</option>
            <option value={5}>5% (預設)</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">
            保留數量：
          </label>
          <input
            type="number"
            min={0}
            max={totalOutput}
            value={reserveQty || ''}
            onChange={(e) =>
              onReserveQtyChange(Math.min(totalOutput, Math.max(0, parseInt(e.target.value) || 0)))
            }
            className="w-20 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
            placeholder="0"
          />
          <span className="text-xs text-gray-500">/ {totalOutput}</span>
        </div>
      </div>

      {/* 保留數量說明 */}
      {reserveQty > 0 && (
        <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-sm">
          <div className="flex items-center justify-between">
            <span className="text-purple-600 dark:text-purple-400">
              🎁 保留 {reserveQty} 個自用（價值約 {Math.round(reserveQty * costPerUnit).toLocaleString()} 金）
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              可販售：{sellableOutput} 個
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            成本將按可販售比例計算：{Math.round(adjustedCost).toLocaleString()} 金（單位 {adjustedCostPerUnit.toFixed(2)} 金）
          </div>
        </div>
      )}

      {profit && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div className="p-2 bg-white dark:bg-gray-800 rounded">
            <div className="text-gray-500">總收入</div>
            <div className="font-semibold">
              {profit.grossRevenue.toLocaleString()}
            </div>
          </div>
          <div className="p-2 bg-white dark:bg-gray-800 rounded">
            <div className="text-gray-500">稅金</div>
            <div className="font-semibold text-red-500">
              -{Math.round(profit.tax).toLocaleString()}
            </div>
          </div>
          <div className="p-2 bg-white dark:bg-gray-800 rounded">
            <div className="text-gray-500">淨收入</div>
            <div className="font-semibold">
              {Math.round(profit.netRevenue).toLocaleString()}
            </div>
          </div>
          <div className="p-2 bg-white dark:bg-gray-800 rounded">
            <div className="text-gray-500">淨利潤</div>
            <div
              className={`font-bold text-lg ${
                profit.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {profit.netProfit >= 0 ? '+' : ''}
              {Math.round(profit.netProfit).toLocaleString()}
            </div>
          </div>
          <div className="p-2 bg-white dark:bg-gray-800 rounded">
            <div className="text-gray-500">每個利潤</div>
            <div
              className={`font-semibold ${
                profit.profitPerUnit >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {profit.profitPerUnit >= 0 ? '+' : ''}
              {profit.profitPerUnit.toFixed(2)}
            </div>
          </div>
          <div className="p-2 bg-white dark:bg-gray-800 rounded">
            <div className="text-gray-500">利潤率</div>
            <div
              className={`font-semibold ${
                profit.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {profit.profitMargin >= 0 ? '+' : ''}
              {profit.profitMargin.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {!profit && (
        <div className="text-sm text-gray-500 text-center py-2">
          輸入售價後查看利潤計算
        </div>
      )}
    </div>
  );
}
