import crypto from 'node:crypto';
import { classify } from './classify.js';
import { cleanCoupangUrl } from './util.js';

// 쿠팡 파트너스 공식 API로 상품 가격을 가져와요.
// 서명 방식: https://developers.coupangcorp.com (파트너스 > API 가이드)

const HOST = 'https://api-gateway.coupang.com';
const BASE = '/v2/providers/affiliate_open_api/apis/openapi/v1';

function signedDate(d = new Date()) {
  const iso = d.toISOString(); // 2026-11-07T14:21:05.000Z
  return `${iso.slice(2, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`;
}

export function authorization(method, pathWithQuery, accessKey, secretKey, date = new Date()) {
  const [path, query = ''] = pathWithQuery.split('?');
  const dt = signedDate(date);
  const signature = crypto.createHmac('sha256', secretKey).update(dt + method + path + query).digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${dt}, signature=${signature}`;
}

async function call(pathWithQuery, keys) {
  const res = await fetch(HOST + pathWithQuery, {
    headers: {
      Authorization: authorization('GET', pathWithQuery, keys.accessKey, keys.secretKey),
      'Content-Type': 'application/json;charset=UTF-8',
    },
    signal: AbortSignal.timeout(20000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || (body.rCode && body.rCode !== '0')) {
    throw new Error(`파트너스 API 오류 ${res.status} ${body.rCode || ''} ${body.rMessage || body.message || ''} - ${pathWithQuery.split('?')[0]}`);
  }
  const data = body.data;
  return Array.isArray(data) ? data : data?.productData || [];
}

function toProduct(raw, theme) {
  const id = String(raw.productId);
  return {
    id,
    name: raw.productName,
    price: Number(raw.productPrice),
    url: `https://www.coupang.com/vp/products/${id}`,
    affiliateUrl: raw.productUrl ? cleanCoupangUrl(raw.productUrl) : null,
    theme: theme || classify(raw.productName, raw.categoryName || ''),
  };
}

/**
 * 설정에 적힌 카테고리 베스트 / 골드박스 / 키워드 검색 결과를 모두 가져와요.
 * 실패한 호출은 건너뛰고 오류 메시지를 errors 에 모아요.
 */
export async function fetchPartnersProducts(cfg, keys) {
  const jobs = [];
  for (const [catId, theme] of Object.entries(cfg.categories || {})) {
    jobs.push({ path: `${BASE}/products/bestcategories/${catId}?limit=${cfg.categoryLimit || 50}`, theme });
  }
  if (cfg.goldbox) jobs.push({ path: `${BASE}/products/goldbox` });
  for (const kw of cfg.keywords || []) {
    jobs.push({ path: `${BASE}/products/search?keyword=${encodeURIComponent(kw)}&limit=${cfg.keywordLimit || 10}` });
  }

  const products = new Map();
  const errors = [];
  for (const job of jobs) {
    try {
      for (const raw of await call(job.path, keys)) {
        if (!raw?.productId || !raw.productPrice) continue;
        const p = toProduct(raw, job.theme);
        if (!products.has(p.id)) products.set(p.id, p);
      }
    } catch (e) {
      errors.push(e.message);
    }
  }
  return { products: [...products.values()], calls: jobs.length, errors };
}
