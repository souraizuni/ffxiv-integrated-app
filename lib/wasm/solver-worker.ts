// ============================================
// 求解器 Web Worker
// 在背景執行緒執行 WASM 求解器，避免阻塞 UI
// ============================================

import type { WasmStatus, WasmAction } from './wasm-types';

// Worker 訊息類型
export interface SolverWorkerRequest {
  id: string;
  type: 'solve';
  solver: 'raphael' | 'rika' | 'dfs' | 'nq' | 'reflect';
  status: WasmStatus;
  options?: {
    targetQuality?: number | null;
    useManipulation?: boolean;
    useHeartAndSoul?: boolean;
    useQuickInnovation?: boolean;
    useTrainedEye?: boolean;
    backloadProgress?: boolean;
    adversarial?: boolean;
    depth?: number;
    specialist?: boolean;
    useObserve?: boolean;
  };
}

export interface SolverWorkerResponse {
  id: string;
  type: 'result' | 'error';
  actions?: WasmAction[];
  error?: string;
}

// Worker 內部程式碼
const workerCode = `
let wasm = null;
let wasmReady = false;

// 載入 WASM 模組
async function initWasm() {
  if (wasmReady) return;
  
  try {
    const wasmModule = await import('./app_wasm.js');
    await wasmModule.default();
    wasm = wasmModule;
    wasmReady = true;
    console.log('[SolverWorker] WASM 模組載入完成');
  } catch (error) {
    console.error('[SolverWorker] WASM 載入失敗:', error);
    throw error;
  }
}

// 執行求解
async function solve(request) {
  if (!wasmReady) {
    await initWasm();
  }
  
  const { solver, status, options = {} } = request;
  
  switch (solver) {
    case 'raphael':
      return wasm.raphael_solve(
        status,
        options.targetQuality ?? null,
        options.useManipulation ?? true,
        options.useHeartAndSoul ?? false,
        options.useQuickInnovation ?? false,
        options.useTrainedEye ?? false,
        options.backloadProgress ?? false,
        options.adversarial ?? false
      );
      
    case 'rika':
      return wasm.rika_solve(status);
      
    case 'dfs':
      return wasm.dfs_solve(
        status,
        options.depth ?? 20,
        options.specialist ?? false
      );
      
    case 'nq':
      return wasm.nq_solve(
        status,
        options.depth ?? 20,
        options.specialist ?? false
      );
      
    case 'reflect':
      return wasm.reflect_solve(
        status,
        options.useObserve ?? true
      );
      
    default:
      throw new Error('Unknown solver: ' + solver);
  }
}

// 處理訊息
self.onmessage = async (e) => {
  const request = e.data;
  
  try {
    const actions = await solve(request);
    self.postMessage({
      id: request.id,
      type: 'result',
      actions: actions
    });
  } catch (error) {
    self.postMessage({
      id: request.id,
      type: 'error',
      error: error.message || String(error)
    });
  }
};

// 初始化
initWasm().catch(err => {
  console.error('[SolverWorker] 初始化失敗:', err);
});
`;

/**
 * 建立 Worker Blob URL
 */
export function createSolverWorkerUrl(): string {
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}
