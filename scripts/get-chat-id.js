// 사용법: 봇에게 텔레그램으로 아무 메시지나 보낸 뒤
//   TELEGRAM_BOT_TOKEN=... node scripts/get-chat-id.js
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN 환경변수를 먼저 넣어주세요.');
  process.exit(1);
}
const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
const body = await res.json();
if (!body.ok) {
  console.error('토큰이 맞는지 확인해 주세요:', body.description);
  process.exit(1);
}
const chats = new Map();
for (const u of body.result) {
  const c = (u.message || u.channel_post || u.my_chat_member)?.chat;
  if (c) chats.set(c.id, c.title || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username);
}
if (!chats.size) console.log('아직 받은 메시지가 없어요. 텔레그램에서 봇에게 아무 말이나 보낸 뒤 다시 실행해 주세요.');
for (const [id, name] of chats) console.log(`chat_id: ${id}   (${name})`);
