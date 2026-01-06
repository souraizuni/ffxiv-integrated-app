import { NextResponse } from 'next/server';

const XIVAPI_BASE = 'https://xivapi.com';

// 配方快取
const recipeCache = new Map<number, RecipeData | null>();

interface MaterialTreeNode {
  itemId: number;
  item: {
    id: number;
    name: string;
    name_zh: string;
    icon: string;
    iconUrl: string;
  };
  amount: number;
  recipe?: {
    id: number;
    craftType: number;
    recipeLevel: number;
  };
  depth: number;
  children: MaterialTreeNode[];
  isBaseMaterial: boolean;
}

interface RecipeData {
  id: number;
  itemId: number;
  craftType: number;
  amountResult: number;
  recipeLevel: number;
  ingredients: Array<{ itemId: number; amount: number }>;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get('itemId');
  const depth = parseInt(searchParams.get('depth') || '5');

  if (!itemId) {
    return NextResponse.json(
      { error: '缺少 itemId 參數' },
      { status: 400 }
    );
  }

  try {
    const tree = await buildMaterialTree(parseInt(itemId), 1, 0, depth);
    return NextResponse.json({ tree });
  } catch (error) {
    console.error('建構材料樹失敗:', error);
    return NextResponse.json(
      { error: '無法建構材料樹' },
      { status: 500 }
    );
  }
}

async function buildMaterialTree(
  itemId: number,
  amount: number,
  currentDepth: number,
  maxDepth: number,
  visited: Set<number> = new Set()
): Promise<MaterialTreeNode> {
  // 防止無限遞歸
  if (currentDepth >= maxDepth || visited.has(itemId)) {
    const item = await fetchItem(itemId);
    return {
      itemId,
      item,
      amount,
      depth: currentDepth,
      children: [],
      isBaseMaterial: true,
    };
  }

  visited.add(itemId);

  const item = await fetchItem(itemId);
  const recipe = await fetchRecipeByItemId(itemId);

  if (!recipe) {
    return {
      itemId,
      item,
      amount,
      depth: currentDepth,
      children: [],
      isBaseMaterial: true,
    };
  }

  const craftCount = Math.ceil(amount / (recipe.amountResult ?? 1));

  const children = await Promise.all(
    recipe.ingredients.map(async (ingredient) => {
      const requiredAmount = ingredient.amount * craftCount;
      return buildMaterialTree(
        ingredient.itemId,
        requiredAmount,
        currentDepth + 1,
        maxDepth,
        new Set(visited)
      );
    })
  );

  return {
    itemId,
    item,
    amount,
    recipe: {
      id: recipe.id,
      craftType: recipe.craftType,
      recipeLevel: recipe.recipeLevel,
    },
    depth: currentDepth,
    children,
    isBaseMaterial: false,
  };
}

async function fetchItem(itemId: number) {
  const res = await fetch(`${XIVAPI_BASE}/Item/${itemId}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`無法獲取物品 ${itemId}`);
  }

  const data = await res.json();
  return {
    id: data.ID,
    name: data.Name,
    name_zh: data.Name_chs || data.Name,
    icon: data.Icon,
    iconUrl: `${XIVAPI_BASE}${data.Icon}`,
  };
}

async function fetchRecipeByItemId(itemId: number): Promise<RecipeData | null> {
  if (recipeCache.has(itemId)) {
    return recipeCache.get(itemId) ?? null;
  }

  const searchRes = await fetch(
    `${XIVAPI_BASE}/search?indexes=Recipe&filters=ItemResult.ID=${itemId}`,
    { next: { revalidate: 3600 } }
  );

  if (!searchRes.ok) {
    recipeCache.set(itemId, null);
    return null;
  }

  const searchData = await searchRes.json();
  const recipeId = searchData.Results?.[0]?.ID;

  if (!recipeId) {
    recipeCache.set(itemId, null);
    return null;
  }

  const recipeRes = await fetch(`${XIVAPI_BASE}/Recipe/${recipeId}`, {
    next: { revalidate: 3600 },
  });

  if (!recipeRes.ok) {
    recipeCache.set(itemId, null);
    return null;
  }

  const data = await recipeRes.json();

  const ingredients: Array<{ itemId: number; amount: number }> = [];
  for (let i = 0; i <= 9; i++) {
    const item = data[`ItemIngredient${i}`];
    const amount = data[`AmountIngredient${i}`];
    if (item?.ID && amount > 0) {
      ingredients.push({ itemId: item.ID, amount });
    }
  }

  const recipe: RecipeData = {
    id: data.ID,
    itemId: data.ItemResult?.ID,
    craftType: data.CraftType?.ID,
    amountResult: data.AmountResult || 1,
    recipeLevel: data.RecipeLevelTable?.ClassJobLevel || 1,
    ingredients,
  };

  recipeCache.set(itemId, recipe);
  return recipe;
}
