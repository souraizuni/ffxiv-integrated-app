'use client';

import { useState } from 'react';
import type { MaterialTreeNode, FlattenedMaterial } from '@/types';
import { ItemCard } from './item-card';
import { ItemSourceInfoPanel as ItemSourceInfo, ItemSourceBadges } from './item-source-info';

interface MaterialTreeProps {
  tree: MaterialTreeNode;
  onItemClick?: (itemId: number) => void;
}

export function MaterialTree({ tree, onItemClick }: MaterialTreeProps) {
  return (
    <div className="space-y-2">
      <MaterialTreeNodeView node={tree} onItemClick={onItemClick} />
    </div>
  );
}

interface MaterialTreeNodeViewProps {
  node: MaterialTreeNode;
  onItemClick?: (itemId: number) => void;
}

function MaterialTreeNodeView({ node, onItemClick }: MaterialTreeNodeViewProps) {
  const [isExpanded, setIsExpanded] = useState(node.depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div
      className="border-l-2 pl-4"
      style={{
        borderColor: node.isBaseMaterial
          ? 'rgb(34 197 94)' // green-500
          : 'rgb(59 130 246)', // blue-500
        marginLeft: node.depth > 0 ? '1rem' : 0,
      }}
    >
      <div
        className={`
          flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer
          hover:bg-gray-100 dark:hover:bg-gray-800
        `}
        onClick={() => {
          if (hasChildren) setIsExpanded(!isExpanded);
          onItemClick?.(node.itemId);
        }}
      >
        {/* 展開/收合按鈕 */}
        {hasChildren && (
          <button
            className="w-6 h-6 flex items-center justify-center text-gray-500"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}
        {!hasChildren && <div className="w-6" />}

        {/* 物品圖標 */}
        <img
          src={node.item.iconUrl}
          alt={node.item.name}
          className="w-8 h-8"
        />

        {/* 物品名稱與數量 */}
        <div className="flex-1">
          <span className="font-medium text-gray-900 dark:text-white">
            {node.item.name}
          </span>
          <span className="ml-2 text-sm text-gray-500">
            ×{node.amount}
          </span>
        </div>

        {/* 材料類型標籤 */}
        <span
          className={`
            px-2 py-1 text-xs rounded
            ${node.isBaseMaterial
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            }
          `}
        >
          {node.isBaseMaterial ? '基礎材料' : '可製作'}
        </span>
      </div>

      {/* 子節點 */}
      {isExpanded && hasChildren && (
        <div className="mt-2">
          {node.children.map((child, index) => (
            <MaterialTreeNodeView
              key={`${child.itemId}-${index}`}
              node={child}
              onItemClick={onItemClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 攤平的材料清單
interface MaterialListProps {
  materials: FlattenedMaterial[];
  inventory?: Map<number, number>;
  onItemClick?: (itemId: number) => void;
}

export function MaterialList({
  materials,
  inventory,
  onItemClick,
}: MaterialListProps) {
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
            <ItemSourceInfo
              itemId={selectedItemId}
              itemName={selectedMaterial.item.name}
              onClose={() => setShowSourceInfo(false)}
            />
          </div>
        </div>
      )}

      {/* 基礎材料 */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-green-600 dark:text-green-400">
          基礎材料（需採集/購買）
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {baseMaterials.map((material) => {
            const owned = inventory?.get(material.itemId) || 0;
            const remaining = Math.max(0, material.totalAmount - owned);
            
            return (
              <div
                key={material.itemId}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border cursor-pointer
                  ${remaining === 0
                    ? 'bg-green-50 border-green-300 dark:bg-green-900/20'
                    : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                  }
                `}
                onClick={() => onItemClick?.(material.itemId)}
              >
                <img
                  src={material.item.iconUrl}
                  alt={material.item.name}
                  className="w-10 h-10"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {material.item.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {owned > 0 && (
                      <span className="text-green-600">{owned} / </span>
                    )}
                    <span>{material.totalAmount}</span>
                    {remaining > 0 && (
                      <span className="text-amber-600 ml-2">
                        (還需 {remaining})
                      </span>
                    )}
                  </div>
                  {/* 來源標籤 */}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShowSource(material.itemId);
                  }}
                  title="查看取得方式"
                >
                  📍
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 可製作材料 */}
      {craftableMaterials.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-blue-600 dark:text-blue-400">
            中間製品（需製作）
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {craftableMaterials.map((material) => (
              <div
                key={material.itemId}
                className="flex items-center gap-3 p-3 rounded-lg border bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 cursor-pointer hover:border-blue-400"
                onClick={() => onItemClick?.(material.itemId)}
              >
                <img
                  src={material.item.iconUrl}
                  alt={material.item.name}
                  className="w-10 h-10"
                />
                <div className="flex-1">
                  <div className="font-medium">
                    {material.item.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    需製作 ×{material.totalAmount}
                  </div>
                </div>
                <span className="text-blue-500">→</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
