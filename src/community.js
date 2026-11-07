import { classify } from './classify.js';
import { naverReferencePrice } from './naver.js';
import {
  fetchText, decodeEntities, priceFromTitle, originalFromText, findCoupangUrl,
  coupangProductId, coupangSearchUrl, median,
} from './util.js';

// 핫딜 커뮤니티 RSS에서 쿠팡 글을 찾아 가격 오류 의심 글만 골라내요.

export function parseRss(xml) {
  return xml.split(/<item[\s>]/).slice(1).map((chunk) => {
    const get = (tag) => {
      const m = chunk.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return m ? decodeEntities(m[1]).trim() : '';
    };
    return {
      title: get('title'),
      link: get('link'),
      description: get('description').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      category: get('category'),
    };
  });
}

export function isCoupangPost(item) {
  return /쿠팡|coupang|로켓배송/i.test(item.title) || /coupang\.com/i.test(item.description);
}

/** 제목에서 "[쿠팡]" 머리말과 끝의 "(가격/배송)" 부분을 떼어 상품 이름만 남겨요. */
export function productNameFromTitle(title) {
  return title
    .replace(/^\s*\[[^\]]*\]\s*/, '')
    .replace(/^\s*\(?쿠팡\)\s*/, '')
    .replace(/\s*\([^()]*\)\s*$/, '')
    .trim() || title;
}

function postBodyText(html) {
  const i = html.search(/view_content|board_main_view|class="?(?:article|content)/);
  const part = i >= 0 ? html.slice(i, i + 8000) : html.slice(0, 8000);
  return decodeEntities(part.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
}

/**
 * @returns {Promise<{alerts: object[], errors: string[]}>}
 */
export async function checkCommunity(cfg, state, { dropThreshold, minHistory, includeOld = false, naver = null }) {
  const alerts = [];
  const errors = [];
  const seen = new Set(state.seenPosts);

  for (const feed of cfg.feeds) {
    let items;
    try {
      items = parseRss(await fetchText(feed.url));
    } catch (e) {
      errors.push(`${feed.name}: ${e.message}`);
      continue;
    }
    // 처음 보는 피드는 지금 있는 글을 "이미 봄"으로만 기록해요 (옛날 글로 알림 폭탄 방지).
    const firstTime = !includeOld && !state.initializedFeeds.includes(feed.url);

    for (const item of items) {
      if (!item.link || seen.has(item.link)) continue;
      seen.add(item.link);
      state.seenPosts.push(item.link);
      if (firstTime || !isCoupangPost(item)) continue;

      const text = `${item.title} ${item.description}`;
      const keyword = cfg.errorKeywords.find((k) => text.includes(k));

      let coupangUrl = findCoupangUrl(item.description);
      let bodyText = '';
      if (feed.fetchPost && !coupangUrl) {
        try {
          const html = await fetchText(item.link);
          coupangUrl = findCoupangUrl(html);
          bodyText = postBodyText(html);
        } catch (e) {
          errors.push(`${feed.name} 글 읽기 실패: ${e.message}`);
        }
      }

      const name = productNameFromTitle(item.title);
      const currentPrice = priceFromTitle(item.title);

      // 원래 가격: 1) 우리가 기록해 둔 평소 가격 2) 글에 적힌 정가 3) 네이버 쇼핑 시세
      let originalPrice = null;
      let originalSource = null;
      let naverCategory = '';
      const hist = state.prices[coupangProductId(coupangUrl)]?.hist;
      if (hist && hist.length >= minHistory) {
        originalPrice = median(hist.map((h) => h.p));
        originalSource = '쿠팡 평소 가격';
      }
      if (!originalPrice) {
        originalPrice = originalFromText(item.description) || originalFromText(bodyText);
        if (originalPrice) originalSource = '글에 적힌 정가';
      }
      if (!originalPrice && naver) {
        try {
          const ref = await naverReferencePrice(name, naver);
          if (ref) {
            originalPrice = ref.price;
            originalSource = `네이버 쇼핑 시세, 비슷한 상품 ${ref.samples}개 기준`;
            naverCategory = ref.category;
          }
        } catch (e) {
          errors.push(e.message);
        }
      }

      const bigDrop = originalPrice && currentPrice && currentPrice <= originalPrice * (1 - dropThreshold);
      if (!keyword && !bigDrop && !cfg.alertAllCoupang) continue;

      const reasons = [];
      if (keyword) reasons.push(`글에 "${keyword}" 언급`);
      if (bigDrop) reasons.push(`원래 가격보다 ${Math.round((1 - currentPrice / originalPrice) * 100)}% 낮음`);

      alerts.push({
        key: `c:${item.link}`,
        name,
        theme: classify(name, item.category || naverCategory),
        currentPrice,
        originalPrice,
        originalSource,
        url: coupangUrl || coupangSearchUrl(name),
        isSearchLink: !coupangUrl,
        source: feed.name,
        sourceUrl: item.link,
        reason: reasons.join(', ') || '쿠팡 핫딜',
      });
    }
    if (firstTime) state.initializedFeeds.push(feed.url);
  }
  return { alerts, errors };
}
