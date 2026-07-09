
import { TxLineCustodianEngine } from './custodian';

const REFRESH_INTERVAL_MS = 20 * 60 * 1000;

declare global {

  var __txlineCustodian: TxLineCustodianEngine | undefined;

  var __txlineBootPromise: Promise<void> | undefined;

  var __txlineRefreshTimer: ReturnType<typeof setInterval> | undefined;
}

export async function getCustodian(): Promise<TxLineCustodianEngine> {
  if (!globalThis.__txlineCustodian) {
    globalThis.__txlineCustodian = new TxLineCustodianEngine();
  }

  if (!globalThis.__txlineBootPromise) {
    globalThis.__txlineBootPromise = globalThis.__txlineCustodian
      .bootCustodianPipeline()
      .then(() => {
        startRefreshTimer();
      });
  }

  await globalThis.__txlineBootPromise;
  return globalThis.__txlineCustodian;
}

function startRefreshTimer() {
  if (globalThis.__txlineRefreshTimer) return;
  globalThis.__txlineRefreshTimer = setInterval(async () => {
    try {
      await globalThis.__txlineCustodian?.refreshCredentials();
      console.log('[txline] credentials refreshed on schedule.');
    } catch (err) {
      console.error('[txline] scheduled refresh failed, will retry next interval:', err);
    }
  }, REFRESH_INTERVAL_MS);
}

export async function withFreshSession<T>(
  fn: (headers: Record<string, string>) => Promise<T>
): Promise<T> {
  const custodian = await getCustodian();
  try {
    return await fn(custodian.getSessionHeaders());
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      console.warn('[txline] session rejected, refreshing and retrying once...');
      await custodian.refreshCredentials();
      return fn(custodian.getSessionHeaders());
    }
    throw err;
  }
}
