# Skyhigh SWG Policy Parser & Explorer

Skyhigh Web Gateway(SWG)의 정책 XML 파일을 분석하여 정규화된 데이터를 추출하고, 웹 환경에서 시각화하는 도구입니다. 대규모 정책의 효율적인 탐색을 위해 SQLite 기반의 지연 로딩 아키텍처를 채택하고 있습니다.

## 주요 기능 (Key Features)

- **고성능 파싱 엔진**: 35단계 이상의 재귀 구조 정책을 순차적으로 추출하며, 복잡한 조건식을 인간이 읽기 쉬운 텍스트로 변환합니다.
- **SQLite 기반 데이터 관리**: 파싱된 데이터를 내장 DB에 저장하여 수만 개의 정책 노드도 지연 로딩(Lazy Loading) 방식으로 쾌적하게 탐색할 수 있습니다.
- **macOS Finder 스타일 UI**: 밀러 컬럼(Miller Columns) 레이아웃을 통해 깊은 정책 계층 구조를 직관적으로 파악할 수 있습니다.
- **폐쇄망(Air-Gap) 지원**: 외부 CDN이나 복잡한 빌드 도구 없이, Python 환경만으로 프론트엔드와 백엔드를 모두 구동할 수 있습니다.
- **이력 관리**: 최대 5개의 정책 세트를 저장하고 관리(삭제/초기화)할 수 있는 기능을 제공합니다.

## 상세 문서 (Documentation)

상세한 프로젝트 정보는 아래 문서들을 참고하시기 바랍니다.

- [시스템 아키텍처 (Architecture)](docs/ARCHITECTURE.md): 프로젝트의 구성 및 데이터 흐름 설명.
- [스키마 분석 리포트 (Schema Analysis)](docs/SCHEMA_ANALYSIS.md): Skyhigh XML 구조 분석 결과 및 파싱 원칙.
- [사용자 가이드 (User Guide)](docs/USER_GUIDE.md): CLI 명령어 및 웹 UI 사용 방법.
- [프로젝트 로드맵 (Roadmap)](docs/ROADMAP.md): 현재 개발 현황 및 향후 계획.

## 설치 및 실행 (Installation & Quick Start)

### 1. 의존성 설치
본 프로젝트는 Python 3.10 이상의 환경을 권장합니다.
```bash
pip install -r requirements.txt
```

### 2. 웹 UI 실행
```bash
python main.py
```
실행 후 브라우저에서 `http://localhost:8000`에 접속하여 XML 파일을 업로드할 수 있습니다.

### 3. CLI 사용 (로컬 파싱)
```bash
python cli.py parse-local <파일명>.xml --excel output.xlsx
```

## 기술 스택 (Technical Stack)

- **Backend**: FastAPI, SQLite, Pandas
- **Frontend**: Vanilla HTML/JS/CSS (No Build Tools)
- **Engine**: xmltodict, openpyxl
