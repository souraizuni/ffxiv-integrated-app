// ============================================
// 請求治理：節流、指數退避、取消
// ============================================
// 市場資料是唯一必須即時、且量體大的外部依賴（遊戲靜態資料已全部本地化）。
// Universalis 是免費服務，沒有節流會很容易被 429，而且使用者快速切換物品時
// 舊請求的結果可能比新請求晚回來，覆蓋掉正確的畫面（race condition）。

export interface RequestOptions {
  /** 由呼叫端提供的取消訊號 */
  signal?: AbortSignal;
  /** 最多重試次數（僅針對 429 / 5xx） */
  maxRetries?: number;
  /** 遇到速率限制時的回呼，可用來提示使用者 */
  onRateLimit?: (attempt: number, delayMs: number) => void;
}

export class RequestManager {
  private lastRequestAt = 0;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    /** 兩次請求之間的最小間隔 */
    private readonly minIntervalMs = 500,
    /** 首次重試的等待時間，之後指數成長 */
    private readonly baseRetryDelayMs = 2000,
    private readonly maxRetryDelayMs = 10_000
  ) {}

  private isRetryable(status: number): boolean {
    return status === 429 || (status >= 500 && status < 600);
  }

  private retryDelay(attempt: number): number {
    return Math.min(this.baseRetryDelayMs * 2 ** attempt, this.maxRetryDelayMs);
  }

  private async waitForSlot(signal?: AbortSignal): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    const wait = this.minIntervalMs - elapsed;
    if (wait > 0) await sleep(wait, signal);
    this.lastRequestAt = Date.now();
  }

  /**
   * 送出一個受管控的請求。
   * 所有請求會排成一列依序取得發送許可，確保最小間隔真的被遵守
   * （若各自獨立檢查時間戳，並發呼叫會同時通過檢查而一起送出）。
   */
  async request<T>(
    task: (signal?: AbortSignal) => Promise<T>,
    options: RequestOptions = {}
  ): Promise<T> {
    const { signal, maxRetries = 3, onRateLimit } = options;

    const run = async (): Promise<T> => {
      throwIfAborted(signal);

      let lastError: unknown;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        throwIfAborted(signal);
        await this.waitForSlot(signal);

        try {
          return await task(signal);
        } catch (error) {
          if (isAbortError(error) || signal?.aborted) throw error;

          lastError = error;

          const status = (error as { status?: number }).status;
          if (status !== undefined && this.isRetryable(status) && attempt < maxRetries) {
            const delay = this.retryDelay(attempt);
            onRateLimit?.(attempt, delay);
            await sleep(delay, signal);
            continue;
          }

          throw error;
        }
      }

      throw lastError;
    };

    // 串接到佇列尾端；前一個請求失敗不該卡住後面的
    const chained = this.queue.then(run, run);
    this.queue = chained.then(
      () => undefined,
      () => undefined
    );

    return chained;
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(abortError());
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function abortError(): Error {
  const error = new Error('請求已取消');
  error.name = 'AbortError';
  return error;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

/**
 * 包裝 fetch，把非 2xx 轉成帶 status 的錯誤，
 * 讓 RequestManager 能判斷是否值得重試。
 */
export async function fetchWithStatus(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal });

  if (!res.ok) {
    const error = new Error(`請求失敗 ${res.status}: ${url}`) as Error & { status: number };
    error.status = res.status;
    throw error;
  }

  return res.json();
}
