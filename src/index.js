import fs from 'node:fs';
import { loadState, saveState } from './state.js';
import { checkCommunity } from './community.js';
import { fetchPartnersProducts } from './partners.js';
import { formatAlert, sendTelegram } from './telegram.js';
import { median } from './util.js';

const config = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
const dryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';

const telegram = { token: process.env.TELEGRAM_BOT_TOKEN, chatId: process.env.TELEGRAM_CHAT_ID };
const partnersKeys = { accessKey: process.env.COUPANG_ACCESS_KEY, secretKey: process.env.COUPANG_SECRET_KEY };

if (!dryRun && (!telegram.token || !telegram.chatId)) {
  console.error('TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID 환경변수가 필요해요. (테스트만 하려면 --dry-run)');
  process.exit(1);
}

const state = loadState();
// --include-old: 피드에 지금 올라와 있는 글도 검사해요 (테스트용)
const opts = {
  dropThreshold: config.dropThreshold,
  minHistory: config.minHistory,
  includeOld: process.argv.includes('--include-old'),
  naver: process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET
    ? { clientId: process.env.NAVER_CLIENT_ID, clientSecret: process.env.NAVER_CLIENT_SECRET }
    : null,
};
if (!opts.naver) console.log('네이버 쇼핑 키가 없어서 시세 조회는 건너뛰어요.');
const alerts = [];
const errors = [];

// 1) 핫딜 커뮤니티
{
  const r = await checkCommunity(config.community, state, opts);
  alerts.push(...r.alerts);
  errors.push(...r.errors);
}

// 2) 쿠팡 파트너스 API (호출 한도 때문에 intervalMinutes 마다 한 번만)
const hasKeys = partnersKeys.accessKey && partnersKeys.secretKey;
const due = Date.now() - state.lastPartnersRun >= (config.partners.intervalMinutes || 30) * 60 * 1000;
if (hasKeys && (due || process.env.FORCE_PARTNERS === '1')) {
  const r = await fetchPartnersProducts(config.partners, partnersKeys);
  state.lastPartnersRun = Date.now();
  errors.push(...r.errors);
  console.log(`파트너스 API: 호출 ${r.calls}번, 상품 ${r.products.length}개`);

  for (const p of r.products) {
    const rec = (state.prices[p.id] ||= { name: p.name, hist: [] });
    rec.name = p.name;
    const baseline = rec.hist.length >= config.minHistory ? median(rec.hist.map((h) => h.p)) : null;
    rec.hist.push({ p: p.price, t: Date.now() });

    if (baseline && p.price <= baseline * (1 - config.dropThreshold)) {
      alerts.push({
        key: `p:${p.id}:${p.price}`,
        name: p.name,
        theme: p.theme,
        currentPrice: p.price,
        originalPrice: baseline,
        originalSource: '쿠팡 평소 가격',
        url: p.url,
        source: '쿠팡 파트너스 API 가격 추적',
        reason: `최근 ${rec.hist.length - 1}번 기록한 평소 가격보다 ${Math.round((1 - p.price / baseline) * 100)}% 낮음`,
      });
    }
  }
} else if (!hasKeys) {
  console.log('쿠팡 파트너스 키가 없어서 API 가격 추적은 건너뛰어요.');
}

// 3) 알림 보내기 (같은 알림은 한 번만)
const alerted = new Set(state.alerted);
let sent = 0;
for (const a of alerts) {
  if (alerted.has(a.key)) continue;
  const text = formatAlert(a);
  if (dryRun) {
    console.log('\n----- [보낼 메시지] -----\n' + text);
  } else {
    try {
      await sendTelegram(text, telegram);
    } catch (e) {
      errors.push(e.message);
      continue; // 다음 실행 때 다시 시도
    }
  }
  alerted.add(a.key);
  state.alerted.push(a.key);
  sent++;
}

if (!dryRun) saveState(state);
for (const e of errors) console.warn('⚠️ ', e);
console.log(`완료: 알림 ${sent}개${dryRun ? ' (dry-run, 실제 전송·저장 안 함)' : ''}`);
