'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { MapData, MapMarker, Vector2 } from '@/lib/map-service';
import { getMapById, getMapByZone, getPositionPercentOnMap, getMarkerStyle, formatCoordinate, getMapImageUrlAsync, getGamePositionFromPercent } from '@/lib/map-service';

interface GameMapProps {
  /** 地圖 ID */
  mapId?: number;
  /** 區域 ID（若未提供 mapId 則使用此值） */
  zoneId?: number;
  /** 標記列表 */
  markers?: MapMarker[];
  /** 地圖寬度（像素或百分比） */
  width?: number | string;
  /** 地圖高度（像素或百分比） */
  height?: number | string;
  /** 是否顯示座標 */
  showCoordinates?: boolean;
  /** 是否允許縮放 */
  zoomable?: boolean;
  /** 點擊地圖時的回調 */
  onMapClick?: (position: Vector2) => void;
  /** 點擊標記時的回調 */
  onMarkerClick?: (marker: MapMarker, index: number) => void;
  /** 自訂 className */
  className?: string;
}

/**
 * FFXIV 遊戲地圖組件
 * 支援顯示地圖圖片、標記位置、座標轉換
 */
export function GameMap({
  mapId,
  zoneId,
  markers = [],
  width = '100%',
  height = 400,
  showCoordinates = true,
  zoomable = true,
  onMapClick,
  onMarkerClick,
  className = '',
}: GameMapProps) {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [mapImageUrl, setMapImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredMarker, setHoveredMarker] = useState<number | null>(null);
  const [mousePosition, setMousePosition] = useState<Vector2 | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // 計算滑鼠在圖片上的百分比位置
  const getMousePercentOnImage = useCallback((e: React.MouseEvent): Vector2 | null => {
    if (!imageRef.current || !imageLoaded) return null;
    
    const img = imageRef.current;
    const imgRect = img.getBoundingClientRect();
    
    // 檢查滑鼠是否在圖片範圍內
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    if (mouseX < imgRect.left || mouseX > imgRect.right ||
        mouseY < imgRect.top || mouseY > imgRect.bottom) {
      return null; // 滑鼠不在圖片上
    }
    
    // 計算在圖片上的百分比位置
    const percentX = ((mouseX - imgRect.left) / imgRect.width) * 100;
    const percentY = ((mouseY - imgRect.top) / imgRect.height) * 100;
    
    return { x: percentX, y: percentY };
  }, [imageLoaded]);

  // 載入地圖資料
  useEffect(() => {
    setLoading(true);
    setError(null);
    setImageLoaded(false);
    setImageError(false);
    setMapImageUrl('');

    let data: MapData | null = null;

    if (mapId) {
      data = getMapById(mapId);
    } else if (zoneId) {
      data = getMapByZone(zoneId);
    }

    if (data) {
      setMapData(data);
      setError(null);
      
      // 異步載入地圖圖片 URL
      getMapImageUrlAsync(data.id).then((url) => {
        if (url) {
          setMapImageUrl(url);
        }
      });
    } else {
      setError('找不到地圖資料');
    }

    setLoading(false);
  }, [mapId, zoneId]);

  // 處理滑鼠滾輪縮放
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!zoomable) return;
      e.preventDefault();

      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((prev) => Math.max(0.5, Math.min(3, prev + delta)));
    },
    [zoomable]
  );

  // 處理拖曳開始
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // 只處理左鍵
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  // 處理拖曳中
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // 更新滑鼠位置（用於顯示座標）
      if (mapData && showCoordinates) {
        const percent = getMousePercentOnImage(e);
        if (percent) {
          const gamePos = getGamePositionFromPercent(mapData, percent);
          setMousePosition(gamePos);
        } else {
          setMousePosition(null);
        }
      }

      if (!isDragging) return;
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart, mapData, showCoordinates]
  );

  // 處理拖曳結束
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 處理點擊
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onMapClick || !mapData) return;

      const percent = getMousePercentOnImage(e);
      if (percent) {
        const gamePos = getGamePositionFromPercent(mapData, percent);
        onMapClick(gamePos);
      }
    },
    [onMapClick, mapData, getMousePercentOnImage]
  );

  // 重置視圖
  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // 計算標記位置
  const getMarkerPosition = useCallback(
    (marker: MapMarker): Vector2 | null => {
      if (!mapData) return null;
      return getPositionPercentOnMap(mapData, { x: marker.x, y: marker.y });
    },
    [mapData]
  );

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${className}`}
        style={{ width, height }}
      >
        <div className="text-center text-gray-500">
          <div className="animate-spin inline-block w-8 h-8 border-2 border-current border-t-transparent rounded-full mb-2" />
          <div>載入地圖中...</div>
        </div>
      </div>
    );
  }

  if (error || !mapData) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${className}`}
        style={{ width, height }}
      >
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">🗺️</div>
          <div>{error || '無法載入地圖'}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-gray-900 select-none ${className}`}
      style={{ width, height }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp();
        setMousePosition(null);
      }}
      onClick={handleClick}
    >
      {/* 地圖標題 */}
      <div className="absolute top-2 left-2 z-20 bg-black/60 text-white px-3 py-1 rounded text-sm font-medium">
        {mapData.name}
      </div>

      {/* 控制按鈕 */}
      {zoomable && (
        <div className="absolute top-2 right-2 z-20 flex flex-col gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setZoom((z) => Math.min(3, z + 0.2));
            }}
            className="w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded flex items-center justify-center"
            title="放大"
          >
            +
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setZoom((z) => Math.max(0.5, z - 0.2));
            }}
            className="w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded flex items-center justify-center"
            title="縮小"
          >
            −
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleReset();
            }}
            className="w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded flex items-center justify-center text-xs"
            title="重置"
          >
            ⟲
          </button>
        </div>
      )}

      {/* 滑鼠座標顯示 */}
      {showCoordinates && mousePosition && (
        <div className="absolute bottom-2 left-2 z-20 bg-black/60 text-white px-2 py-1 rounded text-xs font-mono">
          {formatCoordinate(mousePosition.x, mousePosition.y)}
        </div>
      )}

      {/* 地圖圖片容器 */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-transform duration-100"
        style={{
          transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        {/* 地圖內容容器 - 正方形比例 */}
        <div className="relative aspect-square h-full max-w-full max-h-full">
          {/* 地圖圖片 */}
          {!imageError && mapImageUrl ? (
            <img
              ref={imageRef}
              src={mapImageUrl}
              alt={mapData.name}
              className={`w-full h-full object-contain ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              draggable={false}
            />
          ) : null}

          {/* 地圖載入失敗或正在載入時的替代顯示 */}
          {(imageError || !mapImageUrl || !imageLoaded) && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-6xl mb-4">🗺️</div>
                <div className="text-lg font-medium">{mapData.name}</div>
                <div className="text-sm mt-1 opacity-60">地圖預覽</div>
              </div>
            </div>
          )}

          {/* 標記 - 相對於地圖圖片定位 */}
          {markers.map((marker, index) => {
            const position = getMarkerPosition(marker);
            if (!position) return null;

            const style = getMarkerStyle(marker);
            const isHovered = hoveredMarker === index;
            const size = marker.size || 28;

            return (
              <div
                key={index}
                className="absolute transition-all duration-150"
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  zIndex: marker.zIndex || (isHovered ? 100 : 10),
                  transform: 'translate(-50%, -50%)',
                }}
                onMouseEnter={() => setHoveredMarker(index)}
                onMouseLeave={() => setHoveredMarker(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkerClick?.(marker, index);
                }}
              >
                {/* 標記範圍圈 - 半透明 */}
                <div
                  className={`
                    flex items-center justify-center rounded-full cursor-pointer
                    transition-all duration-150 shadow-lg
                    ${style.color}
                    ${isHovered ? 'scale-125 ring-2 ring-white/80 opacity-90' : 'hover:scale-110 opacity-60'}
                  `}
                  style={{
                    width: size,
                    height: size,
                    fontSize: size * 0.5,
                    backgroundColor: marker.color || 'rgba(59, 130, 246, 0.5)',
                    border: '2px solid rgba(255, 255, 255, 0.6)',
                  }}
                >
                  {style.icon}
                </div>

                {/* Tooltip */}
                {isHovered && marker.tooltip && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap z-50">
                    <div className="bg-black/90 text-white text-xs px-2 py-1 rounded shadow-lg">
                      {marker.tooltip}
                      <div className="text-gray-400 text-center">
                        {formatCoordinate(marker.x, marker.y)}
                      </div>
                    </div>
                    {/* 箭頭 */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/90" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 標記數量指示 */}
      {markers.length > 0 && (
        <div className="absolute bottom-2 right-2 z-20 bg-black/60 text-white px-2 py-1 rounded text-xs">
          {markers.length} 個標記
        </div>
      )}
    </div>
  );
}

export default GameMap;
