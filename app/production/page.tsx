"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type MaterialCostEntry = {
  itemId: number;
  itemName?: string; // 物品名稱
  unitPrice: number;
  purchaseQty: number;
  source: 'buy' | 'craft';
  possession?: 'buy' | 'craft' | 'have';
  ownedQty?: number;
};

type ProductionRecord = {
  id: string;
  createdAt: string;
  multiplier: number;
  craftYield: number;
  totalCost: number;
  costPerUnit: number;
  costBreakdown: { baseCost: number; craftableCost: number };
  entries: MaterialCostEntry[];
  materialTree: { itemId: number; name: string } | null;
};

export default function ProductionPage() {
  const router = useRouter();
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<{ recordId: string; entryIndex: number } | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('production_records');
    if (raw) {
      try {
        setRecords(JSON.parse(raw));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const persist = (next: ProductionRecord[]) => {
    setRecords(next);
    localStorage.setItem('production_records', JSON.stringify(next));
  };

  const remove = (id: string) => {
    if (!confirm('確定要刪除這筆紀錄嗎？')) return;
    const next = records.filter((r) => r.id !== id);
    persist(next);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    setEditingEntry(null);
  };

  // 更新單一材料欄位
  const updateEntry = (recordId: string, entryIndex: number, field: keyof MaterialCostEntry, value: number | string) => {
    const next = records.map((r) => {
      if (r.id !== recordId) return r;
      const newEntries = [...r.entries];
      newEntries[entryIndex] = { ...newEntries[entryIndex], [field]: value };
      
      // 重新計算總成本
      let totalCost = 0;
      newEntries.forEach((e) => {
        if (e.source === 'buy' || e.possession === 'have') {
          totalCost += e.unitPrice * e.purchaseQty;
        }
      });
      const totalOutput = r.multiplier * r.craftYield;
      const costPerUnit = totalOutput > 0 ? totalCost / totalOutput : 0;

      return { ...r, entries: newEntries, totalCost, costPerUnit };
    });
    persist(next);
  };

  // 更新紀錄基本資訊
  const updateRecord = (recordId: string, field: 'multiplier' | 'craftYield', value: number) => {
    const next = records.map((r) => {
      if (r.id !== recordId) return r;
      const updated = { ...r, [field]: value };
      const totalOutput = updated.multiplier * updated.craftYield;
      updated.costPerUnit = totalOutput > 0 ? updated.totalCost / totalOutput : 0;
      return updated;
    });
    persist(next);
  };

  // 載入紀錄到生產指引
  const loadToCrafting = (record: ProductionRecord) => {
    // 將紀錄存入 sessionStorage 供生產指引頁面讀取
    // 加入 itemId 以便自動載入對應配方
    sessionStorage.setItem('loaded_production_record', JSON.stringify({
      ...record,
      targetItemId: record.materialTree?.itemId,
    }));
    router.push('/crafting');
  };

  const exportRecord = (r: ProductionRecord) => {
    const data = JSON.stringify(r, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `production_${r.materialTree?.name || r.id}_${new Date(r.createdAt).toLocaleDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const duplicateRecord = (r: ProductionRecord) => {
    const newRecord = {
      ...r,
      id: `rec_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    persist([newRecord, ...records]);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📋 生產紀錄</h1>
        <div className="text-sm text-gray-500">
          共 {records.length} 筆紀錄
        </div>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-lg">尚無生產紀錄</p>
          <p className="text-sm mt-2">
            前往 <a href="/crafting" className="text-blue-500 hover:underline">生產指引</a> 計算成本並儲存紀錄
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((r) => (
            <div
              key={r.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* 摘要列 */}
              <div
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                onClick={() => toggleExpand(r.id)}
              >
                {/* 展開指示 */}
                <span className={`transition-transform ${expandedId === r.id ? 'rotate-90' : ''}`}>
                  ▶
                </span>

                {/* 品項資訊 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg truncate">
                      {r.materialTree?.name || '未知品項'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                    <span>🕐 {new Date(r.createdAt).toLocaleString()}</span>
                    <span>📦 {r.multiplier} × {r.craftYield} = {r.multiplier * r.craftYield} 個</span>
                  </div>
                </div>

                {/* 成本摘要 */}
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-blue-600">
                    {r.totalCost.toLocaleString()} 金
                  </div>
                  <div className="text-sm text-gray-500">
                    單位成本: {r.costPerUnit.toFixed(2)} 金
                  </div>
                </div>

                {/* 操作按鈕 */}
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => loadToCrafting(r)}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors flex items-center gap-1"
                    title="載入到生產指引"
                  >
                    ↩️ 載入
                  </button>
                  <button
                    onClick={() => duplicateRecord(r)}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title="複製紀錄"
                  >
                    📋
                  </button>
                  <button
                    onClick={() => exportRecord(r)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
                    title="匯出 JSON"
                  >
                    📤
                  </button>
                  <button
                    onClick={() => remove(r.id)}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                    title="刪除"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* 展開詳情 */}
              {expandedId === r.id && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50">
                  {/* 基本資訊編輯 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">製作次數</label>
                      <input
                        type="number"
                        min={1}
                        value={r.multiplier}
                        onChange={(e) => updateRecord(r.id, 'multiplier', Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">每次產出</label>
                      <input
                        type="number"
                        min={1}
                        value={r.craftYield}
                        onChange={(e) => updateRecord(r.id, 'craftYield', Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">總產出</label>
                      <div className="px-2 py-1 text-sm font-medium text-purple-600">
                        {r.multiplier * r.craftYield} 個
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">單位成本</label>
                      <div className="px-2 py-1 text-sm font-medium text-amber-600">
                        {r.costPerUnit.toFixed(2)} 金
                      </div>
                    </div>
                  </div>

                  {/* 成本細分 */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-xs text-green-600 dark:text-green-400">基礎材料成本</div>
                      <div className="text-lg font-bold text-green-700 dark:text-green-300">
                        {(r.costBreakdown?.baseCost || 0).toLocaleString()} 金
                      </div>
                    </div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <div className="text-xs text-amber-600 dark:text-amber-400">中間製品成本</div>
                      <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
                        {(r.costBreakdown?.craftableCost || 0).toLocaleString()} 金
                      </div>
                    </div>
                  </div>

                  {/* 材料清單 */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 font-medium text-sm">
                      材料清單 ({r.entries.length} 項)
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">物品名稱</th>
                            <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-400">來源</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">購買量</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">單價</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">小計</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {r.entries.map((entry, idx) => {
                            const isEditing = editingEntry?.recordId === r.id && editingEntry?.entryIndex === idx;
                            const subtotal = entry.source === 'buy' ? entry.unitPrice * entry.purchaseQty : 0;

                            return (
                              <tr
                                key={idx}
                                className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                                  entry.source === 'craft' ? 'opacity-50' : ''
                                }`}
                                onClick={() => setEditingEntry({ recordId: r.id, entryIndex: idx })}
                              >
                                <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{entry.itemName || `物品 #${entry.itemId}`}</span>
                                  <span className="text-xs text-gray-400">#{entry.itemId}</span>
                                </div>
                              </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    entry.possession === 'have'
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                      : entry.source === 'buy'
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                  }`}>
                                    {entry.possession === 'have' ? '已擁有' : entry.source === 'buy' ? '購買' : '自製'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      min={0}
                                      value={entry.purchaseQty}
                                      onChange={(e) => updateEntry(r.id, idx, 'purchaseQty', parseInt(e.target.value) || 0)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-20 px-2 py-0.5 border rounded text-right text-sm dark:bg-gray-700"
                                    />
                                  ) : (
                                    entry.purchaseQty
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      min={0}
                                      value={entry.unitPrice}
                                      onChange={(e) => updateEntry(r.id, idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-24 px-2 py-0.5 border rounded text-right text-sm dark:bg-gray-700"
                                    />
                                  ) : (
                                    entry.unitPrice.toLocaleString()
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right font-medium">
                                  {subtotal > 0 ? subtotal.toLocaleString() : '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50 dark:bg-gray-900 font-medium">
                          <tr>
                            <td colSpan={4} className="px-3 py-2 text-right">總計：</td>
                            <td className="px-3 py-2 text-right text-blue-600 font-bold">
                              {r.totalCost.toLocaleString()} 金
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-900">
                      💡 點擊材料列可編輯數量與價格
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
