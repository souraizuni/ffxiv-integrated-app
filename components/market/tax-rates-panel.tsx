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
// 用途：稅率只影響「賣出時被抽多少」，買東西的價格不受影響。
// 因此這張表要回答的問題是「我該把東西掛到哪個城市」——
// 雇員綁在自己的世界上，所以主要看的是自己世界那一列的城市差異；
// 跨世界的比較只是次要參考（例如評估轉移或分身）。
//
// 稅率會隨大國防聯軍戰績週期變動，必須即時查詢，不能寫死。

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

    // 已無市場活動的世界（關閉的伺服器）不參與比較，否則會建議使用者去一個賣不掉東西的地方。
    // 注意 0% 本身是合法稅率，不能拿來當判斷依據 —— 這裡靠的是市場活動探測結果。
    const usable = data.filter((w) => !w.inactive && !w.error);

    let globalMin = Number.POSITIVE_INFINITY;
    for (const w of usable) {
      for (const city of cities) {
        const rate = w.rates[city];
        // 稅率可能是 0，必須用 typeof 而非 truthy 判斷
        if (typeof rate === 'number' && rate < globalMin) globalMin = rate;
      }
    }

    // 主要結論：使用者自己世界裡最便宜的上架城市（雇員綁在自己的世界）
    const mine = currentWorld ? usable.find((w) => w.world === currentWorld) : undefined;

    // 次要參考：整個資料中心最低的世界
    const bestAcrossDc = [...usable]
      .filter((w) => w.lowest !== null)
      .sort((a, b) => a.lowest!.rate - b.lowest!.rate)[0];

    return {
      cities,
      globalMin: Number.isFinite(globalMin) ? globalMin : null,
      mine: mine ?? null,
      bestAcrossDc: bestAcrossDc ?? null,
      failed: data.filter((w) => w.error).map((w) => w.world),
      inactive: data.filter((w) => w.inactive).map((w) => w.world),
    };
  }, [data, currentWorld]);

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
              {/* 結論先講：你該把東西掛到哪個城市 */}
              <div className="space-y-1">
                {analysis.mine?.lowest ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    在
                    <b className="mx-1">{analysis.mine.world}</b>
                    上架，稅率最低的城市是
                    <b className="text-emerald-600 dark:text-emerald-400 mx-1">
                      {TAX_CITY_NAMES[analysis.mine.lowest.city] || analysis.mine.lowest.city}
                    </b>
                    <b className="text-emerald-600 dark:text-emerald-400">
                      {analysis.mine.lowest.rate}%
                    </b>
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">請先選擇你所在的伺服器</p>
                )}

                {analysis.bestAcrossDc?.lowest &&
                  analysis.bestAcrossDc.world !== analysis.mine?.world && (
                    <p className="text-xs text-gray-500">
                      本資料中心最低為 {analysis.bestAcrossDc.world} 的
                      {TAX_CITY_NAMES[analysis.bestAcrossDc.lowest.city] ||
                        analysis.bestAcrossDc.lowest.city}{' '}
                      {analysis.bestAcrossDc.lowest.rate}%
                      　（僅供參考：雇員綁在自己的世界，無法直接到別的世界上架）
                    </p>
                  )}

                <p className="text-xs text-gray-400">
                  稅率只影響賣出時被抽的比例，購買價格不受影響；
                  數值隨大國防聯軍戰績週期變動，出售前建議重查。
                </p>
              </div>

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

              {analysis.inactive.length > 0 && (
                <p className="text-xs text-gray-400">
                  以下伺服器已無市場活動（多半已關閉），未列入比較：
                  {analysis.inactive.join('、')}
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
