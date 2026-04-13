# 프로젝트 로드맵 (Project Roadmap)

Skyhigh SWG 정책 분석 엔진 및 시각화 도구의 단계별 목표와 진행 상황입니다.

## Phase 1: 파싱 엔진 및 데이터 정규화 (완료)
- [x] 핵심 파서 개발 (Policy, Condition, Lists, Metadata).
- [x] 복잡한 조건식의 문자열 변환(Stringifier) 로직 구현.
- [x] XML의 모든 기술적 속성(ACElements, CloudSynced 등) 추출 보장.

## Phase 2: 시각화 및 대용량 최적화 (완료)
- [x] 내장 SQLite DB 연동 및 5개 정책 세트 이력 관리.
- [x] 서버사이드 지연 로딩(Lazy Loading) 및 검색 기능.
- [x] macOS Finder 스타일(Miller Columns) UI 구현.
- [x] 에어갭 환경을 위한 종속성 제거 (Vanilla JS/CSS).

## Phase 3: 정책 분석 고도화 (진행 예정)
- [ ] **정책 비교 엔진 (Diff Analysis)**: 두 시점의 정책 파일을 비교하여 추가/삭제/수정된 Rule 식별.
- [ ] **객체 추적기 (Object Explorer)**: 정책 조건에서 참조하는 List를 클릭 시 해당 리스트의 실제 내용(IP/URL) 팝업 표시.
- [ ] **엑셀 내보내기 개선**: DB에 저장된 특정 정책 세트를 다시 계단식 엑셀 파일로 출력하는 기능.
- [ ] **UI 인터랙션 개선**: 검색 결과 클릭 시 해당 노드로 자동 트리 이동 및 하위 경로 펼치기.
