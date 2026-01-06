'use client';

import { useState, useEffect } from 'react';
import type { ItemSourceInfo, GatheringNodeInfo, VendorInfoDetail, MobDropInfo } from '@/lib/item-sources';
import { getItemSources } from '@/lib/item-sources';

interface ItemSourceInfoProps {
  itemId: number;
  itemName: string;
  onClose?: () => void;
}

export function ItemSourceInfoPanel({ itemId, itemName, onClose }: ItemSourceInfoProps) {
  const [sources, setSources] = useState<ItemSourceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'vendors' | 'gathering' | 'drops'>('gathering');

  useEffect(() => {
    async function loadSources() {
      setLoading(true);
      setError(null);
      try {
        const data = await getItemSources(itemId);
        setSources(data);
        
        // 自動選擇有資料的第一個分頁
        if (data) {
          if (data.gatheringNodes.length > 0) {
            setActiveTab('gathering');
          } else if (data.vendors.length > 0) {
            setActiveTab('vendors');
          } else if (data.drops.length > 0) {
            setActiveTab('drops');
          }
        }
      } catch (err) {
        setError('無法載入來源資訊');
      } finally {
        setLoading(false);
      }
    }
    loadSources();
  }, [itemId]);

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full mb-2" />
        <div>載入來源資訊中...</div>
      </div>
    );
  }

  if (error || !sources) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div>無法取得來源資訊</div>
      </div>
    );
  }

  const hasGathering = sources.gatheringNodes.length > 0;
  const hasVendors = sources.vendors.length > 0;
  const hasDrops = sources.drops.length > 0;

  if (!hasGathering && !hasVendors && !hasDrops) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div>此物品無採集/購買/掉落資訊</div>
        <div className="text-sm mt-1">可能是任務獎勵或特殊途徑取得</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* 標題 */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <h4 className="font-semibold text-gray-900 dark:text-white">
          {itemName} - 取得方式
        </h4>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        )}
      </div>

      {/* 分頁按鈕 */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {hasGathering && (
          <TabButton
            active={activeTab === 'gathering'}
            onClick={() => setActiveTab('gathering')}
            icon="⛏️"
            label={`採集 (${sources.gatheringNodes.length})`}
          />
        )}
        {hasVendors && (
          <TabButton
            active={activeTab === 'vendors'}
            onClick={() => setActiveTab('vendors')}
            icon="🏪"
            label={`購買 (${sources.vendors.length})`}
          />
        )}
        {hasDrops && (
          <TabButton
            active={activeTab === 'drops'}
            onClick={() => setActiveTab('drops')}
            icon="👾"
            label={`掉落 (${sources.drops.length})`}
          />
        )}
      </div>

      {/* 分頁內容 */}
      <div className="max-h-80 overflow-y-auto">
        {activeTab === 'gathering' && hasGathering && (
          <GatheringNodeList nodes={sources.gatheringNodes} />
        )}
        {activeTab === 'vendors' && hasVendors && (
          <VendorList vendors={sources.vendors} price={sources.price} />
        )}
        {activeTab === 'drops' && hasDrops && (
          <DropList drops={sources.drops} />
        )}
      </div>
    </div>
  );
}

// 分頁按鈕
function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 px-4 py-2 text-sm font-medium
        ${active
          ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
        }
      `}
    >
      <span className="mr-1">{icon}</span>
      {label}
    </button>
  );
}

// 採集點列表
function GatheringNodeList({ nodes }: { nodes: GatheringNodeInfo[] }) {
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {nodes.map((node) => (
        <div key={node.id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{node.typeIcon}</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {node.zoneNameZh}
            </span>
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded">
              Lv.{node.level}
            </span>
            {node.limited && (
              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                限時
              </span>
            )}
            {node.legendary && (
              <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded">
                傳說
              </span>
            )}
            {node.ephemeral && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                時效
              </span>
            )}
          </div>
          <div className="mt-1 text-sm text-gray-500 flex items-center gap-2 flex-wrap">
            <span>{node.typeNameZh}</span>
            {node.x > 0 && node.y > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <span className="font-mono text-blue-600 dark:text-blue-400">
                  📍 X: {node.x.toFixed(1)}, Y: {node.y.toFixed(1)}
                </span>
              </>
            )}
            {node.spawns.length > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <span>⏰ ET {node.spawns.join(', ')}:00</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// 商店列表
function VendorList({ vendors, price }: { vendors: VendorInfoDetail[]; price?: number }) {
  // 只顯示前 15 個商店
  const displayVendors = vendors.slice(0, 15);
  const hasMore = vendors.length > 15;

  return (
    <div>
      {price && price > 0 && (
        <div className="px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-100 dark:border-yellow-900/30">
          <span className="text-yellow-700 dark:text-yellow-400">
            💰 售價：{price.toLocaleString()} 金幣
          </span>
        </div>
      )}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {displayVendors.map((vendor, index) => (
          <div key={`${vendor.id}-${index}`} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg">🧑‍💼</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {vendor.nameZh}
              </span>
              {vendor.titleZh && (
                <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                  {vendor.titleZh}
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-gray-500 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1">
                📍 {vendor.zoneNameZh}
              </span>
              {vendor.x > 0 && vendor.y > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">
                    X: {vendor.x.toFixed(1)}, Y: {vendor.y.toFixed(1)}
                  </span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {hasMore && (
        <div className="px-3 py-2 text-center text-sm text-gray-500 bg-gray-50 dark:bg-gray-900">
          還有 {vendors.length - 15} 個商店...
        </div>
      )}
    </div>
  );
}

// 掉落列表
function DropList({ drops }: { drops: MobDropInfo[] }) {
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {drops.map((drop) => (
        <div key={drop.id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <div className="flex items-center gap-2">
            <span className="text-lg">👾</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {drop.name}
            </span>
            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">
              Lv.{drop.level}
            </span>
          </div>
          <div className="mt-1 text-sm text-gray-500">
            <span className="inline-flex items-center gap-1">
              📍 {drop.zoneNameZh}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// 緊湊版的來源提示
interface ItemSourceBadgesProps {
  itemId: number;
  onClick?: () => void;
}

export function ItemSourceBadges({ itemId, onClick }: ItemSourceBadgesProps) {
  const [sources, setSources] = useState<ItemSourceInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getItemSources(itemId).then((data) => {
      setSources(data);
      setLoading(false);
    });
  }, [itemId]);

  if (loading) {
    return (
      <span className="inline-block w-4 h-4 animate-pulse bg-gray-200 rounded" />
    );
  }

  if (!sources) return null;

  const hasGathering = sources.gatheringNodes.length > 0;
  const hasVendors = sources.vendors.length > 0;
  const hasDrops = sources.drops.length > 0;

  if (!hasGathering && !hasVendors && !hasDrops) return null;

  // 優先顯示採集資訊
  const primaryNode = sources.gatheringNodes[0];

  return (
    <div
      className="flex items-center gap-1 flex-wrap cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {hasGathering && primaryNode && (
        <span
          className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded inline-flex items-center gap-1"
          title={`可在 ${sources.gatheringNodes.length} 個地點採集`}
        >
          {primaryNode.typeIcon}
          <span className="max-w-[120px] truncate">{primaryNode.zoneNameZh}</span>
          {primaryNode.x > 0 && (
            <span className="font-mono">({primaryNode.x.toFixed(0)},{primaryNode.y.toFixed(0)})</span>
          )}
        </span>
      )}
      {hasVendors && (
        <span
          className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded"
          title={`可從 ${sources.vendors.length} 個商店購買`}
        >
          🏪 {sources.price ? `${sources.price}G` : '可購買'}
        </span>
      )}
      {hasDrops && (
        <span
          className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded"
          title={`可從 ${sources.drops.length} 種怪物掉落`}
        >
          👾 掉落
        </span>
      )}
    </div>
  );
}

// 相容舊版 API
export { ItemSourceInfoPanel as ItemSourceInfo };
