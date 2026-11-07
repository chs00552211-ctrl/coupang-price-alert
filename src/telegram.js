import { won } from './util.js';

const THEME_ICON = { IT: '💻', 식품: '🍜', 기타: '📦' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * 알림 하나를 텔레그램 메시지(HTML)로 만들어요.
 * alert = { name, theme, currentPrice, originalPrice, url, isSearchLink, source, sourceUrl, reason }
 */
export function formatAlert(a) {
  const lines = ['🚨 <b>쿠팡 가격 오류 의심</b>', ''];
  lines.push(`${THEME_ICON[a.theme] || '📦'} 테마: <b>${esc(a.theme)}</b>`);
  lines.push(`🛒 상품: ${esc(a.name)}`);
  lines.push(`💰 원래 가격: ${a.originalPrice ? `<s>${won(a.originalPrice)}</s>` : '확인 안 됨'}`);
  if (a.currentPrice) {
    const off = a.originalPrice && a.originalPrice > a.currentPrice
      ? ` (${Math.round((1 - a.currentPrice / a.originalPrice) * 100)}% ↓)`
      : '';
    lines.push(`🔥 현재 가격: <b>${won(a.currentPrice)}</b>${off}`);
  } else {
    lines.push('🔥 현재 가격: 확인 안 됨');
  }
  if (a.reason) lines.push(`📝 근거: ${esc(a.reason)}`);
  lines.push('');
  lines.push(`🔗 <a href="${esc(a.url)}">${a.isSearchLink ? '쿠팡에서 검색하기' : '쿠팡 상품 보기'}</a>`);
  lines.push(esc(a.url));
  if (a.sourceUrl) lines.push(`📰 출처: <a href="${esc(a.sourceUrl)}">${esc(a.source)}</a>`);
  else if (a.source) lines.push(`📰 출처: ${esc(a.source)}`);
  return lines.join('\n');
}

export async function sendTelegram(text, { token, chatId }) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: false }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => ({}));
  if (!body.ok) throw new Error(`텔레그램 전송 실패: ${body.description || res.status}`);
}
