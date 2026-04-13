# Skyhigh SWG XML 스키마 상세 분석 보고서

본 문서는 `docs/FULL_SCHEMA_REPORT.txt`를 기반으로 Skyhigh Web Gateway 정책의 내부 구조를 심층 분석한 결과입니다.

## 1. 최상위 루트 구조 (Root Structure)
XML은 `libraryContent`를 최상위 노드로 하며, 4개의 핵심 섹션으로 구분됩니다.

1.  **`configurations`**: 엔진별 세부 설정 (Anti-Malware, URL Filtering 등)
2.  **`libraryObject`**: 정책 파일의 버전 및 이름 등 메타데이터
3.  **`lists`**: 정책에서 참조하는 전역 객체 (IP, URL, User List 등)
4.  **`ruleGroup`**: 실제 정책 트리 (가장 복잡한 재귀 구조)

---

## 2. 정책 트리 구조 분석 (RuleGroup & Rules)
정책은 실행 순서(Top-to-Bottom)에 따라 배치되며, 다음과 같은 특징을 가집니다.

### 2.1 무한 재귀 (Recursive Hierarchy)
- `ruleGroup` -> `ruleGroups` -> `ruleGroup` 형태로 무한 중첩 가능.
- 분석 결과 **최대 35단계 이상의 깊이(Depth)**가 확인되었으며, 이를 위해 파서는 `walk()` 함수를 통한 재귀 순회를 수행합니다.

### 2.2 주요 속성 (Attributes)
각 노드는 단순 이름(`@name`) 외에도 정책 제어에 필수적인 속성들을 포함합니다.
- `@enabled`: 정책 활성화 여부
- `@cloudSynced`: 클라우드 연동 여부
- `@cycleRequest / @cycleResponse / @cycleEmbeddedObject`: 정책이 실행되는 Cycle 단계
- `acElements`: 접근 제어 권한 데이터 (ACL)

---

## 3. 조건식 분석 (Condition Logic)
`condition` 노드는 정책의 '매칭 조건'을 정의하며, 스키마상 가장 파싱이 어려운 부분입니다.

### 3.1 조건 표현식 (`conditionExpression`)
- `operatorId`: 비교 연산자 (Equals, Matches, In List 등)
- `parameter`: 연산에 사용되는 값. `listValue`나 `stringValue` 형태로 존재.
- `propertyInstance`: Skyhigh 내장 프로퍼티 (예: `URL.Host`, `Client.IP`).

### 3.2 중첩 및 괄호 처리
- `@openingBracketCount` / `@closingBracketCount`: 복잡한 논리 구조(AND/OR)를 표현하기 위한 괄호 개수.
- 파서는 이를 분석하여 `(Client.IP == 1.1.1.1 OR Client.IP == 2.2.2.2)` 와 같은 **인간 중심적 텍스트(Stringifier)**로 변환합니다.

---

## 4. 액션 구조 분석 (Action Containers)
규칙이 매치되었을 때 실행되는 행위입니다.

1.  **기본 액션 (`actionContainer`)**: `Stop Rule Set`, `Block`, `Next Rule` 등 주 액션.
2.  **즉시 실행 액션 (`immediateActionContainers`)**:
    - `setActionContainer`: 특정 변수나 프로퍼티 값을 수정 (`Set User-Defined.IsVIP = true`).
    - `executeActionContainer`: 내부 프로시저 실행 (`Execute Anti-Malware`).
    - `enableEngineActionContainer`: 특정 엔진 활성화/비활성화.

---

## 5. 전역 객체 및 리스트 (Lists)
정책에서 이름으로 참조되는 모든 리스트들의 실제 데이터입니다.

- **`complexEntry`**: 단순 문자열 리스트가 아닌, 메타데이터(`configurationProperties`)를 포함하는 고도화된 객체 리스트.
- **`setup`**: 리스트의 업데이트 소스(URL), 프록시 설정, 자동 업데이트 주기 등을 정의.

---

## 6. 파서 구현에 반영된 분석 인사이트
- **ID 기반 추적**: 모든 요소의 `@id`를 수집하여 향후 정책 변경분(Diff) 비교 시 이름이 바뀌어도 동일 객체임을 식별 가능하게 함.
- **Staircase 레이아웃**: 무한 재귀 구조를 엑셀에서 필터링하기 위해 `L1`~`L35` 형태의 계단식 컬럼으로 정규화.
- **포괄적 수집**: 단순 이름/조건 외에 스키마 리포트에 명시된 `@mwg-version`, `@targetId` 등 모든 기술적 파라미터를 파싱 엔진에 포함.
