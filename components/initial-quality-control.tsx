import React from 'react';

export default function InitialQualityControl({ solverOptions, setSolverOptions }: any) {
  const enabled = !!solverOptions.initialQualityEnabled;
  const value = solverOptions.initialQuality ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">初始品質 (Initial Quality)</div>
          <div className="text-xs text-gray-500">在求解前設定模擬開始的品質值</div>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={(e) => setSolverOptions((p:any)=>({...p, initialQualityEnabled: e.target.checked}))} />
        </label>
      </div>
      {enabled && (
        <div className="mt-2 flex items-center gap-2">
          <input type="number" value={value} onChange={(e)=>setSolverOptions((p:any)=>({...p, initialQuality: Number(e.target.value)}))} className="px-2 py-1 border rounded w-28" />
          <div className="text-xs text-gray-500">品質值 (0 - 使用配方最大值)</div>
        </div>
      )}
    </div>
  );
}
