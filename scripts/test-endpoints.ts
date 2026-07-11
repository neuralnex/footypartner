/**
 * Smoke-test all API routes. Expects no live games — live endpoints may return [].
 * Run: npx tsx scripts/test-endpoints.ts
 */
const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const EPOCH_DAY = 20641; // Jul 7 2026 — has finished fixtures

type Result = { name: string; ok: boolean; status: number; detail: string };

async function req(
  name: string,
  path: string,
  opts: { method?: string; body?: unknown; expect?: (s: number, j: unknown) => boolean; detail?: (j: unknown) => string } = {}
): Promise<Result> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let json: unknown;
    const text = await res.text();
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    const ok = opts.expect ? opts.expect(res.status, json) : res.ok;
    const detail = opts.detail ? opts.detail(json) : `${res.status} ${String(text).slice(0, 80)}`;
    return { name, ok, status: res.status, detail };
  } catch (err) {
    return { name, ok: false, status: 0, detail: String(err) };
  }
}

async function sseSmoke(name: string, path: string, timeoutMs = 12000): Promise<Result> {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const res = await fetch(`${BASE}${path}`, { signal: ac.signal });
    clearTimeout(timer);
    if (!res.ok) {
      return { name, ok: false, status: res.status, detail: `HTTP ${res.status}` };
    }
    const reader = res.body!.getReader();
    let buf = '';
    const ac2 = new AbortController();
    setTimeout(() => ac2.abort(), timeoutMs);
    try {
      for (let i = 0; i < 40; i++) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += new TextDecoder().decode(value);
        if (buf.includes('event:')) break;
      }
    } catch {
      // timeout ok if we got events
    }
    const events = [...buf.matchAll(/^event: (\w+)/gm)].map((m) => m[1]);
    const ok = events.length > 0;
    return {
      name,
      ok,
      status: 200,
      detail: ok ? `events: ${[...new Set(events)].join(', ')}` : 'no SSE events in window',
    };
  } catch (err) {
    return { name, ok: false, status: 0, detail: String(err) };
  }
}

async function main() {
  console.log(`Testing ${BASE} (epochDay=${EPOCH_DAY}, no live games expected)\n`);

  const boardRes = await fetch(`${BASE}/api/fixtures/board?epochDay=${EPOCH_DAY}`);
  const board = (await boardRes.json()) as Array<{
    FixtureId: number;
    homeTeam: string;
    awayTeam: string;
    status: string;
    StartTime: number;
  }>;

  if (!Array.isArray(board) || board.length === 0) {
    console.error('No fixtures on board — cannot run fixture-scoped tests');
    process.exit(1);
  }

  const finished = board.find((f) => f.status === 'finished') ?? board[0];
  const id = finished.FixtureId;
  const home = encodeURIComponent(finished.homeTeam);
  const away = encodeURIComponent(finished.awayTeam);
  const startTime = finished.StartTime;

  console.log(`Sample fixture: #${id} ${finished.homeTeam} vs ${finished.awayTeam} (${finished.status})\n`);

  const results: Result[] = [];

  results.push(
    await req('GET /api/health', '/api/health', {
      expect: (s, j) => s === 200 && typeof j === 'object' && j !== null && 'status' in (j as object),
      detail: (j) => JSON.stringify(j),
    })
  );

  results.push(
    await req('GET /api/fixtures/board', `/api/fixtures/board?epochDay=${EPOCH_DAY}`, {
      expect: (s, j) => s === 200 && Array.isArray(j) && (j as unknown[]).length > 0,
      detail: (j) => `${(j as unknown[]).length} fixtures`,
    })
  );

  results.push(
    await req('GET /api/fixtures', `/api/fixtures?epochDay=${EPOCH_DAY}`, {
      expect: (s, j) => s === 200 && Array.isArray(j),
      detail: (j) => `${(j as unknown[]).length} fixtures`,
    })
  );

  results.push(
    await req('GET /api/fixtures/live', `/api/fixtures/live?epochDay=${EPOCH_DAY}`, {
      expect: (s, j) => s === 200 && Array.isArray(j),
      detail: (j) => `${(j as unknown[]).length} live (expect 0)`,
    })
  );

  results.push(
    await req('GET /api/fixtures/[id]/match-data', `/api/fixtures/${id}/match-data?home=${home}&away=${away}&epochDay=${EPOCH_DAY}`, {
      expect: (s, j) => s === 200 && typeof j === 'object' && j !== null && 'status' in (j as object),
      detail: (j) => {
        const o = j as { status: string; source?: string; scoreHome?: number; history?: unknown[] };
        return `status=${o.status} source=${o.source} score=${o.scoreHome} history=${o.history?.length ?? 0}`;
      },
    })
  );

  results.push(
    await req('GET /api/fixtures/[id]/historical', `/api/fixtures/${id}/historical`, {
      expect: (s, j) => s === 200 && Array.isArray(j),
      detail: (j) => `${(j as unknown[]).length} events`,
    })
  );

  results.push(
    await req('GET /api/fixtures/[id]/snapshot', `/api/fixtures/${id}/snapshot`, {
      expect: (s, j) => s === 200 && Array.isArray(j),
      detail: (j) => `${(j as unknown[]).length} rows`,
    })
  );

  results.push(
    await req('GET /api/fixtures/[id]/scores', `/api/fixtures/${id}/scores`, {
      expect: (s, j) => s === 200,
      detail: (j) => (Array.isArray(j) ? `${j.length} scores` : JSON.stringify(j).slice(0, 60)),
    })
  );

  results.push(
    await req('GET /api/fixtures/[id]/odds', `/api/fixtures/${id}/odds`, {
      expect: (s) => s === 200 || s === 502,
      detail: (j) => JSON.stringify(j).slice(0, 100),
    })
  );

  results.push(
    await req('GET /api/fixtures/[id]/h2h', `/api/fixtures/${id}/h2h`, {
      expect: (s, j) => s === 200 && typeof j === 'object',
      detail: (j) => JSON.stringify(j),
    })
  );

  results.push(
    await req('GET /api/fixtures/[id]/narrative', `/api/fixtures/${id}/narrative`, {
      expect: (s, j) => s === 200 && typeof j === 'object' && j !== null && ('narrative' in (j as object) || 'error' in (j as object)),
      detail: (j) => {
        const o = j as { narrative?: { matchPulse?: string }; error?: string };
        return o.narrative?.matchPulse?.slice(0, 60) ?? o.error ?? JSON.stringify(j).slice(0, 60);
      },
    })
  );

  results.push(
    await req('GET /api/scores/snapshot', `/api/scores/snapshot?fixtureId=${id}`, {
      expect: (s, j) => s === 200 && Array.isArray(j),
      detail: (j) => `${(j as unknown[]).length} rows`,
    })
  );

  results.push(
    await req('GET /api/scores/historical', `/api/scores/historical?fixtureId=${id}`, {
      expect: (s, j) => s === 200 && Array.isArray(j),
      detail: (j) => `${(j as unknown[]).length} events`,
    })
  );

  results.push(
    await req('GET /api/scores/updates', `/api/scores/updates?fixtureId=${id}`, {
      expect: (s, j) => s === 200 && Array.isArray(j),
      detail: (j) => `${(j as unknown[]).length} updates`,
    })
  );

  // stat-validation needs seq from historical
  const histRes = await fetch(`${BASE}/api/scores/historical?fixtureId=${id}`);
  const hist = (await histRes.json()) as Array<{ seq?: number }>;
  const seq = hist.find((h) => typeof h.seq === 'number')?.seq ?? 0;
  if (seq > 0) {
    results.push(
      await req('GET /api/scores/stat-validation', `/api/scores/stat-validation?fixtureId=${id}&seq=${seq}`, {
        expect: (s) => s === 200 || s === 502,
        detail: (j) => JSON.stringify(j).slice(0, 80),
      })
    );
  }

  results.push(
    await req('GET /api/scores/updates/[day/hour/interval]', `/api/scores/updates/${EPOCH_DAY}/12/0`, {
      expect: (s, j) => s === 200 && Array.isArray(j),
      detail: (j) => `${(j as unknown[]).length} batch rows`,
    })
  );

  results.push(
    await req('POST /api/fixtures/[id]/chat', `/api/fixtures/${id}/chat`, {
      method: 'POST',
      body: { messages: [{ role: 'user', content: 'What was the final score?' }], homeTeam: finished.homeTeam, awayTeam: finished.awayTeam },
      expect: (s, j) => (s === 200 && typeof j === 'object' && j !== null && 'reply' in (j as object)) || s === 502,
      detail: (j) => {
        const o = j as { reply?: string; error?: string };
        return o.reply?.slice(0, 80) ?? o.error ?? JSON.stringify(j).slice(0, 80);
      },
    })
  );

  results.push(
    await sseSmoke(
      'GET /api/fixtures/[id]/stream (SSE)',
      `/api/fixtures/${id}/stream?home=${home}&away=${away}&startTime=${startTime}`
    )
  );

  // Validation endpoints
  results.push(
    await req('GET /api/fixtures/board (missing epochDay)', '/api/fixtures/board', {
      expect: (s) => s === 400,
      detail: () => '400 as expected',
    })
  );

  let pass = 0;
  let fail = 0;
  let warn = 0;

  for (const r of results) {
    const icon = r.ok ? '✓' : r.status === 502 && r.name.includes('chat') ? '⚠' : '✗';
    if (r.ok) pass++;
    else if (icon === '⚠') warn++;
    else fail++;
    console.log(`${icon} ${r.name}`);
    console.log(`    ${r.detail}`);
  }

  console.log(`\n=== ${pass} passed, ${fail} failed, ${warn} warnings ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
