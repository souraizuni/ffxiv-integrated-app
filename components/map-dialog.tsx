'use client';

import { useState, useEffect, useCallback } from 'react';
import { GameMap } from './game-map';
import type { MapMarker } from '@/lib/map-service';

interface MapDialogProps {
  /** 是否顯示 */
  isOpen: boolean;
  /** 關閉回調 */
  onClose: () => void;
  /** 地圖 ID */
  mapId?: number;
  /** 區域 ID */
  zoneId?: number;
  /** 標題 */
  title?: string;
  /** 標記列表 */
  markers?: MapMarker[];
  /** 點擊標記時的回調 */
  onMarkerClick?: (marker: MapMarker, index: number) => void;
}

/**
 * 地圖彈窗組件
 * 用於在模態框中顯示地圖
 */
export function MapDialog({
  isOpen,
  onClose,
  mapId,
  zoneId,
  title,
  markers = [],
  onMarkerClick,
}: MapDialogProps) {
  const [isVisible, setIsVisible] = useState(false);

  // 處理開啟/關閉動畫
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 處理 ESC 鍵關閉
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 處理背景點擊關閉
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center
        transition-opacity duration-200
        ${isOpen ? 'opacity-100' : 'opacity-0'}
      `}
      onClick={handleBackdropClick}
    >
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/60" />

      {/* 對話框 */}
      <div
        className={`
          relative w-[90vw] max-w-4xl max-h-[90vh]
          bg-white dark:bg-gray-800 rounded-lg shadow-2xl
          transform transition-all duration-200
          ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 標題列 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <span>🗺️</span>
            {title || '地圖'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 地圖內容 - 使用正方形容器 */}
        <div className="p-4">
          <div className="aspect-square max-h-[70vh] mx-auto">
            <GameMap
              mapId={mapId}
              zoneId={zoneId}
              markers={markers}
              width="100%"
              height="100%"
              showCoordinates={true}
              zoomable={true}
              onMarkerClick={onMarkerClick}
            />
          </div>
        </div>

        {/* 標記列表（如果有多個標記） */}
        {markers.length > 1 && (
          <div className="px-4 pb-4">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              標記位置 ({markers.length})
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {markers.map((marker, index) => (
                <button
                  key={index}
                  onClick={() => onMarkerClick?.(marker, index)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <span>{marker.icon || '📍'}</span>
                  {marker.tooltip && <span className="max-w-[100px] truncate">{marker.tooltip}</span>}
                  <span className="font-mono text-gray-500">
                    ({marker.x.toFixed(1)}, {marker.y.toFixed(1)})
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 提示 */}
        <div className="px-4 pb-3 text-xs text-gray-400 dark:text-gray-500 text-center">
          滾輪縮放 · 拖曳移動 · ESC 關閉
        </div>
      </div>
    </div>
  );
}

export default MapDialog;
