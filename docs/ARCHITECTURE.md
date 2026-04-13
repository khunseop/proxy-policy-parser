# 시스템 아키텍처 (System Architecture)

본 프로젝트는 Skyhigh Web Gateway(SWG)의 복잡한 정책 XML 파일을 분석하여, 가공하기 쉬운 데이터 구조로 변환하고 시각화하는 것을 목적으로 합니다.

## 1. 디렉토리 구조 및 역할
- `main.py`: FastAPI 서버의 진입점입니다. 웹 UI와 API 통신을 담당합니다.
- `cli.py`: 터미널 환경에서 즉시 파싱을 수행하기 위한 커맨드라인 인터페이스입니다.
- `app/core/parsers/`: 핵심 파싱 엔진들이 위치합니다.
    - `policy_parser.py`: 정책 트리(RuleGroup/Rule)를 순회하며 계층 구조를 분석합니다.
    - `condition_parser.py`: 복잡하게 중첩된 XML 조건식을 인간이 읽기 쉬운 텍스트로 변환합니다.
    - `lists_parser.py`: 전역 객체(URL, IP 리스트 등)와 그 설정(Setup) 정보를 추출합니다.
    - `metadata_parser.py`: 장비의 구성(Configurations) 및 라이브러리 메타데이터를 추출합니다.
- `app/services/`: 파서들을 조합하여 최종 결과물을 생성하는 비즈니스 로직 레이어입니다.
- `app/api/`: 웹 브라우저와 통신하기 위한 REST API 엔드포인트 정의입니다.
- `app/models/`: 데이터 검증 및 규격을 정의하는 Pydantic 모델들이 위치합니다.

## 2. 데이터 흐름 (Data Flow)
1. **입력(Input)**: Skyhigh SWG 장비에서 추출한 정책 XML 파일을 입력받습니다 (API 연동 또는 파일 업로드).
2. **파싱(Parsing)**: 
    - XML의 복잡한 재귀 구조를 `xmltodict`를 이용해 객체화합니다.
    - 각 파서가 담당 영역(정책, 리스트, 설정 등)을 독립적으로 분석합니다.
3. **통합(Integration)**: `ParserService`가 파싱된 데이터들을 유기적으로 결합합니다.
4. **출력(Output)**: 
    - **Staircase Format**: 엑셀에서 필터링하기 쉬운 계단식 계층 구조로 출력합니다.
    - **JSON**: 웹 UI 시각화 및 정책 변경분(Diff) 분석을 위한 정규화된 데이터로 제공합니다.

## 3. 핵심 설계 원칙
- **순차적 무결성 (Sequential Integrity)**: 정책의 상하 실행 순서를 엄격히 준수하여 파싱합니다.
- **추적성 (Traceability)**: 모든 정책 노드에 고유 경로(Path)를 부여하여, 서로 다른 버전의 정책 간 비교가 가능하게 합니다.
- **포괄성 (Exhaustiveness)**: `FULL_SCHEMA_REPORT.txt`에 명시된 모든 기술적 속성(ACElements, CloudSynced 등)을 누락 없이 수집합니다.
EOF
