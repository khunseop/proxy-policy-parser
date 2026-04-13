# 시스템 아키텍처 (System Architecture)

본 프로젝트는 Skyhigh Web Gateway(SWG)의 대규모 정책 XML을 안정적으로 처리하기 위해 '파싱 적재'와 '지연 조회'가 분리된 아키텍처를 가집니다.

## 1. 주요 구성 요소 (Components)

- **파싱 엔진 (Core Parsers)**: `Policy`, `Condition`, `Lists`, `Metadata` 파서로 구성되며, XML의 재귀 구조를 평면화(Flatten)하여 정규화된 데이터를 생성합니다.
- **데이터 저장소 (SQLite DB)**: 내장형 데이터베이스를 사용하여 파싱된 데이터를 저장합니다. 이는 메모리 사용량을 최소화하고 다수의 정책 이력을 관리하기 위함입니다.
- **백엔드 (FastAPI)**: DB와의 인터페이스를 담당하며, 트리 탐색을 위한 경로 기반 API 및 서버사이드 검색 기능을 제공합니다.
- **프론트엔드 (Miller Columns UI)**: macOS Finder 스타일의 UI로, 사용자가 필요한 시점에만 데이터를 서버에 요청(Lazy Loading)하여 렌더링 부하를 방지합니다.

## 2. 데이터 흐름 (Data Flow)

1.  **Ingestion**: 사용자가 XML 파일을 업로드하거나 API를 통해 장비 데이터를 가져옵니다.
2.  **Parsing & Storage**: `ParserService`가 데이터를 분석하고 `app/core/database.py`를 통해 SQLite DB에 적재합니다. 이때 정책 간의 계층 관계를 나타내는 `ParentPath` 인덱스가 생성됩니다.
3.  **Exploration**: 사용자가 웹 UI에서 폴더를 클릭하면, 해당 노드의 `Path`를 `ParentPath`로 가지는 하위 데이터만 DB에서 조회하여 브라우저에 표시합니다.
4.  **Search**: 전체 데이터 검색 시 서버사이드에서 SQL `LIKE` 쿼리를 수행하여 결과값만 클라이언트에 전송합니다.

## 3. 설계 원칙 (Design Principles)

- **에어갭 독립성**: 외부 종속성(Node.js, 외부 CDN 등)을 배제하여 폐쇄망 환경에서 Python 단독 실행이 가능하게 합니다.
- **대용량 최적화**: 수십만 줄의 정책도 브라우저 메모리 부족 없이 탐색할 수 있도록 서버사이드 지연 로딩을 구현합니다.
- **데이터 무결성**: 모든 정책 레코드가 고유 ID 및 전체 경로 정보를 유지하도록 하여 향후 정책 비교(Diff) 분석의 정확도를 보장합니다.
