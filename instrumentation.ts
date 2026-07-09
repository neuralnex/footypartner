
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { ensureDatabase } = await import('./lib/db/pool');
      await ensureDatabase();
    } catch (err) {
      console.error('[instrumentation] Database init failed:', err);
    }

    try {
      const { getCustodian } = await import('./lib/txline/singleton');
      await getCustodian();
      console.log('[instrumentation] TxLINE custodian pipeline warmed up.');
    } catch (err) {
      console.error(
        '[instrumentation] Custodian warm-up failed — will retry lazily on first request:',
        err
      );
    }
  }
}
