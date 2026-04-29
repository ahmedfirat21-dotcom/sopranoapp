/**
 * SopranoChat — Fetch Timeout Helper
 * ═══════════════════════════════════════════════════
 * JavaScript'in default fetch'i sonsuz bekleme yapar; kötü ağda hung
 * request UI'ı dondurur. Bu helper Promise.race + AbortController ile
 * timeout sınırı ekler.
 *
 * Kullanım:
 *   const res = await fetchWithTimeout('https://...', { method: 'POST' }, 10_000);
 */

export class FetchTimeoutError extends Error {
  constructor(url: string, ms: number) {
    super(`Fetch timeout (${ms}ms): ${url}`);
    this.name = 'FetchTimeoutError';
  }
}

/**
 * Timeout'lu fetch. AbortController ile gerçek socket cancel.
 * @param url       Endpoint
 * @param init      Standart RequestInit + opsiyonel signal
 * @param timeoutMs Default 15s — kritik akışlarda 10s, upload'da 30s+ kullan
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<Response> {
  // Caller signal vermişse onu birleştir; yoksa kendi controller
  const controller = new AbortController();
  const externalSignal = init.signal;
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new FetchTimeoutError(url, timeoutMs);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
