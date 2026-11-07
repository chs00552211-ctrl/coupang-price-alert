import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../src/classify.js';
import { parseWon, priceFromTitle, originalFromText, findCoupangUrl, median } from '../src/util.js';
import { parseRss, isCoupangPost, productNameFromTitle } from '../src/community.js';
import { formatAlert } from '../src/telegram.js';
import { authorization } from '../src/partners.js';

test('가격 글자 읽기', () => {
  assert.equal(parseWon('11,900원'), 11900);
  assert.equal(parseWon('83만원'), 830000);
  assert.equal(parseWon('1.2만원'), 12000);
  assert.equal(priceFromTitle('[쿠팡] 미에로화이바 250ml 30개 (13,680원)'), 13680);
  assert.equal(priceFromTitle('[쿠팡] 육개장 사발면 36개 (5,040원/무료)'), 5040);
  assert.equal(priceFromTitle('쿠팡)애즈락 인텔 아크 B70(2,252,600/0)'), 2252600);
  assert.equal(productNameFromTitle('쿠팡)애즈락 인텔 아크 B70(2,252,600/0)'), '애즈락 인텔 아크 B70');
  assert.equal(originalFromText('정가 2,399,000원인데 83만원에 떴어요'), 2399000);
  assert.equal(originalFromText('원래 가격: 32,000원'), 32000);
  assert.equal(median([3, 1, 2]), 2);
});

test('테마 나누기', () => {
  assert.equal(classify('Apple 아이패드 프로 13 M5'), 'IT');
  assert.equal(classify('농심 육개장 사발면 86g 36개'), '식품');
  assert.equal(classify('코코볼 시리얼 300g'), '식품');
  assert.equal(classify('로지텍 MX Master 3S 마우스'), 'IT');
  assert.equal(classify('프로스펙스 폴라티 2장'), '기타');
  assert.equal(classify('아무 상품', '가전디지털'), 'IT');
  assert.equal(classify('아무 상품', '음식'), '식품');
});

test('쿠팡 링크 찾기 (루리웹 리다이렉트 포함)', () => {
  const html = '<a href="https://web.ruliweb.com/link.php?ol=https%3A%2F%2Fwww.coupang.com%2Fvp%2Fproducts%2F8275329188%3FitemId%3D23853308006%26traceid%3Dabc&bbs=1020">';
  assert.equal(findCoupangUrl(html), 'https://www.coupang.com/vp/products/8275329188?itemId=23853308006');
  assert.equal(findCoupangUrl('그냥 글'), null);
});

test('RSS 읽기', () => {
  const xml = `<rss><channel><item>
    <title>[쿠팡] 코코볼 10개 (322원/무료) 가격오류</title>
    <description><![CDATA[<img src="x.webp"> 정가 32,000원]]></description>
    <category>음식</category>
    <link>https://bbs.ruliweb.com/market/board/1020/read/1</link>
  </item></channel></rss>`;
  const [item] = parseRss(xml);
  assert.equal(item.title, '[쿠팡] 코코볼 10개 (322원/무료) 가격오류');
  assert.equal(item.category, '음식');
  assert.ok(isCoupangPost(item));
  assert.equal(item.description, '정가 32,000원');
  assert.equal(productNameFromTitle('[쿠팡] 미에로화이바 30개 (13,680원)'), '미에로화이바 30개');
});

test('텔레그램 메시지 모양', () => {
  const t = formatAlert({
    name: '아이패드 <프로>', theme: 'IT', currentPrice: 830000, originalPrice: 2399000,
    url: 'https://www.coupang.com/vp/products/1', source: '루리웹 핫딜', sourceUrl: 'https://x',
  });
  assert.match(t, /테마: <b>IT<\/b>/);
  assert.match(t, /<s>2,399,000원<\/s>/);
  assert.match(t, /830,000원<\/b> \(65% ↓\)/);
  assert.match(t, /아이패드 &lt;프로&gt;/);
  assert.match(t, /https:\/\/www\.coupang\.com\/vp\/products\/1/);
});

test('파트너스 서명 형식', () => {
  const a = authorization('GET', '/v2/x?keyword=a', 'AK', 'SK', new Date('2026-11-07T01:02:03Z'));
  assert.match(a, /^CEA algorithm=HmacSHA256, access-key=AK, signed-date=261107T010203Z, signature=[0-9a-f]{64}$/);
});
