// 알림이 어떻게 오는지 샘플 메시지를 하나 보내봐요.
//   TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... node scripts/test-message.js
import { formatAlert, sendTelegram } from '../src/telegram.js';

const text = formatAlert({
  name: '[테스트] Apple 아이패드 프로 13 M5 Wi-Fi 256GB',
  theme: 'IT',
  currentPrice: 830000,
  originalPrice: 2399000,
  originalSource: '네이버 쇼핑 시세, 비슷한 상품 12개 기준',
  url: 'https://www.coupang.com/vp/products/0000000000',
  source: '테스트 메시지',
  reason: '알림 형식 확인용 샘플이에요',
});

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
if (!token || !chatId) {
  console.log('환경변수가 없어서 화면에만 보여줄게요:\n\n' + text);
} else {
  await sendTelegram(text, { token, chatId });
  console.log('텔레그램으로 테스트 메시지를 보냈어요.');
}
