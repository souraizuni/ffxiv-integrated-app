'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  fetchItemMarketBoard,
  fetchItemSaleHistory,
  fetchTaxRates,
  lowestTaxRate,
  netAfterTax,
  TAX_CITY_NAMES,
  type ItemSaleEntry,
} from '@/hooks/use-universalis';
import { getRelatedItems, type GameItem } from '@/lib/data/items';

// 走勢圖用手寫 SVG 而非圖表套件：專案剛把 JS bundle 從 10.7 MB 壓到 1.6 MB，
// 為了一張折線圖再加回約 400 KB 的相依並不划算。

const RANGE_OPTIONS = [
  { days: 1, label: '1 天' },
  { days: 3, label: '3 天' },
  { days: 7, label: '7 天' },
  { days: 14, label: '14 天' },
  { days: 30, label: '30 天' },
] as const;

type RangeDays = (typeof RANGE_OPTIONS)[number]['days'];
type QualityFilter = 'all' | 'hq' | 'nq';

interface ItemMarketDetailProps {
  item: GameItem;
  /** 查詢對象：世界名或資料中心名 */
  queryTarget: string;
  /** 使用者所在世界，用於查稅率。各世界稅率不同，且賣家繳的是自己上架地的稅 */
  world?: string;
  onClose?: () => void;
  /** 點擊相關物品時切換查詢對象 */
  onSelectItem?: (item: GameItem) => void;
}

const CHART_W = 720;
const CHART_H = 190;
const PAD_L = 56;
const PAD_R = 12;
const PAD_T = 10;
const PAD_B = 22;

interface ChartPoint {
  x: number;
  y: number;
  price: number;
  timestamp: number;
}

function fmtTime(tsSeconds: number): string {
  return new Date(tsSeconds * 1000).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ItemMarketDetail({
  item,
  queryTarget,
  world,
  onClose,
  onSelectItem,
}: ItemMarketDetailProps) {
  const [range, setRange] = useState<RangeDays>(7);
  const [quality, setQuality] = useState<QualityFilter>('all');
  const [hovered, setHovered] = useState<ChartPoint | null>(null);

  // queryTarget 為空代表使用者還沒選好伺服器；此時不可發請求，
  // 否則會組出 /api/v2//12345 這種網址並得到難以理解的錯誤。
  const hasTarget = Boolean(queryTarget);

  const { data: board, isLoading: boardLoading, error: boardError } = useSWR(
    hasTarget ? ['item-board', queryTarget, item.id] : null,
    ([, target, id]: [string, string, number]) => fetchItemMarketBoard(target, id),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const { data: history = [], isLoading: historyLoading } = useSWR(
    hasTarget ? ['item-history', queryTarget, item.id, range] : null,
    ([, target, id, days]: [string, string, number, number]) =>
      fetchItemSaleHistory(target, id, days),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  // 各世界稅率不同，因此只在選定單一世界時查詢
  const { data: taxRates } = useSWR(
    world ? ['tax-rates', world] : null,
    ([, w]: [string, string]) => fetchTaxRates(w),
    { revalidateOnFocus: false, dedupingInterval: 600_000 }
  );

  const bestTax = useMemo(() => (taxRates ? lowestTaxRate(taxRates) : null), [taxRates]);

  // 以目前最低在售價賣出、扣掉市場稅後的實收
  const netEstimate = useMemo(() => {
    const lowest = board?.minPriceNQ || board?.minPriceHQ || 0;
    if (!lowest) return null;

    // 未選定單一世界時無法取得稅率，以常見的 5% 估算並在畫面上標明
    const rate = bestTax?.rate ?? 5;
    return {
      lowest,
      rate,
      city: bestTax?.city,
      isEstimate: !bestTax,
      net: netAfterTax(lowest, rate),
      tax: lowest - netAfterTax(lowest, rate),
    };
  }, [board, bestTax]);

  const { data: related = [] } = useSWR(
    onSelectItem ? ['related-items', item.id] : null,
    ([, id]: [string, number]) => getRelatedItems(id, 12),
    { revalidateOnFocus: false }
  );

  const listings = useMemo(() => {
    const all = board?.listings ?? [];
    const filtered =
      quality === 'all' ? all : all.filter((l) => (quality === 'hq' ? l.hq : !l.hq));
    return [...filtered].sort((a, b) => a.pricePerUnit - b.pricePerUnit);
  }, [board, quality]);

  const chart = useMemo(() => {
    if (history.length < 2) return null;

    const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
    const prices = sorted.map((e) => e.pricePerUnit);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minTime = sorted[0].timestamp;
    const maxTime = sorted[sorted.length - 1].timestamp;

    const priceSpan = maxPrice - minPrice || 1;
    const timeSpan = maxTime - minTime || 1;
    const innerW = CHART_W - PAD_L - PAD_R;
    const innerH = CHART_H - PAD_T - PAD_B;

    const points: ChartPoint[] = sorted.map((e) => ({
      x: PAD_L + ((e.timestamp - minTime) / timeSpan) * innerW,
      y: PAD_T + innerH - ((e.pricePerUnit - minPrice) / priceSpan) * innerH,
      price: e.pricePerUnit,
      timestamp: e.timestamp,
    }));

    const line = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
    const baseline = PAD_T + innerH;
    const area = `${line} L${points[points.length - 1].x.toFixed(1)},${baseline} L${points[0].x.toFixed(1)},${baseline} Z`;

    const ticks = [0, 0.5, 1].map((ratio) => ({
      y: PAD_T + innerH - ratio * innerH,
      value: Math.round(minPrice + ratio * priceSpan),
    }));

    const avgPrice = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
    const avgY =
      maxPrice === minPrice
        ? null
        : PAD_T + innerH - ((avgPrice - minPrice) / priceSpan) * innerH;

    return { points, line, area, ticks, avgPrice, avgY, minTime, maxTime };
  }, [history]);

  // 切換區間後 points 整組換新，舊的 hovered 會指向已不存在的點；
  // 直接拿來畫 tooltip 會顯示過期數值，因此在 render 期間確認它仍屬於目前資料。
  const activeHover = hovered && chart?.points.includes(hovered) ? hovered : null;

  const stats = useMemo(() => {
    if (history.length === 0) return null;

    const totalQty = history.reduce((s, e) => s + e.quantity, 0);
    const totalGil = history.reduce((s, e) => s + e.total, 0);

    return {
      sales: history.length,
      totalQty,
      avgPrice: totalQty > 0 ? Math.round(totalGil / totalQty) : 0,
      perDay: (totalQty / Math.max(1, range)).toFixed(1),
      hqRatio: Math.round((history.filter((e) => e.hq).length / history.length) * 100),
    };
  }, [history, range]);

  const tabButton = (active: boolean) =>
    `px-3 py-1 rounded text-xs font-medium transition-colors border ${
      active
        ? 'bg-blue-500 border-blue-500 text-white'
        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400'
    }`;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
      {/* 標題 */}
      <div className="flex items-start gap-3">
        {item.iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.iconUrl} alt="" className="w-12 h-12 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
            {item.name}
          </h3>
          <p className="text-xs text-gray-500 truncate">
            {item.nameEn}
            {item.categoryName && ` · ${item.categoryName}`}
            {item.itemLevel > 1 && ` · iLv ${item.itemLevel}`}
            {item.canBeHQ && ' · 可 HQ'}
          </p>
        </div>

        {board && (
          <div className="flex gap-4 text-right shrink-0">
            <div>
              <p className="text-[11px] text-gray-500">最低 NQ</p>
              <p className="text-base font-bold text-green-600 dark:text-green-400">
                {board.minPriceNQ ? board.minPriceNQ.toLocaleString() : '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500">最低 HQ</p>
              <p className="text-base font-bold text-amber-600 dark:text-amber-400">
                {board.minPriceHQ ? board.minPriceHQ.toLocaleString() : '—'}
              </p>
            </div>
          </div>
        )}

        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none shrink-0"
            aria-label="關閉"
          >
            ×
          </button>
        )}
      </div>

      {/* 淨利試算：扣掉市場稅才是真正入袋的金額 */}
      {netEstimate && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs border-t border-gray-100 dark:border-gray-800 pt-3">
          <span className="text-gray-500">
            以最低價{' '}
            <b className="text-green-600 dark:text-green-400">
              {netEstimate.lowest.toLocaleString()}
            </b>{' '}
            賣出
          </span>
          <span className="text-gray-500">
            市場稅 {netEstimate.rate}%
            {netEstimate.city && `（${TAX_CITY_NAMES[netEstimate.city] || netEstimate.city}）`}
            <b className="text-red-500 ml-1">-{netEstimate.tax.toLocaleString()}</b>
          </span>
          <span className="text-gray-500">
            實收{' '}
            <b className="text-emerald-600 dark:text-emerald-400">
              {netEstimate.net.toLocaleString()}
            </b>
          </span>
          {netEstimate.isEstimate && (
            <span className="text-gray-400">（稅率需選定單一伺服器，此處以 5% 估算）</span>
          )}
        </div>
      )}

      {!hasTarget ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          請先於下方選擇資料中心或伺服器
        </p>
      ) : boardError ? (
        <p className="text-sm text-red-500 py-4 text-center">
          取得市場資料失敗：{String(boardError)}
        </p>
      ) : (
        <>
          {/* 成交走勢 */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-1">
                {RANGE_OPTIONS.map((o) => (
                  <button
                    key={o.days}
                    onClick={() => setRange(o.days)}
                    className={tabButton(range === o.days)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              {stats && (
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>
                    成交 <b className="text-gray-700 dark:text-gray-300">{stats.sales}</b> 筆
                  </span>
                  <span>
                    日均 <b className="text-blue-600 dark:text-blue-400">{stats.perDay}</b> 個
                  </span>
                  <span>
                    均價{' '}
                    <b className="text-amber-600 dark:text-amber-400">
                      {stats.avgPrice.toLocaleString()}
                    </b>
                  </span>
                  <span>
                    HQ <b className="text-gray-700 dark:text-gray-300">{stats.hqRatio}%</b>
                  </span>
                </div>
              )}
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-gray-800/50">
              {historyLoading ? (
                <div className="h-[190px] flex items-center justify-center text-sm text-gray-500">
                  <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
                  載入成交歷史…
                </div>
              ) : !chart ? (
                <div className="h-[190px] flex items-center justify-center text-sm text-gray-500">
                  此區間內成交筆數不足，無法繪製走勢
                </div>
              ) : (
                <svg
                  viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                  className="w-full h-[190px]"
                  onMouseLeave={() => setHovered(null)}
                >
                  <defs>
                    <linearGradient id="itemPriceArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {chart.ticks.map((t) => (
                    <g key={t.value}>
                      <line
                        x1={PAD_L}
                        y1={t.y}
                        x2={CHART_W - PAD_R}
                        y2={t.y}
                        className="stroke-gray-300 dark:stroke-gray-600"
                        strokeWidth="1"
                      />
                      <text
                        x={PAD_L - 6}
                        y={t.y + 3}
                        textAnchor="end"
                        fontSize="10"
                        className="fill-gray-500"
                      >
                        {t.value.toLocaleString()}
                      </text>
                    </g>
                  ))}

                  <path d={chart.area} fill="url(#itemPriceArea)" />
                  <path d={chart.line} fill="none" stroke="#3b82f6" strokeWidth="1.5" />

                  {chart.avgY !== null && (
                    <line
                      x1={PAD_L}
                      y1={chart.avgY}
                      x2={CHART_W - PAD_R}
                      y2={chart.avgY}
                      stroke="#f59e0b"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                      opacity="0.7"
                    />
                  )}

                  {chart.points.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={activeHover === p ? 4 : 2}
                      fill={activeHover === p ? '#f59e0b' : '#3b82f6'}
                      onMouseEnter={() => setHovered(p)}
                      className="cursor-pointer"
                    />
                  ))}

                  {activeHover && (
                    <g>
                      <rect
                        x={Math.min(activeHover.x + 6, CHART_W - 116)}
                        y={Math.max(activeHover.y - 32, 2)}
                        width="110"
                        height="30"
                        rx="4"
                        className="fill-gray-900 dark:fill-gray-700"
                        opacity="0.92"
                      />
                      <text
                        x={Math.min(activeHover.x + 12, CHART_W - 110)}
                        y={Math.max(activeHover.y - 19, 15)}
                        fontSize="10"
                        fill="#fbbf24"
                      >
                        {activeHover.price.toLocaleString()} gil
                      </text>
                      <text
                        x={Math.min(activeHover.x + 12, CHART_W - 110)}
                        y={Math.max(activeHover.y - 7, 27)}
                        fontSize="9"
                        fill="#d1d5db"
                      >
                        {fmtTime(activeHover.timestamp)}
                      </text>
                    </g>
                  )}

                  <text x={PAD_L} y={CHART_H - 5} fontSize="10" className="fill-gray-500">
                    {new Date(chart.minTime * 1000).toLocaleDateString('zh-TW', {
                      month: 'numeric',
                      day: 'numeric',
                    })}
                  </text>
                  <text
                    x={CHART_W - PAD_R}
                    y={CHART_H - 5}
                    fontSize="10"
                    textAnchor="end"
                    className="fill-gray-500"
                  >
                    {new Date(chart.maxTime * 1000).toLocaleDateString('zh-TW', {
                      month: 'numeric',
                      day: 'numeric',
                    })}
                  </text>
                </svg>
              )}
            </div>
          </section>

          {/* 在售清單 */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                📋 在售清單
              </h4>
              <div className="flex gap-1">
                {(
                  [
                    ['all', '全部'],
                    ['hq', 'HQ'],
                    ['nq', 'NQ'],
                  ] as const
                ).map(([v, label]) => (
                  <button key={v} onClick={() => setQuality(v)} className={tabButton(quality === v)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {boardLoading ? (
              <p className="text-sm text-gray-500 py-4 text-center">載入在售清單…</p>
            ) : listings.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                暫無在售項目（此伺服器目前無人上架，或資料尚未被上傳）
              </p>
            ) : (
              <div className="overflow-x-auto max-h-72 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="w-full text-sm min-w-[420px]">
                  <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
                    <tr className="text-xs text-gray-600 dark:text-gray-400">
                      <th className="px-3 py-2 text-right w-24">單價</th>
                      <th className="px-3 py-2 text-right w-16">數量</th>
                      <th className="px-3 py-2 text-right w-28">總計</th>
                      <th className="px-3 py-2 text-center w-14">品質</th>
                      <th className="px-3 py-2 text-left">雇員</th>
                      <th className="px-3 py-2 text-left w-24">伺服器</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map((l, i) => (
                      <tr
                        key={i}
                        className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="px-3 py-1.5 text-right text-green-600 dark:text-green-400 font-medium">
                          {l.pricePerUnit.toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5 text-right text-gray-600 dark:text-gray-400">
                          {l.quantity}
                        </td>
                        <td className="px-3 py-1.5 text-right text-amber-600 dark:text-amber-400 font-medium">
                          {l.total.toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {l.hq && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                              HQ
                            </span>
                          )}
                        </td>
                        <td
                          className="px-3 py-1.5 text-gray-500 truncate max-w-[140px]"
                          title={l.retainerName}
                        >
                          {l.retainerName || '-'}
                        </td>
                        <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">
                          {l.worldName || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 堆疊分布：一眼看出有沒有人整組賣，而不必逐筆掃在售清單 */}
          {board && board.stackSizes.length > 0 && (
            <StackSizeBreakdown stacks={board.stackSizes} />
          )}

          {/* 成交明細 */}
          {history.length > 0 && <SaleHistoryTable entries={history} />}

          {/* 相關物品：同分類、等級相近，方便橫向比價 */}
          {onSelectItem && related.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                🔗 相關物品
                <span className="ml-1 text-xs font-normal text-gray-500">
                  （{item.categoryName || '同分類'}．等級相近）
                </span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {related.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onSelectItem(r)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs hover:border-blue-400 transition-colors"
                    title={`${r.name}（iLv ${r.itemLevel}）`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.iconUrl && <img src={r.iconUrl} alt="" className="w-4 h-4" loading="lazy" />}
                    <span className="truncate max-w-[130px]">{r.name}</span>
                    <span className="text-gray-400">iLv {r.itemLevel}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SaleHistoryTable({ entries }: { entries: ItemSaleEntry[] }) {
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">📈 成交明細</h4>
      <div className="overflow-x-auto max-h-72 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="w-full text-sm min-w-[420px]">
          <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
            <tr className="text-xs text-gray-600 dark:text-gray-400">
              <th className="px-3 py-2 text-right w-24">單價</th>
              <th className="px-3 py-2 text-right w-16">數量</th>
              <th className="px-3 py-2 text-center w-14">品質</th>
              <th className="px-3 py-2 text-left">買家</th>
              <th className="px-3 py-2 text-right w-32">時間</th>
            </tr>
          </thead>
          <tbody>
            {entries.slice(0, 200).map((e, i) => (
              <tr
                key={i}
                className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td className="px-3 py-1.5 text-right text-green-600 dark:text-green-400">
                  {e.pricePerUnit.toLocaleString()}
                </td>
                <td className="px-3 py-1.5 text-right text-gray-600 dark:text-gray-400">
                  {e.quantity}
                </td>
                <td className="px-3 py-1.5 text-center">
                  {e.hq && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      HQ
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-gray-500 truncate max-w-[140px]" title={e.buyerName}>
                  {e.buyerName || '-'}
                </td>
                <td className="px-3 py-1.5 text-right text-gray-500 whitespace-nowrap">
                  {fmtTime(e.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** 在售堆疊大小分布 */
function StackSizeBreakdown({ stacks }: { stacks: Array<{ size: number; count: number }> }) {
  const maxCount = Math.max(...stacks.map((s) => s.count));
  const totalListings = stacks.reduce((sum, s) => sum + s.count, 0);
  const totalUnits = stacks.reduce((sum, s) => sum + s.size * s.count, 0);

  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        📦 堆疊分布
        <span className="ml-1 text-xs font-normal text-gray-500">
          （{totalListings} 筆在售、共 {totalUnits.toLocaleString()} 個）
        </span>
      </h4>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-1">
        {stacks.map((s) => (
          <div key={s.size} className="flex items-center gap-2 text-xs">
            <span className="w-12 text-right text-gray-600 dark:text-gray-400 shrink-0">
              ×{s.size}
            </span>
            <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
              <div
                className="h-full bg-blue-500/70"
                style={{ width: `${(s.count / maxCount) * 100}%` }}
              />
            </div>
            <span className="w-10 text-gray-500 shrink-0">{s.count} 筆</span>
          </div>
        ))}
      </div>
    </section>
  );
}
