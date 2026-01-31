// ============================================
// XIVAPI v2 + Cafemaker 資料請求 Hooks
// 支援英文 (XIVAPI v2) 和中文 (Cafemaker) 搜尋
// 顯示使用繁體中文 (tw-items.json)
// ============================================

import useSWR from 'swr';
import type {
  Item,
  Recipe,
  RecipeIngredient,
} from '@/types';
import { getItemNameTwOrFallback, simplifiedToTw } from '@/lib/i18n/tw-translation';

// API 端點
const XIVAPI_V2_BASE = 'https://v2.xivapi.com/api';
const CAFEMAKER_BASE = 'https://cafemaker.wakingsands.com';

// ---- 檢測文字是否包含中文 ----
function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text);
}

// ---- 繁體轉簡體映射表（常用 FFXIV 相關詞彙）----
const traditionalToSimplified: Record<string, string> = {
  // 金屬材料
  '鐵': '铁', '銅': '铜', '銀': '银', '鋼': '钢', '錠': '锭', '礦': '矿',
  '鋁': '铝', '鎳': '镍', '鋅': '锌', '錫': '锡', '鉛': '铅', '鈦': '钛',
  '鎢': '钨', '鉻': '铬', '鉑': '铂', '鑽': '钻', '鋒': '锋', '鏈': '链',
  // 布料/皮革
  '絲': '丝', '緞': '缎', '線': '线', '織': '织', '紗': '纱',
  '縫': '缝', '綿': '绵', '繡': '绣', '編': '编', '紋': '纹',
  // 木材
  '樹': '树', '葉': '叶', '楓': '枫', '櫻': '樱', '檜': '桧',
  '樺': '桦', '楊': '杨',
  // 裝備
  '劍': '剑', '槍': '枪', '環': '环', '鐲': '镯', '飾': '饰',
  '鎧': '铠',
  // 職業
  '鍛': '锻', '煉': '炼', '調': '调', '製': '制',
  // 動作/狀態
  '強': '强', '進': '进', '開': '开', '關': '关', '點': '点', '發': '发',
  '頭': '头', '變': '变', '遠': '远', '極': '极', '術': '术', '戰': '战',
  '護': '护', '衛': '卫', '擊': '击',
  // 常用字
  '與': '与', '個': '个', '無': '无', '為': '为', '這': '这', '從': '从',
  '時': '时', '過': '过', '對': '对', '後': '后', '還': '还',
  '長': '长', '當': '当', '實': '实', '現': '现', '將': '将', '種': '种',
  '動': '动', '機': '机', '電': '电', '業': '业', '數': '数', '問': '问',
  '學': '学', '國': '国', '產': '产', '見': '见', '經': '经', '話': '话',
  '說': '说', '間': '间', '給': '给', '來': '来', '東': '东', '風': '风',
  '書': '书', '龍': '龙', '馬': '马', '魚': '鱼', '鳥': '鸟', '雞': '鸡',
  '貓': '猫', '獸': '兽', '蟲': '虫', '藥': '药', '獵': '猎', '飛': '飞',
  '華': '华', '萬': '万', '億': '亿', '寶': '宝', '靈': '灵', '聖': '圣',
  '亞': '亚', '區': '区', '圖': '图', '場': '场', '貝': '贝', '財': '财',
  '買': '买', '賣': '卖', '價': '价', '貨': '货', '質': '质', '費': '费',
  '紅': '红', '綠': '绿', '藍': '蓝', '黃': '黄',
  // FFXIV 特殊詞彙
  '歐': '欧', '澤': '泽', '陸': '陆', '傳': '传',
};

// ---- 繁體轉簡體 ----
function toSimplified(text: string): string {
  let result = text;
  for (const [trad, simp] of Object.entries(traditionalToSimplified)) {
    result = result.replaceAll(trad, simp);
  }
  return result;
}

// ---- Fetcher 函式 ----
async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API 請求失敗: ${res.status}`);
  }
  return res.json();
}

// ---- 取得圖示 URL ----
function getIconUrl(iconPath: string): string {
  if (iconPath.startsWith('/i/')) {
    // Cafemaker 格式
    return `${CAFEMAKER_BASE}${iconPath}`;
  }
  // XIVAPI v2 格式
  return `${XIVAPI_V2_BASE}/asset?path=${encodeURIComponent(iconPath)}&format=png`;
}

// ---- 物品資料 ----
export function useItem(itemId: number | null) {
  // 使用 Cafemaker 獲取物品（支援中文名稱）
  const { data, error, isLoading } = useSWR<CafemakerItemResponse>(
    itemId ? `${CAFEMAKER_BASE}/Item/${itemId}?columns=ID,Name,Name_en,Name_ja,Icon,Description,LevelItem,StackSize,IsUntradable,ItemUICategory.ID,ItemUICategory.Name` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  const item: Item | null = data
    ? {
        id: data.ID,
        // 優先使用繁體中文翻譯，否則將簡體轉繁體
        name: getItemNameTwOrFallback(data.ID, simplifiedToTw(data.Name)),
        name_en: data.Name_en || data.Name,
        name_ja: data.Name_ja || data.Name,
        name_zh: data.Name,
        icon: data.Icon || '',
        iconUrl: data.Icon ? getIconUrl(data.Icon) : '',
        description: data.Description || '',
        itemLevel: data.LevelItem || 1,
        stackSize: data.StackSize || 1,
        isUntradable: data.IsUntradable === 1,
        categoryId: data.ItemUICategory?.ID || 0,
        categoryName: data.ItemUICategory?.Name || '',
      }
    : null;

  return {
    item,
    isLoading,
    error,
  };
}

// ---- 配方資料 ----
export function useRecipe(itemId: number | null) {
  // 使用 XIVAPI v2 搜尋配方（Cafemaker search API 索引不完整）
  // 查詢語法: +ItemResult=<itemId>
  const xivapiSearchUrl = itemId
    ? `${XIVAPI_V2_BASE}/search?query=${encodeURIComponent(`+ItemResult=${itemId}`)}&sheets=Recipe&fields=ItemResult.Name`
    : null;

  const { data: xivapiSearchData, error: xivapiSearchError } = useSWR(
    xivapiSearchUrl,
    fetcher,
    { revalidateOnFocus: false }
  );

  // 從 XIVAPI v2 結果取得配方 ID
  const xivapiRecipeId = (xivapiSearchData as XivApiV2SearchResponse)?.results?.[0]?.row_id;

  // 備援: 使用 Cafemaker 搜尋
  const cafemakerSearchUrl = itemId && !xivapiRecipeId
    ? `${CAFEMAKER_BASE}/search?indexes=Recipe&filters=ItemResult.ID=${itemId}&columns=ID`
    : null;

  const { data: cafemakerSearchData, error: cafemakerSearchError } = useSWR<CafemakerSearchResponse>(
    cafemakerSearchUrl,
    fetcher,
    { revalidateOnFocus: false }
  );

  const recipeId = xivapiRecipeId || cafemakerSearchData?.Results?.[0]?.ID;

  // 獲取完整配方（從 Cafemaker 取得中文資料）
  const { data: recipeData, error: recipeError, isLoading } = useSWR<CafemakerRecipeResponse>(
    recipeId ? `${CAFEMAKER_BASE}/Recipe/${recipeId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const recipe: Recipe | null = recipeData
    ? parseCafemakerRecipe(recipeData)
    : null;

  return {
    recipe,
    isLoading,
    error: xivapiSearchError || cafemakerSearchError || recipeError,
  };
}

// ---- 搜尋物品（自動判斷中英文）----
export function useItemSearch(query: string, limit: number = 20) {
  const isChinese = containsChinese(query);
  // 繁體轉簡體（Cafemaker 使用簡體中文）
  const searchQuery = isChinese ? toSimplified(query) : query;
  
  // 中文使用 Cafemaker，英文使用 XIVAPI v2
  const searchUrl = query.length >= (isChinese ? 1 : 2)
    ? isChinese
      ? `${CAFEMAKER_BASE}/search?string=${encodeURIComponent(searchQuery)}&indexes=Item&limit=${limit}&columns=ID,Name,Name_en,Icon,LevelItem,ItemUICategory.Name`
      : `${XIVAPI_V2_BASE}/search?query=Name~%22${encodeURIComponent(query)}%22&sheets=Item&fields=Name,Icon,LevelItem,ItemUICategory.Name&limit=${limit}`
    : null;

  const { data, error, isLoading } = useSWR(
    searchUrl,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  let items: Item[] = [];

  if (isChinese && data) {
    // Cafemaker 回應格式
    const cafemakerData = data as CafemakerSearchResponse;
    items = (cafemakerData.Results || []).map((r) => ({
      id: r.ID,
      // 優先使用繁體中文翻譯，否則將簡體轉繁體
      name: getItemNameTwOrFallback(r.ID, simplifiedToTw(r.Name || '')),
      name_en: r.Name_en || r.Name || '',
      name_ja: r.Name || '',
      name_zh: r.Name || '',
      icon: r.Icon || '',
      iconUrl: r.Icon ? getIconUrl(r.Icon) : '',
      itemLevel: r.LevelItem || 1,
      stackSize: 1,
      isUntradable: false,
      categoryId: 0,
      categoryName: r.ItemUICategory?.Name || '',
    }));
  } else if (data) {
    // XIVAPI v2 回應格式
    const xivapiData = data as XivApiV2SearchResponse;
    items = (xivapiData.results || []).map((r) => {
      const fields = r.fields as XivApiV2ItemFields;
      return {
        id: r.row_id,
        name: fields.Name || '',
        name_en: fields.Name || '',
        name_ja: fields.Name || '',
        name_zh: fields.Name || '',
        icon: fields.Icon?.path || '',
        iconUrl: fields.Icon?.path_hr1
          ? `${XIVAPI_V2_BASE}/asset?path=${encodeURIComponent(fields.Icon.path_hr1)}&format=png`
          : fields.Icon?.path
            ? `${XIVAPI_V2_BASE}/asset?path=${encodeURIComponent(fields.Icon.path)}&format=png`
            : '',
        itemLevel: typeof fields.LevelItem === 'object' && fields.LevelItem !== null
          ? (fields.LevelItem as { value: number }).value
          : (fields.LevelItem as number) || 1,
        stackSize: 1,
        isUntradable: false,
        categoryId: fields.ItemUICategory?.row_id || 0,
        categoryName: fields.ItemUICategory?.fields?.Name || '',
      };
    });
  }

  return {
    items,
    isLoading,
    error,
  };
}

// ---- 獨立的 Fetch 函式（供 server-side 使用）----
export async function fetchItem(itemId: number): Promise<Item> {
  const res = await fetch(
    `${CAFEMAKER_BASE}/Item/${itemId}?columns=ID,Name,Name_en,Name_ja,Icon,Description,LevelItem,StackSize,IsUntradable,ItemUICategory.ID,ItemUICategory.Name`
  );
  if (!res.ok) {
    throw new Error(`無法獲取物品 ${itemId}`);
  }
  const data: CafemakerItemResponse = await res.json();

  return {
    id: data.ID,
    // 優先使用繁體中文翻譯，否則將簡體轉繁體
    name: getItemNameTwOrFallback(data.ID, simplifiedToTw(data.Name)),
    name_en: data.Name_en || data.Name,
    name_ja: data.Name_ja || data.Name,
    name_zh: data.Name,
    icon: data.Icon || '',
    iconUrl: data.Icon ? getIconUrl(data.Icon) : '',
    description: data.Description || '',
    itemLevel: data.LevelItem || 1,
    stackSize: data.StackSize || 1,
    isUntradable: data.IsUntradable === 1,
    categoryId: data.ItemUICategory?.ID || 0,
    categoryName: data.ItemUICategory?.Name || '',
  };
}

export async function fetchRecipe(itemId: number): Promise<Recipe | null> {
  // 方法 1: 使用 XIVAPI v2 搜尋配方（更可靠）
  // Cafemaker 的 search API 索引不完整，某些配方搜不到
  // 查詢語法: +ItemResult=<itemId>
  try {
    const xivapiSearchRes = await fetch(
      `${XIVAPI_V2_BASE}/search?query=${encodeURIComponent(`+ItemResult=${itemId}`)}&sheets=Recipe&fields=ItemResult.Name`
    );
    
    if (xivapiSearchRes.ok) {
      const xivapiData = await xivapiSearchRes.json();
      if (xivapiData.results && xivapiData.results.length > 0) {
        const recipeId = xivapiData.results[0].row_id;
        
        // 用找到的配方 ID 從 Cafemaker 獲取完整配方資訊（中文名稱）
        const recipeRes = await fetch(`${CAFEMAKER_BASE}/Recipe/${recipeId}`);
        if (recipeRes.ok) {
          const recipeData: CafemakerRecipeResponse = await recipeRes.json();
          return parseCafemakerRecipe(recipeData);
        }
      }
    }
  } catch (e) {
    console.warn('XIVAPI v2 search failed, falling back to Cafemaker:', e);
  }

  // 方法 2: 備援 - 使用 Cafemaker 搜尋
  const searchRes = await fetch(
    `${CAFEMAKER_BASE}/search?indexes=Recipe&filters=ItemResult.ID=${itemId}&columns=ID`
  );
  if (!searchRes.ok) return null;
  
  const searchData: CafemakerSearchResponse = await searchRes.json();
  const recipeId = searchData.Results?.[0]?.ID;
  
  if (!recipeId) return null;

  // 獲取完整配方
  const recipeRes = await fetch(`${CAFEMAKER_BASE}/Recipe/${recipeId}`);
  if (!recipeRes.ok) return null;

  const recipeData: CafemakerRecipeResponse = await recipeRes.json();
  return parseCafemakerRecipe(recipeData);
}

// ---- 解析 Cafemaker 配方 ----
function parseCafemakerRecipe(data: CafemakerRecipeResponse): Recipe {
  const ingredients: RecipeIngredient[] = [];

  // Cafemaker 使用 ItemIngredient0 到 ItemIngredient9
  for (let i = 0; i <= 9; i++) {
    const itemKey = `ItemIngredient${i}` as keyof CafemakerRecipeResponse;
    const amountKey = `AmountIngredient${i}` as keyof CafemakerRecipeResponse;
    
    const item = data[itemKey] as CafemakerIngredientItem | null;
    const amount = data[amountKey] as number;
    
    if (item && item.ID && amount > 0) {
      // 包含完整的 item 資訊
      const itemName = item.Name ? simplifiedToTw(item.Name) : `物品 #${item.ID}`;
      ingredients.push({
        itemId: item.ID,
        amount,
        isHQ: false,
        item: {
          id: item.ID,
          name: itemName,
          name_en: item.Name_en || item.Name || '',
          name_ja: item.Name || '',
          name_zh: itemName,
          icon: item.Icon || '',
          iconUrl: item.Icon ? getIconUrl(item.Icon) : '',
          itemLevel: item.LevelItem || 1,
          stackSize: 999,
          isUntradable: item.IsUntradable === 1,
          categoryId: 0,
          categoryName: '',
        },
      });
    }
  }

  // RecipeLevelTable 包含基礎值
  const baseDifficulty = data.RecipeLevelTable?.Difficulty || 100;
  const baseDurability = data.RecipeLevelTable?.Durability || 80;
  const baseQuality = data.RecipeLevelTable?.Quality || 1000;

  // 因子用於計算實際配方值 (預設 100 表示無調整)
  const difficultyFactor = data.DifficultyFactor ?? 100;
  const durabilityFactor = data.DurabilityFactor ?? 100;
  const qualityFactor = data.QualityFactor ?? 100;

  // 計算實際配方值 (基礎值 * 因子 / 100，向下取整)
  const actualDifficulty = Math.floor((baseDifficulty * difficultyFactor) / 100);
  const actualDurability = Math.floor((baseDurability * durabilityFactor) / 100);
  const actualQuality = Math.floor((baseQuality * qualityFactor) / 100);

  return {
    id: data.ID,
    itemId: data.ItemResult?.ID || 0,
    craftType: getCraftJobFromId(data.CraftType?.ID || 0),
    craftTypeLevel: data.AmountResult || 1,
    recipeLevel: data.RecipeLevelTable?.ClassJobLevel || 1,
    // 實際配方值（套用因子後）
    difficulty: actualDifficulty,
    durability: actualDurability,
    quality: actualQuality,
    requiredCraftsmanship: data.RequiredCraftsmanship || 0,
    requiredControl: data.RequiredControl || 0,
    ingredients,
    canQuickSynth: data.CanQuickSynth === 1,
    canHQ: data.CanHq === 1,
    stars: data.RecipeLevelTable?.Stars || 0,
    // 材料品質係數（用於初期品質計算）
    materialQualityFactor: data.MaterialQualityFactor || 0,
    // RecipeLevelTable 的基礎值（用於 WASM 求解器）
    baseDifficulty,
    baseDurability,
    baseQuality,
    // RecipeLevelTable ID（用於 WASM 求解器）
    recipeLevelId: data.RecipeLevelTable?.ID || 0,
    // 配方等級參數（用於 WASM 求解器的精確計算）
    progressDivider: data.RecipeLevelTable?.ProgressDivider || 100,
    progressModifier: data.RecipeLevelTable?.ProgressModifier || 100,
    qualityDivider: data.RecipeLevelTable?.QualityDivider || 100,
    qualityModifier: data.RecipeLevelTable?.QualityModifier || 100,
    conditionsFlag: data.RecipeLevelTable?.ConditionsFlag || 15,
  };
}

// Cafemaker 材料物品結構
interface CafemakerIngredientItem {
  ID: number;
  Name?: string;
  Name_en?: string;
  Icon?: string;
  LevelItem?: number;
  IsUntradable?: number;
  CanBeHq?: number;
}

// ---- 工具函式 ----
function getCraftJobFromId(id: number): import('@/types').CraftJob {
  const jobs: import('@/types').CraftJob[] = [
    'CRP', 'BSM', 'ARM', 'GSM', 'LTW', 'WVR', 'ALC', 'CUL'
  ];
  return jobs[id] || 'CRP';
}

// ---- Cafemaker 回應類型 ----
interface CafemakerItemResponse {
  ID: number;
  Name: string;
  Name_en?: string;
  Name_ja?: string;
  Icon?: string;
  Description?: string;
  LevelItem?: number;
  StackSize?: number;
  IsUntradable?: number;
  ItemUICategory?: {
    ID: number;
    Name: string;
  };
}

interface CafemakerSearchResponse {
  Pagination?: {
    Page: number;
    ResultsTotal: number;
  };
  Results: Array<{
    ID: number;
    Name?: string;
    Name_en?: string;
    Icon?: string;
    LevelItem?: number;
    ItemUICategory?: {
      Name: string;
    };
  }>;
}

interface CafemakerRecipeResponse {
  ID: number;
  ItemResult?: { ID: number };
  CraftType?: { ID: number };
  AmountResult?: number;
  RecipeLevelTable?: {
    ID: number;  // RecipeLevelTable 的 ID（用於 WASM）
    ClassJobLevel: number;
    Difficulty: number;
    Durability: number;
    Quality: number;
    Stars: number;
    ProgressDivider: number;
    ProgressModifier: number;
    QualityDivider: number;
    QualityModifier: number;
    ConditionsFlag: number;
    SuggestedCraftsmanship?: number;
    SuggestedControl?: number;
  };
  // 因子欄位 - 用於計算實際配方值
  DifficultyFactor?: number;
  DurabilityFactor?: number;
  QualityFactor?: number;
  MaterialQualityFactor?: number;
  RequiredCraftsmanship?: number;
  RequiredControl?: number;
  CanQuickSynth?: number;
  CanHq?: number;
  ItemIngredient0?: CafemakerIngredientItem | null;
  ItemIngredient1?: CafemakerIngredientItem | null;
  ItemIngredient2?: CafemakerIngredientItem | null;
  ItemIngredient3?: CafemakerIngredientItem | null;
  ItemIngredient4?: CafemakerIngredientItem | null;
  ItemIngredient5?: CafemakerIngredientItem | null;
  ItemIngredient6?: CafemakerIngredientItem | null;
  ItemIngredient7?: CafemakerIngredientItem | null;
  ItemIngredient8?: CafemakerIngredientItem | null;
  ItemIngredient9?: CafemakerIngredientItem | null;
  AmountIngredient0?: number;
  AmountIngredient1?: number;
  AmountIngredient2?: number;
  AmountIngredient3?: number;
  AmountIngredient4?: number;
  AmountIngredient5?: number;
  AmountIngredient6?: number;
  AmountIngredient7?: number;
  AmountIngredient8?: number;
  AmountIngredient9?: number;
}

// ---- XIVAPI v2 回應類型 ----
interface XivApiV2SearchResponse {
  next?: string;
  schema: string;
  version: string;
  results: XivApiV2SearchResult[];
}

interface XivApiV2SearchResult {
  score: number;
  sheet: string;
  row_id: number;
  fields: Record<string, unknown>;
}

// 用於搜尋結果的物品欄位型別
interface XivApiV2ItemFields {
  Name?: string;
  Description?: string;
  Icon?: {
    id: number;
    path: string;
    path_hr1: string;
  };
  LevelItem?: number | { value: number };
  StackSize?: number;
  IsUntradable?: boolean;
  ItemUICategory?: {
    value: number;
    sheet: string;
    row_id: number;
    fields?: {
      Name: string;
    };
  };
}
