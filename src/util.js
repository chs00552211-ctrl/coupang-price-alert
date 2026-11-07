export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export async function fetchText(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} - ${url}`);
  return res.text();
}

/** "11,900원", "1.2만원", "83만원" 같은 글자를 숫자로 바꿔요. 못 찾으면 null. */
export function parseWon(text) {
  if (!text) return null;
  const man = text.match(/(\d+(?:\.\d+)?)\s*만\s*(\d{1,4})?\s*원/);
  if (man) return Math.round(parseFloat(man[1]) * 10000 + (man[2] ? parseInt(man[2], 10) : 0));
  const won = text.match(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/);
  if (won) return parseInt(won[1].replace(/,/g, ''), 10);
  return null;
}

/** 핫딜 글 제목 끝의 "(13,680원/무료)"에서 판매가를 꺼내요. */
export function priceFromTitle(title) {
  const groups = [...title.matchAll(/\(([^()]*)\)/g)].map((m) => m[1]);
  for (let i = groups.length - 1; i >= 0; i--) {
    const p = parseWon(groups[i]);
    if (p) return p;
  }
  // "(2,252,600/0)"처럼 "원" 없이 숫자만 쓴 경우
  for (let i = groups.length - 1; i >= 0; i--) {
    const m = groups[i].match(/^\s*(\d{1,3}(?:,\d{3})+|\d{3,})\s*(?:\/|$)/);
    if (m) return parseInt(m[1].replace(/,/g, ''), 10);
  }
  return parseWon(title);
}

/** 글 내용에 "정가 2,399,000원" 같은 원래 가격이 적혀 있으면 꺼내요. */
export function originalFromText(text) {
  if (!text) return null;
  const m = text.match(/(정가|원가|정상가|기존가|기존 가격|원래 가격|원래가|평소가|평소 가격|출고가)\s*[:：은는이가]?\s*([\d,.]+\s*만?\s*\d*\s*원)/);
  return m ? parseWon(m[2]) : null;
}

export const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;

export function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** HTML 안에서 쿠팡 상품 링크를 찾아요 (주소가 인코딩돼 있어도 찾아요). */
export function findCoupangUrl(html) {
  const text = decodeEntities(html);
  const candidates = [text];
  for (const m of text.matchAll(/[?&](?:ol|url|target|u)=([^&"'\s<>]+)/g)) {
    try { candidates.push(decodeURIComponent(m[1])); } catch {}
  }
  for (const c of candidates) {
    const m = c.match(/https?:\/\/(?:www\.|m\.)?coupang\.com\/vp\/products\/\d+[^\s"'<>]*/);
    if (m) return cleanCoupangUrl(m[0]);
  }
  for (const c of candidates) {
    const m = c.match(/https?:\/\/link\.coupang\.com\/[^\s"'<>]+/);
    if (m) return m[0];
  }
  return null;
}

export function coupangProductId(url) {
  const m = url && url.match(/\/vp\/products\/(\d+)/);
  return m ? m[1] : null;
}

/** 추적용 꼬리표를 떼고 상품 번호만 남긴 깔끔한 링크로 바꿔요. */
export function cleanCoupangUrl(url) {
  try {
    const u = new URL(url);
    const id = coupangProductId(u.pathname);
    if (!id) return url;
    const keep = new URLSearchParams();
    for (const k of ['itemId', 'vendorItemId']) if (u.searchParams.get(k)) keep.set(k, u.searchParams.get(k));
    const q = keep.toString();
    return `https://www.coupang.com/vp/products/${id}${q ? `?${q}` : ''}`;
  } catch {
    return url;
  }
}

export function coupangSearchUrl(name) {
  return `https://www.coupang.com/np/search?q=${encodeURIComponent(name)}`;
}
