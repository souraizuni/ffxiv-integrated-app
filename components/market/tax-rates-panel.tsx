'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  fetchTaxRatesForWorlds,
  TAX_CITY_NAMES,
  type WorldTaxRates,
} from '@/hooks/use-universalis';

// ============================================
// 市場稅率一覽
// ============================================
// 為什麼要做成「整個資料中心 × 所有城市」的矩陣，而不是只顯示目前伺服器：
// 各世界稅率不同，同一世界內各城市也不同（實測繁中服有 0% 到 5% 的差距）。
// 要決定「該去哪上架」就必須整張表一起看。稅率會隨大國防聯軍戰績週期變動，
// 所以這是一份需要即時查詢、不能寫死的資料。

interface TaxRatesPanelProps {
  /** 資料中心名稱，僅作標題顯示 */
  dataCenter: string;
  /** 該資料中心的所有世界 */
  worlds: string[];
  /** 使用者目前所在世界，會在表格中標示 */
  currentWorld?: string;
}

/** 依稅率高低給色：低稅率是好事 */
function rateClass(rate: number, isRowMin: boolean, isGlobalMin: boolean): string {
  if (isGlobalMin) return 'text-emerald-600 dark:text-emerald-400 font-bold';
  if (isRowMin) return 'text-green-600 dark:text-green-400 font-semibold';
  if (rate >= 5) return 'text-gray-500';
  return 'text-gray-700 dark:text-gray-300';
}

export function TaxRatesPanel({ dataCenter, worlds, currentWorld }: TaxRatesPanelProps) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, error, mutate } = useSWR(
    // 收合時不查，避免使用者根本沒點開就先打一輪請求
    open && worlds.length > 0 ? ['tax-rates-dc', dataCenter, worlds.join(',')] : null,
    ([, , list]: [string, string, string]) => fetchTaxRatesForWorlds(list.split(',')),
    {
      revalidateOnFocus: false,
      // 稅率以週為單位變動，10 分鐘內不重複查詢
      dedupingInterval: 600_000,
    }
  );

  const analysis = useMemo(() => {
    if (!data) return null;

    // 城市欄位以實際回傳的 key 為準，不寫死順序
    const cities = [...new Set(data.flatMap((w) => Object.keys(w.rates)))];

    let globalMin = Number.POSITIVE_INFINITY;
    for (const w of data) {
      for (const city of cities) {
        const rate = w.rates[city];
        // 稅率可能是 0，必須用 typeof 而非 truthy 判斷
        if (typeof rate === 'number' && rate < globalMin) globalMin = rate;
      }
    }

    const best = data
      .filter((w) => w.lowest !== null)
      .sort((a, b) => a.lowest!.rate - b.lowest!.rate)[0];

    return {
      cities,
      globalMin: Number.isFinite(globalMin) ? globalMin : null,
      best: best ?? null,
      failed: data.filter((w) => w.error).map((w) => w.world),
    };
  }, [data]);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <span>💰 市場稅率一覽 — {dataCenter}</span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-800 space-y-3">
          {isLoading ? (
            <p className="text-sm text-gray-500 py-3 flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              查詢 {worlds.length} 個伺服器的稅率…
            </p>
          ) : error ? (
            <div className="py-3">
              <p className="text-sm text-red-500">取得稅率失敗：{String(error)}</p>
              <button
                onClick={() => mutate()}
                className="mt-2 px-3 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                重試
              </button>
            </div>
          ) : !data || !analysis ? null : (
            <>
              {/* 結論先講：最划算的上架地點 */}
              {analysis.best?.lowest && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  最低稅率：
                  <b className="text-emerald-600 dark:text-emerald-400 mx-1">
                    {analysis.best.world}
                  </b>
                  的
                  <b className="text-emerald-600 dark:text-emerald-400 mx-1">
                    {TAX_CITY_NAMES[analysis.best.lowest.city] || analysis.best.lowest.city}
                  </b>
                  <b className="text-emerald-600 dark:text-emerald-400">
                    {analysis.best.lowest.rate}%
                  </b>
                  <span className="text-xs text-gray-400 ml-2">
                    （稅率隨大國防聯軍戰績週期變動，出售前建議重查）
                  </span>
                </p>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse min-w-[560px]">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800">
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-400 sticky left-0 bg-gray-100 dark:bg-gray-800">
                        伺服器
                      </th>
                      {analysis.cities.map((city) => (
                        <th
                          key={city}
                          className="px-2 py-1.5 text-right font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap"
                        >
                          {TAX_CITY_NAMES[city] || city}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((entry) => (
                      <TaxRow
                        key={entry.world}
                        entry={entry}
                        cities={analysis.cities}
                        globalMin={analysis.globalMin}
                        isCurrent={entry.world === currentWorld}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {analysis.failed.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  以下伺服器查詢失敗，未列入比較：{analysis.failed.join('、')}
                </p>
              )}

              <p className="text-xs text-gray-400">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">粗體綠</span>
                ＝全區最低，
                <span className="text-green-600 dark:text-green-400 font-semibold">綠</span>
                ＝該伺服器最低
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TaxRow({
  entry,
  cities,
  globalMin,
  isCurrent,
}: {
  entry: WorldTaxRates;
  cities: string[];
  globalMin: number | null;
  isCurrent: boolean;
}) {
  const rowMin = entry.lowest?.rate ?? null;

  return (
    <tr
      className={`border-t border-gray-100 dark:border-gray-800 ${
        isCurrent ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
    >
      <td
        className={`px-2 py-1.5 font-medium whitespace-nowrap sticky left-0 ${
          isCurrent
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
            : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300'
        }`}
      >
        {entry.world}
        {isCurrent && <span className="ml-1 text-[10px] text-blue-500">目前</span>}
      </td>

      {cities.map((city) => {
        const rate = entry.rates[city];

        if (typeof rate !== 'number') {
          return (
            <td key={city} className="px-2 py-1.5 text-right text-gray-300 dark:text-gray-600">
              —
            </td>
          );
        }

        return (
          <td
            key={city}
            className={`px-2 py-1.5 text-right ${rateClass(
              rate,
              rowMin !== null && rate === rowMin,
              globalMin !== null && rate === globalMin
            )}`}
          >
            {rate}%
          </td>
        );
      })}
    </tr>
  );
}
