'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  advancedSearchItems,
  getCategoryNames,
  type GameItem,
} from '@/lib/data/items';
import { getCategoryNameTw } from '@/lib/i18n/item-categories';

// ============================================
// 進階搜尋
// ============================================
// 條件全部走本地 items.msgpack，完全離線且即時。
// 一般搜尋只能比對單一子字串；這裡支援多關鍵字（AND）與分類／等級／品質組合，
// 例如「iLv 600-700、可 HQ、金屬類、名稱含『合金』」。

interface AdvancedSearchProps {
  onSelectItem: (item: GameItem) => void;
}

export function AdvancedSearch({ onSelectItem }: AdvancedSearchProps) {
  const [open, setOpen] = useState(false);
  const [keywords, setKeywords] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [minIlvl, setMinIlvl] = useState<number | ''>('');
  const [maxIlvl, setMaxIlvl] = useState<number | ''>('');
  const [marketableOnly, setMarketableOnly] = useState(true);
  const [canBeHQOnly, setCanBeHQOnly] = useState(false);
  const [submitted, setSubmitted] = useState<object | null>(null);

  const { data: categoryNames } = useSWR('category-names', getCategoryNames, {
    revalidateOnFocus: false,
  });

  const { data: results = [], isLoading } = useSWR(
    submitted ? ['advanced-search', JSON.stringify(submitted)] : null,
    () =>
      advancedSearchItems({
        keywords,
        categoryIds: categoryId === '' ? undefined : [categoryId],
        minItemLevel: minIlvl === '' ? undefined : minIlvl,
        maxItemLevel: maxIlvl === '' ? undefined : maxIlvl,
        marketableOnly,
        canBeHQOnly,
        limit: 100,
      }),
    { revalidateOnFocus: false }
  );

  const categoryOptions = Object.entries(categoryNames ?? {})
    .map(([id, nameEn]) => ({
      id: Number(id),
      name: getCategoryNameTw(Number(id), nameEn),
    }))
    .filter((c) => c.id > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'));

  const reset = () => {
    setKeywords('');
    setCategoryId('');
    setMinIlvl('');
    setMaxIlvl('');
    setMarketableOnly(true);
    setCanBeHQOnly(false);
    setSubmitted(null);
  };

  const numberInput = (
    value: number | '',
    onChange: (v: number | '') => void,
    placeholder: string
  ) => (
    <input
      type="number"
      min={0}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800"
    />
  );

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <span>🔎 進階搜尋</span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSubmitted({ t: Date.now() })}
              placeholder="關鍵字（空白分隔，需全部命中）"
              className="flex-1 min-w-[200px] px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <span className="text-gray-600 dark:text-gray-400">分類</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 max-w-[160px]"
              >
                <option value="">不限</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-1.5">
              <span className="text-gray-600 dark:text-gray-400">iLv</span>
              {numberInput(minIlvl, setMinIlvl, '最低')}
              <span className="text-gray-400">–</span>
              {numberInput(maxIlvl, setMaxIlvl, '最高')}
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={marketableOnly}
                onChange={(e) => setMarketableOnly(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-gray-600 dark:text-gray-400">僅可交易</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={canBeHQOnly}
                onChange={(e) => setCanBeHQOnly(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-gray-600 dark:text-gray-400">僅可 HQ</span>
            </label>

            <button
              onClick={() => setSubmitted({ t: Date.now() })}
              className="px-3 py-1 rounded bg-blue-500 text-white text-sm hover:bg-blue-600 transition-colors"
            >
              搜尋
            </button>
            <button
              onClick={reset}
              className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              清除
            </button>
          </div>

          {submitted && (
            <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
              {isLoading ? (
                <p className="text-sm text-gray-500 py-2">搜尋中…</p>
              ) : results.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">沒有符合條件的物品</p>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-2">
                    找到 {results.length} 筆{results.length >= 100 && '（僅顯示前 100 筆）'}
                  </p>
                  <div className="max-h-64 overflow-y-auto space-y-0.5">
                    {results.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => onSelectItem(item)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.iconUrl} alt="" className="w-6 h-6 shrink-0" loading="lazy" />
                        <span className="text-sm truncate flex-1">{item.name}</span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {item.categoryName} · iLv {item.itemLevel}
                          {item.canBeHQ && ' · HQ'}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
