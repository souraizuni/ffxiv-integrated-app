'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  type DataCenter,
  type World,
  DEFAULT_SERVER_CONFIG,
  loadServerConfig,
  saveServerConfig,
  fetchDataCentersAndWorlds,
} from '@/hooks/use-universalis';

interface ServerSelectorProps {
  onServerChange?: (worldId: number, worldName: string, dcName: string) => void;
  compact?: boolean;
}

// 地區中文標籤
const REGION_LABELS: Record<string, string> = {
  '繁中服': '繁體中文服',
  Japan: '日本',
  'North-America': '北美',
  Europe: '歐洲',
  Oceania: '大洋洲',
  '中国': '中國',
  '한국': '韓國',
};

// 地區排序（繁中服優先）
const REGION_ORDER = ['繁中服', 'Japan', 'North-America', 'Europe', 'Oceania', '中国', '한국'];

export function ServerSelector({ onServerChange, compact = false }: ServerSelectorProps) {
  const [dataCenters, setDataCenters] = useState<DataCenter[]>([]);
  const [worldsMap, setWorldsMap] = useState<Map<number, World>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 從 localStorage 讀取初始設定
  const [selectedDc, setSelectedDc] = useState<string>(DEFAULT_SERVER_CONFIG.dcName);
  const [selectedWorldId, setSelectedWorldId] = useState<number>(DEFAULT_SERVER_CONFIG.worldId);
  const [selectedWorldName, setSelectedWorldName] = useState<string>(DEFAULT_SERVER_CONFIG.worldName);

  // 載入初始設定
  useEffect(() => {
    const config = loadServerConfig();
    setSelectedDc(config.dcName);
    setSelectedWorldId(config.worldId);
    setSelectedWorldName(config.worldName);
  }, []);

  // 載入 DC 和伺服器列表
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { dataCenters: dcs, worlds } = await fetchDataCentersAndWorlds();
        if (cancelled) return;

        setDataCenters(dcs);
        const wMap = new Map<number, World>();
        worlds.forEach((w) => wMap.set(w.id, w));
        setWorldsMap(wMap);
        setIsLoading(false);
      } catch (e) {
        if (cancelled) return;
        console.error('載入伺服器列表失敗:', e);
        setError('無法載入伺服器列表');
        setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // 取得當前 DC 下的伺服器列表
  const currentDcWorlds = useCallback((): World[] => {
    const dc = dataCenters.find((d) => d.name === selectedDc);
    if (!dc) return [];
    return dc.worlds
      .map((id) => worldsMap.get(id))
      .filter((w): w is World => w !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dataCenters, selectedDc, worldsMap]);

  // DC 變更
  const handleDcChange = useCallback(
    (dcName: string) => {
      setSelectedDc(dcName);
      // 自動選擇此 DC 下的第一個伺服器
      const dc = dataCenters.find((d) => d.name === dcName);
      if (dc && dc.worlds.length > 0) {
        const firstWorld = worldsMap.get(dc.worlds[0]);
        if (firstWorld) {
          setSelectedWorldId(firstWorld.id);
          setSelectedWorldName(firstWorld.name);
          saveServerConfig({ dcName, worldId: firstWorld.id, worldName: firstWorld.name });
          onServerChange?.(firstWorld.id, firstWorld.name, dcName);
        }
      }
    },
    [dataCenters, worldsMap, onServerChange]
  );

  // 伺服器變更
  const handleWorldChange = useCallback(
    (worldId: number) => {
      const world = worldsMap.get(worldId);
      if (world) {
        setSelectedWorldId(worldId);
        setSelectedWorldName(world.name);
        saveServerConfig({ dcName: selectedDc, worldId, worldName: world.name });
        onServerChange?.(worldId, world.name, selectedDc);
      }
    },
    [worldsMap, selectedDc, onServerChange]
  );

  // 將 DC 按地區分組排序
  const groupedDcs = useCallback(() => {
    const groups: { region: string; label: string; dcs: DataCenter[] }[] = [];
    const regionMap = new Map<string, DataCenter[]>();

    dataCenters.forEach((dc) => {
      const existing = regionMap.get(dc.region) || [];
      existing.push(dc);
      regionMap.set(dc.region, existing);
    });

    // 按排序順序輸出
    const orderedRegions = [...REGION_ORDER, ...Array.from(regionMap.keys()).filter((r) => !REGION_ORDER.includes(r))];
    for (const region of orderedRegions) {
      const dcs = regionMap.get(region);
      if (dcs && dcs.length > 0) {
        groups.push({
          region,
          label: REGION_LABELS[region] || region,
          dcs: dcs.sort((a, b) => a.name.localeCompare(b.name)),
        });
      }
    }

    return groups;
  }, [dataCenters]);

  if (error) {
    return (
      <div className="text-xs text-red-500 flex items-center gap-1">
        <span>⚠</span> {error}
      </div>
    );
  }

  const worlds = currentDcWorlds();

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">🌐 伺服器：</span>
        {isLoading ? (
          <span className="text-gray-400 text-xs">載入中...</span>
        ) : (
          <>
            <select
              value={selectedDc}
              onChange={(e) => handleDcChange(e.target.value)}
              className="px-2 py-1 text-xs border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 max-w-[140px]"
            >
              {groupedDcs().map((group) => (
                <optgroup key={group.region} label={group.label}>
                  {group.dcs.map((dc) => (
                    <option key={dc.name} value={dc.name}>
                      {dc.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <select
              value={selectedWorldId}
              onChange={(e) => handleWorldChange(Number(e.target.value))}
              className="px-2 py-1 text-xs border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 max-w-[140px]"
            >
              {worlds.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.id})
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
          🌐 市場伺服器
        </span>
      </div>

      {isLoading ? (
        <span className="text-sm text-gray-400">載入伺服器列表中...</span>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-400">資料中心：</label>
            <select
              value={selectedDc}
              onChange={(e) => handleDcChange(e.target.value)}
              className="px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
            >
              {groupedDcs().map((group) => (
                <optgroup key={group.region} label={group.label}>
                  {group.dcs.map((dc) => (
                    <option key={dc.name} value={dc.name}>
                      {dc.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-400">伺服器：</label>
            <select
              value={selectedWorldId}
              onChange={(e) => handleWorldChange(Number(e.target.value))}
              className="px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
            >
              {worlds.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.id})
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-gray-400 dark:text-gray-500">
            目前：{selectedWorldName} ({selectedWorldId})
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Hook：取得目前選擇的伺服器設定
 */
export function useServerConfig() {
  const [config, setConfig] = useState(() => loadServerConfig());

  const updateConfig = useCallback((worldId: number, worldName: string, dcName: string) => {
    const newConfig = { worldId, worldName, dcName };
    saveServerConfig(newConfig);
    setConfig(newConfig);
  }, []);

  return { ...config, updateConfig };
}
