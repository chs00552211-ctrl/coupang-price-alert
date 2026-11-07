import { median } from './util.js';

// 네이버 쇼핑 검색 API로 같은 상품의 다른 쇼핑몰 가격(시세)을 찾아요.
// 키 발급: https://developers.naver.com (애플리케이션 등록 > 검색 API)

const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"');

const words = (s) =>
  stripTags(s).toLowerCase().replace(/[^\p{L}\p{N}.]+/gu, ' ').split(' ').filter((w) => w.length >= 2);

/** "36개", "250ml", "256GB" 같은 수량·용량 표기. 이게 다르면 다른 상품으로 봐요. */
const quantities = (s) =>
  [...stripTags(s).toLowerCase().matchAll(/(\d+(?:\.\d+)?)\s*(개입|개|팩|병|캔|봉|입|매|ml|l|g|kg|gb|tb|인치|구)(?![a-z])/gu)]
    .map((m) => m[1] + m[2]);

/**
 * 검색 결과 중 이름이 충분히 비슷하고 수량이 같은 상품만 골라 가격 중간값을 돌려줘요.
 * 비슷한 상품이 3개 미만이면 믿을 수 없어서 null.
 */
export function referencePrice(name, items) {
  const want = words(name);
  const qty = quantities(name);
  const prices = [];
  let category = '';
  for (const it of items) {
    if (/쿠팡/.test(it.mallName || '')) continue; // 오류 난 가격이 섞이지 않게
    const title = stripTags(it.title);
    const have = new Set(words(title));
    const overlap = want.filter((w) => have.has(w)).length / (want.length || 1);
    if (overlap < 0.5) continue;
    const q = new Set(quantities(title));
    if (qty.some((x) => !q.has(x))) continue;
    const p = Number(it.lprice);
    if (p > 0) {
      prices.push(p);
      category ||= [it.category1, it.category2].filter(Boolean).join(' ');
    }
  }
  if (prices.length < 3) return null;
  return { price: Math.round(median(prices)), samples: prices.length, category };
}

export async function naverReferencePrice(name, keys) {
  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(name)}&display=30&sort=sim`;
  const res = await fetch(url, {
    headers: { 'X-Naver-Client-Id': keys.clientId, 'X-Naver-Client-Secret': keys.clientSecret },
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`네이버 쇼핑 API 오류 ${res.status} ${body.errorMessage || ''}`);
  return referencePrice(name, body.items || []);
}
