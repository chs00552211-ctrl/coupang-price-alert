import fs from 'node:fs';
import path from 'node:path';

// 이미 본 글, 가격 기록 같은 걸 state/state.json 에 저장해요.
// GitHub Actions 가 실행 후 이 파일을 커밋해서 다음 실행 때 이어서 써요.

export const STATE_FILE = path.resolve('state/state.json');

const MAX_SEEN = 1000;
const MAX_HISTORY = 48;
const FORGET_AFTER_MS = 14 * 24 * 3600 * 1000;

export function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return { seenPosts: [], alerted: [], prices: {}, lastPartnersRun: 0, initializedFeeds: [], ...s };
  } catch {
    return { seenPosts: [], alerted: [], prices: {}, lastPartnersRun: 0, initializedFeeds: [] };
  }
}

export function saveState(state) {
  state.seenPosts = state.seenPosts.slice(-MAX_SEEN);
  state.alerted = state.alerted.slice(-MAX_SEEN);
  const now = Date.now();
  for (const [id, p] of Object.entries(state.prices)) {
    p.hist = p.hist.slice(-MAX_HISTORY);
    if (!p.hist.length || now - p.hist[p.hist.length - 1].t > FORGET_AFTER_MS) delete state.prices[id];
  }
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 1) + '\n');
}
