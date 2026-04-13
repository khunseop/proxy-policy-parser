# 사용자 가이드 (User Guide)

본 문서는 Skyhigh SWG Policy Parser의 주요 인터페이스인 CLI 및 웹 UI 사용 방법을 설명합니다.

## 1. 웹 UI (Web Explorer) 사용법

웹 UI는 정책의 계층 구조를 시각적으로 탐색하고 검색하는 데 최적화되어 있습니다.

### 1.1 정책 업로드 및 히스토리 관리
- **XML 업로드**: 우측 상단의 `XML 업로드` 버튼을 통해 Skyhigh 정책 파일을 업로드합니다. 업로드 즉시 서버에서 파싱되어 SQLite DB에 저장됩니다.
- **히스토리 선택**: 상단 드롭다운 메뉴에서 이전에 업로드한 정책(최대 5개)을 선택하여 전환할 수 있습니다.
- **이력 삭제 (`🗑️`)**: 현재 선택된 정책 세트를 DB에서 삭제합니다.
- **전체 초기화 (`🧹`)**: 저장된 모든 정책 히스토리를 초기화합니다.

### 1.2 정책 탐색 (Finder 모드)
- **컬럼 보기**: macOS Finder와 유사한 방식으로, 폴더(RuleGroup)를 클릭하면 우측에 하위 항목이 나타납니다.
- **상세 정보**: 특정 Rule이나 Group을 클릭하면 우측 끝의 `상세 정보` 패널에 조건식(Condition), 액션(Actions), 기술적 속성(ID, ACElements 등)이 표시됩니다.

### 1.3 검색
- **서버사이드 검색**: 상단 검색창에 키워드(Rule 이름, IP, URL 등)를 입력하고 `Enter`를 누르면 DB 전체를 검색하여 매칭되는 결과를 리스트로 보여줍니다.

---

## 2. CLI 사용법

CLI는 서버 구동 없이 터미널에서 즉시 파싱 결과를 파일로 추출할 때 유용합니다.

### 2.1 로컬 파일 파싱
로컬에 있는 XML 파일을 파싱하여 엑셀이나 JSON으로 저장합니다.
```bash
python cli.py parse-local <파일경로> --excel <출력파일명.xlsx> --json <출력파일명.json>
```

### 2.2 Rule Set 목록 조회 (API 연동 시)
서버 설정(`.env`)이 완료된 경우, 장비의 Rule Set 목록을 조회할 수 있습니다.
```bash
python cli.py list-rulesets
```

### 2.3 장비 데이터 직접 파싱
장비에서 특정 ID의 Rule Set을 직접 가져와서 파싱합니다.
```bash
python cli.py fetch-and-parse <RuleSetID> --excel result.xlsx
```
