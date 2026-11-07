# 쿠팡 가격 오류 텔레그램 알림

쿠팡에서 가격이 비정상적으로 낮은 상품을 찾아 텔레그램으로 알려줘요.
GitHub Actions에서 10분마다 자동으로 돌아가요. PC를 꺼도 괜찮아요.

## 어떻게 찾나요

1. **핫딜 커뮤니티 (뽐뿌, 루리웹 핫딜)**
   새로 올라온 쿠팡 글 중에서 "가격오류", "오류", "버그" 같은 말이 있거나, 원래 가격보다 50% 넘게 싼 글을 골라요.
   루리웹 글은 본문에서 쿠팡 상품 링크를 꺼내요. 뽐뿌는 본문 접근이 막혀 있어서 쿠팡 검색 링크를 붙여요.
2. **쿠팡 파트너스 API**
   IT(가전디지털)·식품 베스트 상품, 골드박스, 지정한 키워드 상품의 가격을 30분마다 기록해요.
   지금 가격이 평소 가격(최근 기록의 중간값)보다 50% 넘게 떨어지면 알려줘요.
   평소 가격을 알려면 기록이 3번 이상 쌓여야 해서, 처음 1~2시간 동안은 이 방식의 알림이 오지 않아요.

## 알림 예시

```
🚨 쿠팡 가격 오류 의심

💻 테마: IT
🛒 상품: Apple 아이패드 프로 13 M5 Wi-Fi 256GB
💰 원래 가격: 2,399,000원
🔥 현재 가격: 830,000원 (65% ↓)
📝 근거: 최근 6번 기록한 평소 가격보다 65% 낮음

🔗 쿠팡 상품 보기
https://www.coupang.com/vp/products/...
📰 출처: 쿠팡 파트너스 API 가격 추적
```

## 설치 순서

### 1. 텔레그램 봇 만들기
1. 텔레그램에서 **@BotFather**를 찾아 `/newbot`을 보내고 안내대로 이름을 정해요.
2. 받은 **토큰**(`123456:ABC...` 모양)을 적어 둬요.
3. 방금 만든 봇과 대화를 열고 아무 메시지나 보내요.
4. 이 폴더에서 아래 명령으로 **chat_id**를 확인해요 (PowerShell 기준).
   ```powershell
   $env:TELEGRAM_BOT_TOKEN="받은토큰"; npm run chat-id
   ```

### 2. 쿠팡 파트너스 키 받기 (선택)
파트너스 API 키가 없어도 커뮤니티 감시는 동작해요.
1. https://partners.coupang.com 에 가입해요.
2. 최종 승인을 받은 뒤 **추가 기능 > 오픈 API**에서 Access Key와 Secret Key를 받아요.

### 3. GitHub에 올리기
1. GitHub에서 새 저장소를 만들어요. **Public**으로 만들어야 Actions가 무제한 무료예요.
   (Private은 한 달 2,000분까지 무료라서 10분 간격이면 모자라요. Private으로 하려면 `watch.yml`의 간격을 `*/30`으로 바꿔요.)
   비밀 값은 아래 Secrets에 들어가서 Public이어도 공개되지 않아요.
2. 이 폴더의 파일을 전부 올려요.
3. 저장소의 **Settings > Secrets and variables > Actions > New repository secret**에서 다음 값을 넣어요.

   | 이름 | 값 |
   |---|---|
   | `TELEGRAM_BOT_TOKEN` | 봇 토큰 |
   | `TELEGRAM_CHAT_ID` | chat_id |
   | `COUPANG_ACCESS_KEY` | 파트너스 Access Key (선택) |
   | `COUPANG_SECRET_KEY` | 파트너스 Secret Key (선택) |

4. **Actions** 탭에서 워크플로를 켜고, "쿠팡 가격 오류 감시" > **Run workflow**로 한 번 실행해 봐요.
   첫 실행은 지금 있는 글을 기록만 하고 알림은 보내지 않아요. 그다음부터 새 글을 알려줘요.

## 설정 바꾸기 (`config.json`)

| 항목 | 뜻 |
|---|---|
| `dropThreshold` | 얼마나 싸면 알릴지. `0.5` = 원래 가격보다 50% 이상 쌀 때 |
| `minHistory` | 평소 가격을 계산하기 전에 필요한 최소 기록 수 |
| `partners.intervalMinutes` | 파트너스 API를 몇 분마다 부를지 |
| `partners.categories` | 감시할 쿠팡 카테고리 번호와 테마 (`1016` 가전디지털, `1012` 식품) |
| `partners.keywords` | 따로 감시할 검색어 |
| `community.errorKeywords` | 커뮤니티 글에서 찾을 단어 |
| `community.alertAllCoupang` | `true`로 바꾸면 쿠팡 핫딜 글을 전부 알려줘요 |

**파트너스 API 호출 한도 주의:** 한 시간에 30번 넘게 부르면 24시간 정지된다는 안내가 있어요 (공식 문서로는 확인하지 못했어요).
기본 설정은 한 번에 8번(카테고리 2 + 골드박스 1 + 키워드 5) × 30분마다 = **시간당 16번**이에요.
카테고리나 키워드를 늘리면 `intervalMinutes`도 함께 늘려 주세요.

## 내 PC에서 테스트하기

```powershell
npm test                            # 자체 테스트
npm run test-message                # 알림 모양 미리보기 (토큰을 넣으면 실제 전송)
node src/index.js --dry-run --include-old   # 지금 피드로 실제 검사, 전송은 안 함
```

## 알아둘 점
- 가격 오류 주문은 판매자나 쿠팡이 취소할 수 있어요.
- 쿠팡 사이트를 직접 긁어오지 않아요 (이용약관 위반이고 차단돼요). 공식 API와 커뮤니티 RSS만 써요.
- GitHub 예약 실행은 몇 분씩 늦어질 수 있어요.
- `state/state.json`은 본 글과 가격 기록이에요. Actions가 자동으로 커밋해요.
