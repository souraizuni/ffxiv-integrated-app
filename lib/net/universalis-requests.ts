// ============================================
// Universalis 專用的共用請求佇列
// ============================================
// 必須是單一實例：市場掃描器與需求清單／成本計算器可能同時發出請求，
// 各自持有 RequestManager 的話兩邊都以為自己遵守了間隔，實際發出的速率會是兩倍。

import { RequestManager } from './request-manager';

// 間隔取捨：
//   Universalis 是免費服務，先前完全沒有節流，大範圍掃描很容易被擋。
//   但間隔設太長，批次掃描的代價會很可觀 —— 掃 5,000 個物品是 50 批 × 2 次請求，
//   若用 500ms 就是純等待 50 秒。200ms（約 5 req/s）在「不打擾服務」與
//   「掃描仍在可接受時間內完成」之間取得平衡。
const MIN_INTERVAL_MS = 200;

export const universalisRequests = new RequestManager(MIN_INTERVAL_MS);
