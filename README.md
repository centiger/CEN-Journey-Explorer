# CEN Journey Explorer Engine v1.0

## 포함 기능
- 홈 / 구약 / 신약 / 전체 여정
- journeys.json 자동 목록 생성
- 개별 Journey JSON 로딩
- places-master.json 장소명 연결
- place-map-links-master.json 지도 연결
- 사건 요약 / 대표 성경구절
- 이전 장소 / 다음 장소 / 완료 화면
- PWA 설치 및 오프라인 캐시
- 모바일 반응형 UI

## 테스트
`J000-engine-demo.json`은 엔진 점검용 샘플입니다.
엔진 검수 후 삭제하고 `data/journeys.json`에서도 J000 항목을 제거하면 됩니다.

## 새 여정 추가
1. `journeys/OT/` 또는 `journeys/NT/`에 JSON 파일 추가
2. `data/journeys.json`에 목록 정보 추가
3. service-worker.js의 CACHE 이름을 올리고 새 JSON 경로를 CORE에 추가

## 중요
브라우저 보안 정책 때문에 index.html을 파일로 직접 열면 JSON 로딩이 실패할 수 있습니다.
GitHub Pages 또는 로컬 웹서버에서 실행하세요.


## v1.1 성경읽기 연결
Journey의 `말씀 보기`는 다음 주소 형식으로 CEN Bible 2.0을 엽니다.

`https://centiger.github.io/CEN-Bible2.0/?ref=창세기%2012:1~4&source=journey`

정확한 장·절로 자동 이동하려면 CEN-Bible2.0 저장소에도 `journey-deeplink.js`를 업로드하고,
`index.html`의 `</body>` 직전에 다음 한 줄을 추가해야 합니다.

```html
<script src="./journey-deeplink.js"></script>
```
