# Skyhigh SWG XML 스키마 상세 분석 보고서

본 문서는 `docs/FULL_SCHEMA_REPORT.txt`를 기반으로 Skyhigh Web Gateway 정책의 내부 구조를 심층 분석한 결과입니다.
파서 구현의 근거 문서로 활용되며, 발견된 파싱 문제의 원인 분석도 포함합니다.

---

## 1. 최상위 루트 구조 (Root Structure)

XML은 `libraryContent`를 최상위 노드로 하며, 4개의 핵심 섹션으로 구분됩니다.

```
libraryContent
├── configurations   — 엔진별 세부 설정 (Anti-Malware, URL Filtering 등)
├── libraryObject    — 정책 파일의 버전·이름 등 메타데이터
├── lists            — 정책에서 참조하는 전역 객체 (IP, URL, User List 등)
└── ruleGroup        — 실제 정책 트리 (재귀 구조)
```

---

## 2. 정책 트리 구조 (ruleGroup / rule)

### 2.1 재귀 계층 구조

정책 트리는 아래와 같은 이중 재귀 구조를 가집니다.

```
ruleGroup
├── ruleGroups
│   └── ruleGroup [RECURSIVE] — 중첩 그룹 (최대 35단계 이상 확인)
└── rules
    └── rule — 리프 노드 (하위 그룹 없음)
```

- `ruleGroup` : 조건·액션·하위 그룹·리프 규칙을 포함하는 컨테이너.
- `rule` : 실제로 평가·실행되는 최종 단위. `ruleGroups`를 가지지 않음.
- **주의**: 루트 `ruleGroup`에는 `@name`이 없을 수 있음. 파서가 `@name` 부재 시 전체 하위 트리를 건너뛰면 파싱 결과가 완전히 비어버리는 치명적 버그로 이어짐.

### 2.2 ruleGroup / rule 공통 속성

| 속성 | 설명 |
|------|------|
| `@id` | 전역 고유 식별자 |
| `@name` | 사용자 정의 이름 (루트에서 부재 가능) |
| `@enabled` | 정책 활성화 여부 (`true` / `false`) |
| `@cloudSynced` | 클라우드 연동 여부 |
| `@cycleRequest` | 요청 사이클 실행 여부 |
| `@cycleResponse` | 응답 사이클 실행 여부 |
| `@cycleEmbeddedObject` | 임베디드 오브젝트 사이클 실행 여부 |
| `@defaultRights` | 기본 접근 권한 |
| `acElements` | ACL 데이터 |
| `description` | 설명 문자열 |

---

## 3. 조건식 분석 (Condition Logic)

### 3.1 condition 노드 구조

```
condition
├── @always          — "true"이면 조건 없이 항상 매칭
└── expressions
    └── conditionExpression [0..N]
        ├── @prefix              — 이전 표현식과의 논리 연결자
        ├── @openingBracketCount — 이 표현식 앞에 붙는 '(' 개수
        ├── @closingBracketCount — 이 표현식 뒤에 붙는 ')' 개수
        ├── @operatorId          — 비교 연산자 (Equals, Matches, In List 등)
        ├── propertyInstance     — 비교 대상 프로퍼티
        └── parameter            — 비교 기준 값
```

### 3.2 @prefix — 논리 연결자 (중요, 기존 문서에서 누락)

`@prefix`는 현재 표현식과 **이전 표현식** 간의 논리 연산을 지정합니다.

- 값: `"AND"`, `"OR"`, `"NOT"`, 또는 부재(첫 번째 표현식이지만 `"NOT"`이 올 수도 있음)
- **첫 번째 표현식(i=0)이더라도 `"NOT"`이 설정될 수 있음** → 파서에서 i>0 조건으로만 처리하면 안 됨.
- 괄호(`@openingBracketCount` / `@closingBracketCount`)와 결합하여 복잡한 AND/OR/NOT 논리를 표현.

**예시**:
```
(URL.Host == "example.com") OR (Client.IP == "10.0.0.1")
→ conditionExpression[0]: openBracket=1, URL.Host == "example.com", closeBracket=1
→ conditionExpression[1]: @prefix="OR", openBracket=1, Client.IP == "10.0.0.1", closeBracket=1
```

### 3.3 propertyInstance — 프로퍼티 참조

```
propertyInstance
├── @propertyId               — 프로퍼티 식별자 (e.g., URL.Host, Client.IP)
├── @configurationId          — 특정 엔진 설정 참조 (선택적)
├── @useMostRecentConfiguration
└── parameters
    └── entry
        └── parameter
            ├── @valueTyp
            └── value
                ├── propertyInstance [RECURSIVE] — 프로퍼티를 파라미터로 받는 경우
                ├── listValue > @id
                └── stringValue > @value, @typeId, @stringModifier
```

### 3.4 parameter — 비교 기준값의 이중 구조 (중요, 기존 문서에서 누락)

`parameter` 노드는 값을 두 가지 방식으로 표현합니다. 파서는 **두 방식 모두** 처리해야 합니다.

**Form A — parameter에 속성이 직접 붙는 경우** (value 하위 노드 없음)
```xml
<parameter typeId="..." valueId="..." valueTyp="..."/>
```
| 속성 | 설명 |
|------|------|
| `@typeId` | 값의 타입 ID |
| `@valueId` | 값 식별자 (직접 참조) |
| `@valueTyp` | 값의 타입 종류 |
| `@listTypeId` | 리스트 타입 참조 (리스트 비교 시) |

**Form B — value 하위 노드로 값이 있는 경우**
```xml
<parameter>
  <value>
    <stringValue value="..." typeId="..." stringModifier="..."/>
    <!-- 또는 -->
    <listValue id="..."/>
  </value>
</parameter>
```

| 노드 | 속성 | 설명 |
|------|------|------|
| `stringValue` | `@value` | 실제 문자열 값 |
| `stringValue` | `@typeId` | 값 타입 |
| `stringValue` | `@stringModifier` | 대소문자 구분 등 수식자 |
| `listValue` | `@id` | 참조하는 List의 ID |

---

## 4. 액션 구조 분석 (Action Containers)

규칙이 매칭되었을 때 실행되는 행위입니다.

### 4.1 actionContainer — 기본 액션

```
actionContainer
├── @actionId        — 액션 종류 (Stop Rule Set, Block, Next Rule 등)
└── @configurationId — 연관 설정 참조 (선택적)
```

### 4.2 immediateActionContainers — 즉시 실행 액션

기본 액션과 함께 즉시 실행되는 부가 액션 목록입니다. 아래 세 종류가 존재합니다.

#### (1) setActionContainer — 프로퍼티 값 설정

```
setActionContainer
├── @propertyId      — 설정할 프로퍼티
└── expressions
    └── setExpression
        ├── @openingBracketCount
        ├── @closingBracketCount
        └── parameter
            ├── @valueId
            ├── @valueTyp
            └── value
                ├── listValue > @id
                └── propertyInstance [RECURSIVE]
```

#### (2) executeActionContainer — 내부 프로시저 실행

```
executeActionContainer
└── procedureValue
    ├── @procedureId   — 실행할 프로시저 ID (e.g., Anti-Malware scan)
    └── parameters
        └── entry
            └── parameter
                ├── @valueId
                ├── @valueTyp
                └── value > (stringValue | propertyInstance)
```

#### (3) enableEngineActionContainer — 엔진 활성화/비활성화 (기존 문서·파서에서 누락)

```
enableEngineActionContainer
├── @configurationId  — 대상 엔진의 설정 ID
└── @engineId         — 활성화/비활성화할 엔진 ID
```

파서에서 이 컨테이너를 처리하지 않으면 해당 규칙의 액션 정보가 불완전하게 기록됩니다.

---

## 5. 전역 객체 및 리스트 (Lists)

### 5.1 리스트 구조

```
lists
└── entry
    └── list
        ├── @id, @name, @typeId, @classifier, @feature
        ├── @structuralList, @systemList, @version, @mwg-version
        ├── description
        ├── content
        │   └── listEntry
        │       ├── complexEntry        — 메타데이터 포함 복합 항목
        │       │   ├── @defaultRights
        │       │   ├── acElements
        │       │   ├── configurationProperties > configurationProperty
        │       │   │   └── @key, @value, @type, @listType, @encrypted
        │       │   └── entry [RECURSIVE]
        │       └── (string)            — 단순 문자열 항목
        └── setup
            ├── connection > url, credentials
            ├── proxy > host, port, credentials
            └── updateTime > hourly > @minute
```

### 5.2 complexEntry 세부 속성

| 속성 | 설명 |
|------|------|
| `configurationProperty/@key` | 설정 키 이름 |
| `configurationProperty/@value` | 설정 값 (단, Form에 따라 `value` 하위 노드일 수도 있음) |
| `configurationProperty/@type` | 값 타입 |
| `configurationProperty/@listType` | 리스트 타입 |
| `configurationProperty/@encrypted` | 암호화 여부 |

---

## 6. 파서 구현 반영 사항 및 주의점

| 항목 | 위치 | 상태 |
|------|------|------|
| 루트 ruleGroup `@name` 부재 시 하위 전체 파싱 실패 | `policy_parser.py:walk()` | **수정 필요** |
| `enableEngineActionContainer` 파싱 누락 | `policy_parser.py:_parse_actions()` | **수정 필요** |
| `parameter` Form A (직접 속성) 처리 누락 | `condition_parser.py:get_full_expression()` | **수정 필요** |
| `i==0`인 첫 표현식의 `NOT` prefix 무시 | `condition_parser.py:get_full_expression()` | **수정 필요** |
| `propertyInstance`의 `@configurationId` 무시 | `condition_parser.py:_stringify_property()` | 경미 (정보 손실 없음) |
| ID 기반 객체 추적 (`@id` 수집) | `policy_parser.py` | 구현 완료 |
| 계단식(Staircase) 레이아웃 컬럼 (`Level` 필드) | `policy_parser.py` | 구현 완료 |
| `@mwg-version`, `@targetId` 등 기술 파라미터 수집 | `lists_parser.py` | 구현 완료 |
| ParentPath 인덱스 기반 지연 로딩 | `database.py` | 구현 완료 |
