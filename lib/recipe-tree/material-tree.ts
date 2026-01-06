// ============================================
// 材料樹遞歸拆解邏輯
// 參考自 ffxiv-teamcraft 專案
// ============================================

import type {
  Recipe,
  MaterialTreeNode,
  FlattenedMaterial,
  Item,
} from '@/types';

import { fetchRecipe, fetchItem } from '@/hooks/use-xivapi';

// ---- 材料樹快取 ----
const recipeCache = new Map<number, Recipe | null>();
const itemCache = new Map<number, Item>();

/**
 * 建構材料樹（遞歸）
 * 這是核心的材料拆解演算法
 */
export async function buildMaterialTree(
  itemId: number,
  amount: number = 1,
  depth: number = 0,
  maxDepth: number = 10,
  visited: Set<number> = new Set()
): Promise<MaterialTreeNode> {
  // 防止無限遞歸
  if (depth >= maxDepth || visited.has(itemId)) {
    const item = await getCachedItem(itemId);
    return {
      itemId,
      item,
      amount,
      depth,
      children: [],
      isBaseMaterial: true,
    };
  }

  visited.add(itemId);

  // 獲取物品資訊
  const item = await getCachedItem(itemId);
  
  // 獲取配方（如果有的話）
  const recipe = await getCachedRecipe(itemId);

  // 如果沒有配方，這是基礎材料
  if (!recipe) {
    return {
      itemId,
      item,
      amount,
      depth,
      children: [],
      isBaseMaterial: true,
    };
  }

  // 計算需要製作的數量（配方可能產出多個）
  const craftCount = Math.ceil(amount / (recipe.craftTypeLevel || 1));

  // 遞歸處理所有材料
  const children = await Promise.all(
    recipe.ingredients.map(async (ingredient) => {
      const requiredAmount = ingredient.amount * craftCount;
      return buildMaterialTree(
        ingredient.itemId,
        requiredAmount,
        depth + 1,
        maxDepth,
        new Set(visited)
      );
    })
  );

  return {
    itemId,
    item,
    amount,
    recipe,
    depth,
    children,
    isBaseMaterial: false,
  };
}

/**
 * 將材料樹攤平為清單
 * 合併相同材料的數量
 */
export function flattenMaterialTree(
  tree: MaterialTreeNode,
  includeIntermediates: boolean = false
): FlattenedMaterial[] {
  const materialMap = new Map<number, FlattenedMaterial>();

  function traverse(node: MaterialTreeNode): void {
    // 只加入基礎材料，或者如果指定包含中間產物
    if (node.isBaseMaterial || includeIntermediates) {
      const existing = materialMap.get(node.itemId);
      if (existing) {
        existing.totalAmount += node.amount;
      } else {
        materialMap.set(node.itemId, {
          itemId: node.itemId,
          item: node.item,
          totalAmount: node.amount,
          isBaseMaterial: node.isBaseMaterial,
        });
      }
    }

    // 遞歸處理子節點
    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(tree);
  return Array.from(materialMap.values());
}

/**
 * 計算材料總成本（市場價格）
 */
export function calculateTotalCost(
  materials: FlattenedMaterial[],
  marketPrices: Map<number, number>
): number {
  return materials.reduce((total, material) => {
    const price = marketPrices.get(material.itemId) || 0;
    return total + price * material.totalAmount;
  }, 0);
}

/**
 * 根據持有數量計算還需要的材料
 */
export function calculateRemainingMaterials(
  required: FlattenedMaterial[],
  inventory: Map<number, number>
): FlattenedMaterial[] {
  return required
    .map((material) => {
      const owned = inventory.get(material.itemId) || 0;
      const remaining = Math.max(0, material.totalAmount - owned);
      return {
        ...material,
        totalAmount: remaining,
      };
    })
    .filter((m) => m.totalAmount > 0);
}

/**
 * 產生製作順序
 * 根據相依性排序，確保先製作所需的中間產物
 */
export function generateCraftingOrder(
  tree: MaterialTreeNode
): MaterialTreeNode[] {
  const order: MaterialTreeNode[] = [];
  const processed = new Set<number>();

  function traverse(node: MaterialTreeNode): void {
    // 先處理子節點（相依項）
    for (const child of node.children) {
      if (!child.isBaseMaterial && !processed.has(child.itemId)) {
        traverse(child);
      }
    }

    // 加入當前節點（如果是可製作的）
    if (!node.isBaseMaterial && !processed.has(node.itemId)) {
      order.push(node);
      processed.add(node.itemId);
    }
  }

  traverse(tree);
  return order;
}

/**
 * 取得快取的配方
 */
async function getCachedRecipe(itemId: number): Promise<Recipe | null> {
  if (recipeCache.has(itemId)) {
    return recipeCache.get(itemId) || null;
  }

  try {
    const recipe = await fetchRecipe(itemId);
    recipeCache.set(itemId, recipe);
    return recipe;
  } catch {
    recipeCache.set(itemId, null);
    return null;
  }
}

/**
 * 取得快取的物品
 */
async function getCachedItem(itemId: number): Promise<Item> {
  if (itemCache.has(itemId)) {
    return itemCache.get(itemId)!;
  }

  const item = await fetchItem(itemId);
  itemCache.set(itemId, item);
  return item;
}

/**
 * 清除快取
 */
export function clearCache(): void {
  recipeCache.clear();
  itemCache.clear();
}

/**
 * 預載多個物品的配方
 * 用於批量處理時提高效能
 */
export async function preloadRecipes(itemIds: number[]): Promise<void> {
  const uncached = itemIds.filter((id) => !recipeCache.has(id));
  
  await Promise.all(
    uncached.map(async (id) => {
      try {
        const recipe = await fetchRecipe(id);
        recipeCache.set(id, recipe);
      } catch {
        recipeCache.set(id, null);
      }
    })
  );
}
