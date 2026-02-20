// ============================================
// 市場掃描器頁面 — 從 ff14.html 整合至 Next.js
// ============================================

'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  fetchDataCentersAndWorlds,
  type DataCenter,
  type World,
  loadServerConfig,
  saveServerConfig,
  DEFAULT_SERVER_CONFIG,
} from '@/hooks/use-universalis';
import { getItemNameTw, s2t } from '@/lib/i18n/tw-translation';

// ============================================
// 常數 & 類型
// ============================================

const UNI_BASE = 'https://universalis.app/api/v2';
const CAFE_BASE = 'https://cafemaker.wakingsands.com';

interface CategoryGroup {
  label: string;
  ids: number[];
  defaultOn?: boolean;
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  { label: '藥品食品', ids: [44, 45, 46, 47], defaultOn: true },
  { label: '素材', ids: [48, 49, 50, 51, 52, 53, 54, 55, 56, 59, 60, 83], defaultOn: true },
  { label: '武器', ids: [1,2,3,4,5,6,7,8,9,10,11,84,87,88,89,96,97,98,105,106,107,108,109,110,111] },
  { label: '防具', ids: [34,35,36,37,38] },
  { label: '飾品', ids: [40,41,42,43] },
  { label: '製作工具', ids: [12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27] },
  { label: '採集工具', ids: [28,29,30,31,32,33,99] },
  { label: '家具', ids: [57,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80] },
  { label: '魔晶石', ids: [58] },
  { label: '其他', ids: [61,63,81,82,85,86,94,95,100,112,90,91,92,93,101,102,103,104] },
];

interface CategoryMeta {
  id: number;
  nameCn: string;
  nameEn: string;
  nameTw: string;
}

interface ScanResult {
  id: number;
  nameTw: string;
  nameEn: string;
  ilvl: number;
  canHq: boolean;
  avgPrice: number;
  minListingPrice: number;
  boardAvgPrice: number;
  velocity: number;
  sellersCount: number;
  score: number;
  totalSoldQty: number;
  uniqueBuyers: number;
  medianPrice: number;
  totalListings: number;
  absorptionRate: number;
  competitionFactor: number;
  marketValue: number;
  sellThroughDays: number;
  marketStatus: '缺貨' | '熱銷' | '普通' | '滞銷';
  listings: ListingInfo[];
  recentHistory: HistoryInfo[];
}

interface ListingInfo {
  pricePerUnit: number;
  quantity: number;
  total: number;
  retainerName: string;
  worldName: string;
  hq: boolean;
}

interface HistoryInfo {
  pricePerUnit: number;
  quantity: number;
  total: number;
  buyerName: string;
  timestamp: number;
}

type ViewMode = 'profitable' | 'bestselling' | 'all';
type SortKey = 'score' | 'avgPrice' | 'velocity' | 'sellersCount' | 'minListingPrice' | 'boardAvgPrice' | 'totalSoldQty' | 'absorptionRate' | 'marketValue' | 'totalListings' | 'sellThroughDays' | 'medianPrice';

// ============================================
// 工具函式
// ============================================

async function fetchJSON<T = unknown>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url.substring(0, 80)}`);
  return r.json();
}

function fmtGil(n: number): string {
  if (!n || n === 0) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 10000) return Math.round(n / 1000).toLocaleString() + 'K';
  return n.toLocaleString();
}

function fmtCompact(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function median(arr: number[]): number {
  if (!arr || arr.length === 0) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function timeAgo(ts: number): string {
  if (!ts) return '';
  let tms = Number(ts);
  if (tms > 0 && tms < 1e11) tms *= 1000;
  const mins = Math.round((Date.now() - tms) / 60000);
  if (mins < 0) return '';
  if (mins < 60) return `${mins} 分鐘前`;
  if (mins < 1440) return `${Math.round(mins / 60)} 小時前`;
  return `${Math.round(mins / 1440)} 天前`;
}

// ============================================
// 主元件
// ============================================

export default function MarketScannerPage() {
  // ---- DC/Server 狀態 ----
  const [dataCenters, setDataCenters] = useState<DataCenter[]>([]);
  const [worldsMap, setWorldsMap] = useState<Record<number, string>>({});
  const [selectedDC, setSelectedDC] = useState('');
  const [selectedWorld, setSelectedWorld] = useState('');
  const [dcLoaded, setDcLoaded] = useState(false);

  // ---- 掃描設定 ----
  const [maxIlvl, setMaxIlvl] = useState(999);
  const [regionScope, setRegionScope] = useState<'world' | 'dc'>('world');
  const [itemIdInput, setItemIdInput] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set());
  const [categoryMeta, setCategoryMeta] = useState<Record<number, CategoryMeta>>({});
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);

  // ---- 掃描狀態 ----
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // ---- 結果 ----
  const [results, setResults] = useState<ScanResult[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('profitable');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortAsc, setSortAsc] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [enableAdvFilter, setEnableAdvFilter] = useState(false);
  const [fMinPrice, setFMinPrice] = useState(500);
  const [fMinVelocity, setFMinVelocity] = useState(10);
  const [fMaxSellers, setFMaxSellers] = useState(30);
  const [fMinAbsorption, setFMinAbsorption] = useState(0.2);

  // ---- 展開詳細 ----
  const [expandedDetails, setExpandedDetails] = useState<Set<number>>(new Set());
  const [detailCounts, setDetailCounts] = useState<Record<number, number>>({});

  const abortRef = useRef(false);

  // ---- 資料中心對應的伺服器列表 ----
  const currentDcWorlds = useMemo(() => {
    const dc = dataCenters.find(d => d.name === selectedDC);
    if (!dc) return [];
    return dc.worlds
      .map(id => ({ id, name: worldsMap[id] || `World#${id}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dataCenters, selectedDC, worldsMap]);

  // ---- 初始化：載入 DC/World 列表 ----
  useEffect(() => {
    (async () => {
      try {
        const { dataCenters: dcs, worlds } = await fetchDataCentersAndWorlds();
        const wm: Record<number, string> = {};
        for (const w of worlds) wm[w.id] = w.name;
        setDataCenters(dcs);
        setWorldsMap(wm);

        // 從共用伺服器設定恢復 DC/World
        const serverConfig = loadServerConfig();
        let savedDc = serverConfig.dcName;
        let savedWorld = serverConfig.worldName;

        // 從掃描器專用設定恢復其他設定
        try {
          const raw = localStorage.getItem('ff14_scanner_settings');
          if (raw) {
            const s = JSON.parse(raw);
            if (s.maxIlvl) setMaxIlvl(Number(s.maxIlvl));
            if (s.regionScope) setRegionScope(s.regionScope);
            if (s.itemIds) setItemIdInput(s.itemIds);
          }
        } catch {}

        // 使用共用設定的 DC，若無則預設陸行鳥區
        const defaultDc = savedDc || dcs.find(d => d.region === '繁中服')?.name || dcs[0]?.name || '';
        setSelectedDC(defaultDc);

        // 載入分類
        await loadCategoryMeta();

        // 恢復分類選擇（從掃描器專用設定）
        try {
          const raw = localStorage.getItem('ff14_scanner_settings');
          if (raw) {
            const s = JSON.parse(raw);
            if (s.categories && Array.isArray(s.categories)) {
              setSelectedCategories(new Set(s.categories.map(Number)));
            } else {
              // 預設分類
              const defaults = new Set<number>();
              CATEGORY_GROUPS.filter(g => g.defaultOn).forEach(g => g.ids.forEach(id => defaults.add(id)));
              setSelectedCategories(defaults);
            }
          } else {
            const defaults = new Set<number>();
            CATEGORY_GROUPS.filter(g => g.defaultOn).forEach(g => g.ids.forEach(id => defaults.add(id)));
            setSelectedCategories(defaults);
          }
        } catch {
          const defaults = new Set<number>();
          CATEGORY_GROUPS.filter(g => g.defaultOn).forEach(g => g.ids.forEach(id => defaults.add(id)));
          setSelectedCategories(defaults);
        }

        // 需要等 dcWorlds 計算後才設定 world
        if (savedWorld) {
          // 延遲設定，等 state 更新
          setTimeout(() => setSelectedWorld(savedWorld), 100);
        }

        setDcLoaded(true);
      } catch (e) {
        setErrorMsg('無法載入資料中心列表，請重新整理頁面。');
        console.error(e);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 當 DC 變更時設定預設伺服器
  useEffect(() => {
    if (!dcLoaded || currentDcWorlds.length === 0) return;
    // 若目前選取的 world 不在列表中，選第一個
    if (!currentDcWorlds.some(w => w.name === selectedWorld)) {
      setSelectedWorld(currentDcWorlds[0]?.name || '');
    }
  }, [currentDcWorlds, dcLoaded, selectedWorld]);

  // ---- 儲存設定到 localStorage ----
  // DC/World 寫入共用伺服器設定；掃描器專用設定另存
  useEffect(() => {
    if (!dcLoaded) return;
    // 同步 DC/World 至共用伺服器設定
    const world = currentDcWorlds.find(w => w.name === selectedWorld);
    if (selectedDC && selectedWorld && world) {
      saveServerConfig({ dcName: selectedDC, worldId: world.id, worldName: selectedWorld });
    }
    // 掃描器專用設定（不含 DC/World）
    try {
      localStorage.setItem('ff14_scanner_settings', JSON.stringify({
        maxIlvl: String(maxIlvl),
        regionScope,
        itemIds: itemIdInput,
        categories: [...selectedCategories],
      }));
    } catch {}
  }, [selectedDC, selectedWorld, maxIlvl, regionScope, itemIdInput, selectedCategories, dcLoaded, currentDcWorlds]);

  // ---- 載入分類 Metadata ----
  async function loadCategoryMeta() {
    const meta: Record<number, CategoryMeta> = {};
    try {
      const url = `${CAFE_BASE}/ItemUICategory?limit=200&columns=ID,Name,Name_chs,Name_en`;
      const data: { Results?: Array<{ ID: number; Name?: string; Name_chs?: string; Name_en?: string }> } = await fetchJSON(url);
      for (const r of data.Results || []) {
        if (r.ID && r.ID > 0) {
          const nameCn = r.Name_chs || r.Name || '';
          const nameEn = r.Name_en || '';
          if (!nameCn && !nameEn) continue;
          meta[r.ID] = { id: r.ID, nameCn, nameEn, nameTw: s2t(nameCn) };
        }
      }
    } catch (e) {
      console.warn('Failed to load categories from API', e);
      // Fallback
      const fallback: Record<number, string> = {
        44:'藥品',45:'食材',46:'食品',47:'水產品',48:'石材',49:'金屬',50:'木材',
        51:'布料',52:'皮革',53:'骨材',54:'煉金原料',55:'染料',56:'部件',57:'家具',
        58:'魔晶石',59:'水晶',60:'觸媒',61:'雜貨',
      };
      for (const [id, name] of Object.entries(fallback)) {
        meta[Number(id)] = { id: Number(id), nameCn: name, nameEn: '', nameTw: name };
      }
    }
    setCategoryMeta(meta);
  }

  // ---- 分類選擇函式 ----
  const toggleCategory = useCallback((catId: number) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }, []);

  const selectGroupAll = useCallback((groupIds: number[], checked: boolean) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      for (const id of groupIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const getGroupState = useCallback((groupIds: number[]): 'all' | 'partial' | 'none' => {
    const validIds = groupIds.filter(id => categoryMeta[id]);
    if (validIds.length === 0) return 'none';
    const checkedCount = validIds.filter(id => selectedCategories.has(id)).length;
    if (checkedCount === validIds.length) return 'all';
    if (checkedCount > 0) return 'partial';
    return 'none';
  }, [categoryMeta, selectedCategories]);

  // ---- DC 分組顯示 ----
  const groupedDCs = useMemo(() => {
    const regionOrder = ['繁中服', 'Japan', 'North-America', 'Europe', 'Oceania', '中国', '한국'];
    const regionLabel: Record<string, string> = {
      '繁中服': '繁體中文服',
      'Japan': '日本',
      'North-America': '北美',
      'Europe': '歐洲',
      'Oceania': '大洋洲',
      '中国': '中國',
      '한국': '韓國',
    };
    const groups: { label: string; dcs: DataCenter[] }[] = [];
    const addedRegions = new Set<string>();
    const sorted = [...dataCenters].sort((a, b) => {
      const ai = regionOrder.indexOf(a.region);
      const bi = regionOrder.indexOf(b.region);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    for (const dc of sorted) {
      if (!addedRegions.has(dc.region)) {
        addedRegions.add(dc.region);
        groups.push({
          label: regionLabel[dc.region] || dc.region,
          dcs: sorted.filter(d => d.region === dc.region),
        });
      }
    }
    return groups;
  }, [dataCenters]);

  // ---- 過濾 & 排序結果 ----
  const filteredResults = useMemo(() => {
    const term = searchFilter.toLowerCase();
    let filtered = results.filter(r => {
      if (term) {
        const match = r.nameTw.toLowerCase().includes(term) || r.nameEn.toLowerCase().includes(term);
        if (!match) return false;
      }
      if (enableAdvFilter) {
        if (r.medianPrice < fMinPrice) return false;
        if (r.velocity < fMinVelocity) return false;
        if (r.sellersCount > fMaxSellers) return false;
        if (r.absorptionRate < fMinAbsorption) return false;
      }
      if (viewMode === 'bestselling' && r.velocity <= 0) return false;
      if (viewMode === 'profitable' && r.score <= 0) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      return sortAsc ? (va - vb) : (vb - va);
    });

    return filtered;
  }, [results, searchFilter, enableAdvFilter, fMinPrice, fMinVelocity, fMaxSellers, fMinAbsorption, viewMode, sortKey, sortAsc]);

  const maxScore = useMemo(() => Math.max(...filteredResults.map(r => r.score), 1), [filteredResults]);
  const displayResults = useMemo(() => filteredResults.slice(0, 200), [filteredResults]);

  // ---- 統計 ----
  const stats = useMemo(() => {
    if (results.length === 0) return null;
    const topScore = results.reduce((a, b) => b.score > a.score ? b : a, results[0]);
    const topVel = results.reduce((a, b) => b.velocity > a.velocity ? b : a, results[0]);
    return {
      total: results.length,
      shown: filteredResults.length,
      topScoreName: (topScore.nameTw || topScore.nameEn).substring(0, 8),
      topVelName: (topVel.nameTw || topVel.nameEn).substring(0, 8),
    };
  }, [results, filteredResults]);

  // ---- 掃描邏輯 ----
  const startScan = useCallback(async () => {
    setErrorMsg('');
    if (!selectedDC) { setErrorMsg('請先選擇資料中心'); return; }
    if (!selectedWorld) { setErrorMsg('請選擇伺服器'); return; }

    const directItemIds = itemIdInput.split(/[,，\s]+/).map(s => parseInt(s.trim())).filter(n => n > 0 && !isNaN(n));
    if (selectedCategories.size === 0 && directItemIds.length === 0) {
      setErrorMsg('請至少選擇一個掃描分類，或輸入物品 ID');
      return;
    }

    const queryTarget = regionScope === 'dc' ? selectedDC : selectedWorld;

    setIsScanning(true);
    setProgress(0);
    setStatusMsg('初始化中...');
    setResults([]);
    setExpandedDetails(new Set());
    abortRef.current = false;

    try {
      setStatusMsg('載入可交易物品清單...');
      setProgress(2);
      const marketable: number[] = await fetchJSON(`${UNI_BASE}/marketable`);
      const marketableSet = new Set(marketable);
      setProgress(10);
      setStatusMsg(`已載入 ${marketable.length.toLocaleString()} 個可交易物品`);

      // 從 Cafemaker 取得分類物品（並行化，同時跑 3 個分類以提升效能）
      interface ItemInfo { id: number; nameCn: string; nameEn: string; ilvl: number; catId: number; canHq: boolean }
      let allItems: ItemInfo[] = [];
      const catList = [...selectedCategories];

      if (catList.length > 0) {
        const CONCURRENCY = 3; // 同時抓取的分類數
        let completedCats = 0;

        // 單一分類的抓取邏輯
        async function fetchCategory(catId: number): Promise<ItemInfo[]> {
          const items: ItemInfo[] = [];
          try {
            let page = 1;
            while (page <= 20) {
              if (abortRef.current) break;
              const url = `${CAFE_BASE}/search?indexes=Item&filters=ItemUICategory.ID=${catId},LevelItem<=${maxIlvl}&columns=ID,Name,Name_chs,Name_en,LevelItem,CanBeHq&limit=250&page=${page}`;
              const data: { Results?: Array<{ ID: number; Name?: string; Name_chs?: string; Name_en?: string; LevelItem?: number; CanBeHq?: boolean }>; Pagination?: { PageTotal?: number } } = await fetchJSON(url);
              const pageResults = data.Results || [];
              if (pageResults.length === 0) break;

              for (const r of pageResults) {
                if (r.ID && marketableSet.has(r.ID)) {
                  items.push({
                    id: r.ID,
                    nameCn: r.Name_chs || r.Name || '',
                    nameEn: r.Name_en || r.Name || '',
                    ilvl: r.LevelItem ?? 0,
                    catId,
                    canHq: !!r.CanBeHq,
                  });
                }
              }
              if (page >= (data.Pagination?.PageTotal || 1)) break;
              page++;
              await new Promise(r => setTimeout(r, 80));
            }
          } catch (e) {
            console.warn(`分類 ${catId} 載入失敗:`, e);
          }
          completedCats++;
          setProgress(10 + Math.round((completedCats / catList.length) * 30));
          setStatusMsg(`已完成 ${completedCats}/${catList.length} 個分類...`);
          return items;
        }

        // 控制並行數的 worker pool
        const categoryResults: ItemInfo[][] = [];
        let catIdx = 0;
        async function catWorker() {
          while (catIdx < catList.length && !abortRef.current) {
            const idx = catIdx++;
            categoryResults[idx] = await fetchCategory(catList[idx]);
          }
        }
        await Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, catList.length) }, () => catWorker())
        );
        allItems = categoryResults.flat();
      }

      // 直接指定的物品 ID
      if (directItemIds.length > 0) {
        setStatusMsg(`取得 ${directItemIds.length} 個指定物品資料...`);
        setProgress(35);
        for (const itemId of directItemIds) {
          if (!marketableSet.has(itemId)) continue;
          try {
            const data: { ID?: number; Name?: string; Name_chs?: string; Name_en?: string; LevelItem?: number; CanBeHq?: boolean } = await fetchJSON(`${CAFE_BASE}/item/${itemId}?columns=ID,Name,Name_chs,Name_en,LevelItem,CanBeHq`);
            if (data?.ID) {
              allItems.push({
                id: data.ID,
                nameCn: data.Name_chs || data.Name || '',
                nameEn: data.Name_en || data.Name || '',
                ilvl: data.LevelItem ?? 0,
                catId: 0,
                canHq: !!data.CanBeHq,
              });
            }
          } catch (e) {
            console.warn(`物品 ${itemId} 載入失敗:`, e);
          }
        }
      }

      // 去重
      const seen = new Set<number>();
      allItems = allItems.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

      setProgress(42);
      setStatusMsg(`共 ${allItems.length} 個可交易物品，正在查詢市場價格...`);

      if (allItems.length === 0) throw new Error('未找到任何可交易物品。請確認分類選擇與物品等級設定。');

      // 批次查 Universalis
      const BATCH = 100;
      const batches: ItemInfo[][] = [];
      for (let i = 0; i < allItems.length; i += BATCH) batches.push(allItems.slice(i, i + BATCH));

      const scanResults: ScanResult[] = [];
      let processed = 0;

      for (const batch of batches) {
        if (abortRef.current) break;
        const ids = batch.map(b => b.id).join(',');

        try {
          // 同時發起 main 和 aggregated 查詢（並行化）
          const mainUrl = `${UNI_BASE}/${queryTarget}/${ids}?listings=30&entries=30`;
          const aggUrl = `${UNI_BASE}/aggregated/${queryTarget}/${ids}`;
          const [mainData, aggResult] = await Promise.all([
            fetchJSON<Record<string, unknown>>(mainUrl),
            fetchJSON<{ results?: Array<Record<string, unknown>> }>(aggUrl).catch(() => ({ results: [] })),
          ]);

          // aggregated data
          const aggMap: Record<number, Record<string, unknown>> = {};
          for (const res of (aggResult.results || [])) {
            aggMap[(res.itemId as number)] = res;
          }

          // parse main data
          type MarketItem = Record<string, unknown>;
          let marketMap: Record<number, MarketItem> = {};
          if (batch.length > 1 && (mainData as { items?: Record<string, MarketItem> }).items) {
            for (const [k, v] of Object.entries((mainData as { items: Record<string, MarketItem> }).items)) {
              marketMap[(v.itemID as number) ?? parseInt(k)] = v;
            }
          } else if ((mainData as { itemID?: number }).itemID) {
            marketMap[(mainData as { itemID: number }).itemID] = mainData as MarketItem;
          }

          for (const meta of batch) {
            const m = marketMap[meta.id];
            const agg = aggMap[meta.id];
            if (!m && !agg) continue;

            const rawListings = (m && Array.isArray((m as { listings?: unknown[] }).listings))
              ? (m as { listings: Record<string, unknown>[] }).listings : [];
            const sellersCount = new Set(rawListings.map(l => (l.retainerName as string) || (l.sellerID as string) || '')).size;
            const totalListings = (m as { listingsCount?: number })?.listingsCount || rawListings.length;

            // Velocity
            const scopeKey = regionScope === 'dc' ? 'dc' : 'world';
            let velocity = 0;
            if (agg) {
              const nq = (agg.nq || {}) as Record<string, unknown>;
              const hq = (agg.hq || {}) as Record<string, unknown>;
              const nqDsv = (nq.dailySaleVelocity || {}) as Record<string, Record<string, number>>;
              const hqDsv = (hq.dailySaleVelocity || {}) as Record<string, Record<string, number>>;
              velocity = (nqDsv[scopeKey]?.quantity || 0) + (hqDsv[scopeKey]?.quantity || 0);
            }
            if (velocity === 0 && m) {
              velocity = (m as { regularSaleVelocity?: number }).regularSaleVelocity || 0;
            }

            // Price
            let avgPrice = 0;
            if (agg) {
              const nq = (agg.nq || {}) as Record<string, unknown>;
              const asp = (nq.averageSalePrice || {}) as Record<string, Record<string, number>>;
              const price = asp[scopeKey]?.price || 0;
              if (price > 0) avgPrice = Math.round(price);
            }
            if (avgPrice === 0 && m) {
              const recentHistory = ((m as { recentHistory?: Record<string, unknown>[] }).recentHistory || []);
              const prices = recentHistory.map(h => (h.pricePerUnit as number)).filter(p => p > 0);
              const med = median(prices);
              if (med > 0) avgPrice = med;
              else if ((m as { averagePrice?: number }).averagePrice) avgPrice = Math.round((m as { averagePrice: number }).averagePrice);
              else if ((m as { minPrice?: number }).minPrice) avgPrice = (m as { minPrice: number }).minPrice;
            }

            // Listings
            const listingPrices = rawListings.map(l => (l.pricePerUnit as number)).filter(p => p > 0);
            const minListingPrice = listingPrices.length > 0
              ? Math.min(...listingPrices)
              : ((m as { minPrice?: number })?.minPrice || 0);
            const boardAvgPrice = listingPrices.length > 0
              ? Math.round(listingPrices.reduce((a, b) => a + b, 0) / listingPrices.length)
              : avgPrice;

            const recentHistory = ((m as { recentHistory?: Record<string, unknown>[] })?.recentHistory || []);
            const totalSoldQty = recentHistory.reduce((sum, h) => sum + ((h.quantity as number) || 1), 0);
            const uniqueBuyers = new Set(recentHistory.map(h => (h.buyerName as string) || '')).size;

            // 中位價（從成交紀錄計算，fallback 均價）
            const historyPrices = recentHistory.map(h => (h.pricePerUnit as number)).filter(p => p > 0);
            const medianPrice = historyPrices.length > 0 ? median(historyPrices) : avgPrice;

            // 新評分模型指標
            const absorptionRate = velocity / (totalListings + 1);
            const competitionFactor = 1 / Math.log(sellersCount + 2);
            const marketValue = Math.round(velocity * medianPrice);
            const sellThroughDays = totalListings / (velocity + 1);
            const marketStatus: '缺貨' | '熱銷' | '普通' | '滞銷' =
              absorptionRate > 1 ? '缺貨' : absorptionRate >= 0.3 ? '熱銷' : absorptionRate >= 0.1 ? '普通' : '滞銷';

            // 綜合評分 = 中位價 × 日銷量 × 吸收率 × 競爭修正
            const score = Math.round(medianPrice * velocity * absorptionRate * competitionFactor);

            // 嘗試繁中翻譯
            const twName = getItemNameTw(meta.id);
            const displayName = twName || s2t(meta.nameCn) || meta.nameEn;

            scanResults.push({
              id: meta.id,
              nameTw: displayName,
              nameEn: meta.nameEn,
              ilvl: meta.ilvl,
              canHq: meta.canHq,
              avgPrice,
              minListingPrice,
              boardAvgPrice,
              velocity,
              sellersCount,
              score,
              totalSoldQty,
              uniqueBuyers,
              medianPrice,
              totalListings,
              absorptionRate,
              competitionFactor,
              marketValue,
              sellThroughDays,
              marketStatus,
              listings: rawListings
                .map(l => ({
                  pricePerUnit: (l.pricePerUnit as number) || 0,
                  quantity: (l.quantity as number) || 1,
                  total: (l.total as number) || 0,
                  retainerName: (l.retainerName as string) || '',
                  worldName: (l.worldName as string) || '',
                  hq: (l.hq as boolean) || false,
                }))
                .sort((a, b) => a.pricePerUnit - b.pricePerUnit),
              recentHistory: recentHistory.map(h => ({
                pricePerUnit: (h.pricePerUnit as number) || 0,
                quantity: (h.quantity as number) || 1,
                total: (h.total as number) || 0,
                buyerName: (h.buyerName as string) || '',
                timestamp: (h.timestamp as number) || 0,
              })),
            });
          }
        } catch (e) {
          console.warn('批次查詢失敗:', e);
        }

        processed += batch.length;
        setProgress(42 + Math.round((processed / allItems.length) * 55));
        setStatusMsg(`查詢市場價格中... ${processed}/${allItems.length}`);
        await new Promise(r => setTimeout(r, 200));
      }

      setProgress(100);
      setStatusMsg(`掃描完成！共 ${scanResults.length} 筆有市場資料的物品`);
      setResults(scanResults);
    } catch (e) {
      setErrorMsg((e as Error).message);
    } finally {
      setIsScanning(false);
    }
  }, [selectedDC, selectedWorld, regionScope, selectedCategories, itemIdInput, maxIlvl, categoryMeta]);

  // ---- 排序切換 ----
  const handleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortAsc(a => !a);
        return key;
      }
      setSortAsc(key === 'sellersCount' || key === 'totalListings' || key === 'sellThroughDays');
      return key;
    });
  }, []);

  // ---- 切換檢視模式 ----
  const handleViewChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'bestselling') {
      setSortKey('velocity');
      setSortAsc(false);
    } else if (mode === 'profitable') {
      setSortKey('score');
      setSortAsc(false);
    }
  }, []);

  // ---- 渲染 ----
  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      {/* 頁面標題 */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">📊</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            市場掃描器
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Market Profitability Scanner · 綜合分數 = 中位價 × 日銷量 × 吸收率 × 競爭修正
          </p>
        </div>
      </div>

      {/* 提示 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
        💡 選擇資料中心後，會自動載入該中心所有伺服器。掃描分類可多選，也可直接輸入物品 ID。掃描約需 1～3 分鐘。
        資料來源：Cafemaker（物品名）+ Universalis（市場行情）。
      </div>

      {/* 設定面板 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 資料中心 */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">資料中心</label>
            <select
              value={selectedDC}
              onChange={e => setSelectedDC(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
            >
              <option value="">── 請選擇 ──</option>
              {groupedDCs.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.dcs.map(dc => (
                    <option key={dc.name} value={dc.name}>{dc.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* 伺服器 */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">伺服器</label>
            <select
              value={selectedWorld}
              onChange={e => setSelectedWorld(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
            >
              {currentDcWorlds.length === 0 && <option value="">請先選擇資料中心</option>}
              {currentDcWorlds.map(w => (
                <option key={w.id} value={w.name}>{w.name} (ID: {w.id})</option>
              ))}
            </select>
          </div>

          {/* 物品等級 */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">最高物品等級</label>
            <input
              type="number" min={1} max={999} value={maxIlvl}
              onChange={e => setMaxIlvl(Math.max(1, parseInt(e.target.value) || 999))}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
            />
          </div>

          {/* 查詢範圍 */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">查詢範圍</label>
            <select
              value={regionScope}
              onChange={e => setRegionScope(e.target.value as 'world' | 'dc')}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
            >
              <option value="world">本伺服器</option>
              <option value="dc">整個資料中心</option>
            </select>
          </div>
        </div>

        {/* 物品 ID */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">物品 ID（可選，逗號分隔）</label>
          <input
            type="text" value={itemIdInput} placeholder="例：5111,5112"
            onChange={e => setItemIdInput(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
          />
        </div>

        {/* 分類選擇 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              掃描分類 ({selectedCategories.size})
            </label>
            <div className="flex gap-2">
              <button onClick={() => {
                const all = new Set<number>();
                CATEGORY_GROUPS.forEach(g => g.ids.filter(id => categoryMeta[id]).forEach(id => all.add(id)));
                setSelectedCategories(all);
              }} className="text-xs text-blue-500 hover:underline">全選</button>
              <button onClick={() => setSelectedCategories(new Set())} className="text-xs text-blue-500 hover:underline">全不選</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_GROUPS.map((group, gi) => {
              const validIds = group.ids.filter(id => categoryMeta[id]);
              if (validIds.length === 0) return null;
              const state = getGroupState(validIds);
              return (
                <div key={gi} className="relative">
                  <button
                    onClick={() => setExpandedGroup(prev => prev === gi ? null : gi)}
                    className={`
                      inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-full border transition-colors
                      ${state === 'all'
                        ? 'bg-blue-100 border-blue-400 text-blue-700 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-400'
                        : state === 'partial'
                        ? 'bg-yellow-50 border-yellow-400 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-600 dark:text-yellow-400 border-dashed'
                        : 'bg-gray-50 border-gray-300 text-gray-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400'
                      }
                    `}
                  >
                    {group.label}
                    <span className="opacity-60">{validIds.length}</span>
                    <span className="text-[10px] opacity-50">▾</span>
                  </button>
                  {expandedGroup === gi && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 min-w-[200px] max-h-[240px] overflow-y-auto"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex gap-3 px-3 py-1 border-b border-gray-100 dark:border-gray-700">
                        <button onClick={() => selectGroupAll(validIds, true)} className="text-[10px] text-blue-500 hover:underline">全選</button>
                        <button onClick={() => selectGroupAll(validIds, false)} className="text-[10px] text-blue-500 hover:underline">全不選</button>
                      </div>
                      {validIds.map(id => {
                        const meta = categoryMeta[id];
                        if (!meta) return null;
                        return (
                          <label key={id} className="flex items-center gap-2 px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedCategories.has(id)}
                              onChange={() => toggleCategory(id)}
                              className="accent-blue-500"
                            />
                            {meta.nameTw || meta.nameCn}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="flex gap-3">
          <button
            disabled={isScanning}
            onClick={startScan}
            className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isScanning ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                掃描中...
              </span>
            ) : '⚔ 開始掃描'}
          </button>
          <button
            onClick={() => { setResults([]); setErrorMsg(''); abortRef.current = true; }}
            className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            ✕ 清除結果
          </button>
        </div>
      </div>

      {/* 閉合下拉選單 */}
      {expandedGroup !== null && (
        <div className="fixed inset-0 z-40" onClick={() => setExpandedGroup(null)} />
      )}

      {/* 錯誤訊息 */}
      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          ❌ {errorMsg}
        </div>
      )}

      {/* 進度條 */}
      {isScanning && (
        <div className="space-y-1">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{statusMsg}</p>
        </div>
      )}

      {/* 統計欄 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="掃描物品數" value={stats.total.toLocaleString()} />
          <StatCard label="顯示筆數" value={stats.shown.toLocaleString()} />
          <StatCard label="最佳投資品" value={stats.topScoreName} />
          <StatCard label="最熱賣品" value={stats.topVelName} />
          <StatCard label="查詢對象" value={`${selectedWorld} (${selectedDC})`} />
        </div>
      )}

      {/* 結果區域 */}
      {results.length > 0 && (
        <div className="space-y-3">
          {/* 檢視模式 Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {[
              { key: 'profitable' as ViewMode, label: '💰 最值得販賣' },
              { key: 'bestselling' as ViewMode, label: '🔥 最熱賣產品' },
              { key: 'all' as ViewMode, label: '📋 全部物品' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => handleViewChange(tab.key)}
                className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px
                  ${viewMode === tab.key
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 篩選列 */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text" value={searchFilter} placeholder="搜尋物品名稱..."
              onChange={e => setSearchFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border rounded-lg w-60 focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
            />
            <div className="flex gap-1">
              {[
                { key: 'score' as SortKey, label: '📊 分數' },
                { key: 'absorptionRate' as SortKey, label: '📈 吸收率' },
                { key: 'velocity' as SortKey, label: '🔥 銷量' },
                { key: 'marketValue' as SortKey, label: '💰 市場規模' },
                { key: 'sellersCount' as SortKey, label: '👥 賣家數' },
              ].map(chip => (
                <button
                  key={chip.key}
                  onClick={() => handleSort(chip.key)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors
                    ${sortKey === chip.key
                      ? 'bg-blue-100 border-blue-400 text-blue-700 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-400'
                      : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400'
                    }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setEnableAdvFilter(f => !f)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                enableAdvFilter
                  ? 'bg-green-50 border-green-400 text-green-700 dark:bg-green-900/20 dark:border-green-600 dark:text-green-400'
                  : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-600'
              }`}
            >
              🔧 進階篩選
            </button>
          </div>

          {/* 進階篩選參數 */}
          {enableAdvFilter && (
            <div className="flex flex-wrap gap-4 items-center text-sm text-gray-600 dark:text-gray-400">
              <label className="flex items-center gap-2">
                最低中位價
                <input type="number" value={fMinPrice} min={0} step={100} onChange={e => setFMinPrice(parseInt(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-600" />
              </label>
              <label className="flex items-center gap-2">
                最低日銷量
                <input type="number" value={fMinVelocity} min={0} step={0.5} onChange={e => setFMinVelocity(parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-600" />
              </label>
              <label className="flex items-center gap-2">
                最低吸收率
                <input type="number" value={fMinAbsorption} min={0} max={10} step={0.05} onChange={e => setFMinAbsorption(parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-600" />
              </label>
              <label className="flex items-center gap-2">
                最多賣家數
                <input type="number" value={fMaxSellers} min={1} onChange={e => setFMaxSellers(parseInt(e.target.value) || 30)}
                  className="w-20 px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-600" />
              </label>
            </div>
          )}

          {/* 資料表格 */}
          {displayResults.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">🔍</div>
              <div>沒有符合條件的物品，請放寬篩選條件或切換分頁</div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">#</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">物品名稱</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-blue-500"
                        onClick={() => handleSort('minListingPrice')}>
                        最低掛價 {sortKey === 'minListingPrice' ? (sortAsc ? '▲' : '▼') : '⇅'}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-blue-500"
                        onClick={() => handleSort('medianPrice')}>
                        中位價 {sortKey === 'medianPrice' ? (sortAsc ? '▲' : '▼') : '⇅'}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-blue-500"
                        onClick={() => handleSort('velocity')}>
                        日銷量 {sortKey === 'velocity' ? (sortAsc ? '▲' : '▼') : '⇅'}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-blue-500"
                        onClick={() => handleSort('totalListings')}>
                        掛單數 {sortKey === 'totalListings' ? (sortAsc ? '▲' : '▼') : '⇅'}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-blue-500"
                        onClick={() => handleSort('absorptionRate')}>
                        吸收率 {sortKey === 'absorptionRate' ? (sortAsc ? '▲' : '▼') : '⇅'}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-blue-500"
                        onClick={() => handleSort('sellThroughDays')}>
                        售完天數 {sortKey === 'sellThroughDays' ? (sortAsc ? '▲' : '▼') : '⇅'}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-blue-500"
                        onClick={() => handleSort('sellersCount')}>
                        賣家數 {sortKey === 'sellersCount' ? (sortAsc ? '▲' : '▼') : '⇅'}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-blue-500"
                        onClick={() => handleSort('score')}>
                        綜合分數 {sortKey === 'score' ? (sortAsc ? '▲' : '▼') : '⇅'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {displayResults.map((r, i) => (
                      <ResultRow
                        key={r.id}
                        index={i}
                        result={r}
                        maxScore={maxScore}
                        isExpanded={expandedDetails.has(r.id)}
                        detailCount={detailCounts[r.id] || 10}
                        onToggleExpand={() => {
                          setExpandedDetails(prev => {
                            const next = new Set(prev);
                            if (next.has(r.id)) next.delete(r.id);
                            else next.add(r.id);
                            return next;
                          });
                        }}
                        onDetailCountChange={(count) => {
                          setDetailCounts(prev => ({ ...prev, [r.id]: count }));
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400">
                顯示 {displayResults.length}{filteredResults.length > 200 ? ` / ${filteredResults.length}` : ''} 筆結果
                · 綜合分數 = 中位價 × 日銷量 × 吸收率 × 競爭修正
                · 吸收率 = 日銷量 ÷ (掛單數+1)
                · 競爭修正 = 1 ÷ ln(賣家數+2)
                · 資料來源：<a href="https://universalis.app" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Universalis</a>
              </p>
            </>
          )}
        </div>
      )}

      {/* 初始空狀態 */}
      {results.length === 0 && !isScanning && !errorMsg && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">🔮</div>
          <div>選擇資料中心與伺服器，然後點擊「開始掃描」</div>
        </div>
      )}
    </div>
  );
}

// ============================================
// 子元件
// ============================================

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 border-l-4 border-l-blue-500 rounded-lg px-4 py-3">
      <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function ResultRow({
  index,
  result: r,
  maxScore,
  isExpanded,
  detailCount,
  onToggleExpand,
  onDetailCountChange,
}: {
  index: number;
  result: ScanResult;
  maxScore: number;
  isExpanded: boolean;
  detailCount: number;
  onToggleExpand: () => void;
  onDetailCountChange: (n: number) => void;
}) {
  const scorePct = maxScore > 0 ? Math.round((r.score / maxScore) * 100) : 0;

  const statusStyle: Record<string, string> = {
    '缺貨': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-300 dark:border-red-700',
    '熱銷': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-300 dark:border-orange-700',
    '普通': 'bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400 border border-gray-300 dark:border-gray-600',
    '滯銷': 'bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-500 border border-slate-300 dark:border-slate-700',
  };
  const statusIcon: Record<string, string> = { '缺貨': '🚨', '熱銷': '🔥', '普通': '➖', '滯銷': '🐌' };

  return (
    <>
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        <td className="px-3 py-2 text-gray-400 text-xs">{index + 1}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-800 dark:text-gray-200">{r.nameTw}</span>
            <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${statusStyle[r.marketStatus]}`}>
              {statusIcon[r.marketStatus]} {r.marketStatus}
            </span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {r.nameEn && <>{r.nameEn} · </>}iLv {r.ilvl}{r.canHq ? ' · 可 HQ' : ''}
            <button onClick={onToggleExpand} className="ml-2 text-blue-500 hover:underline">
              {isExpanded ? '收起' : '展開看板'}
            </button>
          </div>
        </td>
        <td className="px-3 py-2 text-right font-semibold text-yellow-600 dark:text-yellow-400">
          {r.minListingPrice > 0 ? fmtGil(r.minListingPrice) : <span className="text-gray-400">—</span>}
        </td>
        <td className="px-3 py-2 text-right font-semibold text-yellow-600 dark:text-yellow-400">
          {fmtGil(r.medianPrice)}
        </td>
        <td className="px-3 py-2 text-right text-blue-600 dark:text-blue-400">
          {r.velocity.toFixed(1)} <span className="text-gray-400 text-xs">/ 日</span>
        </td>
        <td className="px-3 py-2 text-right text-gray-500">
          {r.totalListings}
        </td>
        <td className="px-3 py-2 text-right">
          <span className={`font-medium ${r.absorptionRate >= 0.3 ? 'text-green-600 dark:text-green-400' : r.absorptionRate >= 0.1 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500'}`}>
            {r.absorptionRate.toFixed(2)}
          </span>
        </td>
        <td className="px-3 py-2 text-right text-gray-500">
          {r.sellThroughDays < 999 ? r.sellThroughDays.toFixed(1) : '—'} <span className="text-gray-400 text-xs">天</span>
        </td>
        <td className="px-3 py-2 text-right">
          <span className={`font-medium ${r.sellersCount <= 5 ? 'text-green-600 dark:text-green-400' : r.sellersCount <= 15 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500'}`}>
            {r.sellersCount}
          </span>
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-2">
            <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-400 to-green-400 rounded-full" style={{ width: `${Math.min(scorePct, 100)}%` }} />
            </div>
            <span className="text-xs font-bold text-green-600 dark:text-green-400 min-w-[36px] text-right">{fmtCompact(r.score)}</span>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={10} className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
            <div className="mb-2 flex items-center gap-3 text-xs text-gray-500">
              <span>顯示筆數：</span>
              <input
                type="range" min={5} max={30} value={detailCount}
                onChange={e => onDetailCountChange(parseInt(e.target.value))}
                className="w-32 accent-blue-500"
              />
              <span>{detailCount}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 刊價 */}
              <div>
                <h5 className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 mb-2">
                  最低刊價（看板）<span className="text-gray-400 ml-1">共 {r.listings.length} 筆</span>
                </h5>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="text-gray-400">
                      <tr>
                        <th className="py-1 text-left">#</th>
                        <th className="py-1 text-left">價格</th>
                        <th className="py-1 text-left">數量</th>
                        <th className="py-1 text-left">總計</th>
                        <th className="py-1 text-left">賣家</th>
                        <th className="py-1 text-left">伺服器</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-600 dark:text-gray-300">
                      {r.listings.slice(0, detailCount).map((l, idx) => (
                        <tr key={idx}>
                          <td className="py-1">{idx + 1}</td>
                          <td className="py-1">{fmtGil(l.pricePerUnit)}</td>
                          <td className="py-1">{l.quantity}</td>
                          <td className="py-1">{fmtGil(l.total || l.pricePerUnit * l.quantity)}</td>
                          <td className="py-1">{l.retainerName}</td>
                          <td className="py-1">{l.worldName}</td>
                        </tr>
                      ))}
                      {r.listings.length === 0 && (
                        <tr><td colSpan={6} className="py-2 text-gray-400">無刊價資料</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* 成交 */}
              <div>
                <h5 className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 mb-2">
                  最近售出記錄 <span className="text-gray-400 ml-1">共 {r.recentHistory.length} 筆</span>
                </h5>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="text-gray-400">
                      <tr>
                        <th className="py-1 text-left">#</th>
                        <th className="py-1 text-left">價格</th>
                        <th className="py-1 text-left">數量</th>
                        <th className="py-1 text-left">總計</th>
                        <th className="py-1 text-left">買家</th>
                        <th className="py-1 text-left">時間</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-600 dark:text-gray-300">
                      {r.recentHistory.slice(0, detailCount).map((h, idx) => (
                        <tr key={idx}>
                          <td className="py-1">{idx + 1}</td>
                          <td className="py-1">{fmtGil(h.pricePerUnit)}</td>
                          <td className="py-1">{h.quantity}</td>
                          <td className="py-1">{fmtGil(h.total || h.pricePerUnit * h.quantity)}</td>
                          <td className="py-1">{h.buyerName}</td>
                          <td className="py-1">{timeAgo(h.timestamp)}</td>
                        </tr>
                      ))}
                      {r.recentHistory.length === 0 && (
                        <tr><td colSpan={6} className="py-2 text-gray-400">無成交資料</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
