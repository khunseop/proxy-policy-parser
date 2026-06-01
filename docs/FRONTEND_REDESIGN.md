# Frontend Redesign — React 전환 설계 문서

## 1. 배경 및 목적

### 현재 문제
- 좌측 트리 → 가운데 목록 → 우측 상세의 3단 구조가 프록시 장비 웹 콘솔과 동일해 분석 도구로서의 차별점이 없음
- 그룹과 Rule의 시각적 구분이 약함
- 전체 정책을 한눈에 파악하기 어려움
- Stats·Lists·배치조회가 흩어져 있어 작업 흐름이 끊김

### 목표
- **Flat Table 중심**: 전체 정책을 한 화면에서 파악
- **강력한 필터**: 그룹/Rule 구분, 활성/비활성, 키워드, Path depth 등
- **분석 기능 통합**: 배치 값 조회·Excel 내보내기를 자연스럽게 연결
- **백엔드 무변경**: 기존 FastAPI `/api/v1/*` 엔드포인트 그대로 사용

---

## 2. 기술 스택

| 역할 | 선택 | 이유 |
|------|------|------|
| UI 프레임워크 | React 18 | 컴포넌트 모델, 풍부한 생태계 |
| 빌드 도구 | Vite | 빠른 빌드, 설정 최소화 |
| 테이블 | TanStack Table v8 | 가상스크롤·정렬·필터 내장, 헤드리스 |
| 서버 상태 | TanStack Query v5 | API 캐싱, 로딩/에러 상태 자동 관리 |
| 스타일 | CSS Modules | 빌드 의존성 최소화, 기존 CSS 변수 재사용 |
| 언어 | TypeScript | API 응답 타입 안전성 |

**망분리 배포 방식**
```
[개발 머신]  npm run build  →  dist/  →  복사  →  [망분리 서버 app/static/dist/]
FastAPI: mount("/", StaticFiles(directory="app/static/dist"), name="spa")
```
런타임에 npm·CDN 불필요. 빌드 결과물(JS/CSS 번들)만 배포.

---

## 3. 디렉토리 구조

```
proxy-policy-parser/
├── frontend/                      ← 신규 (React 소스)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   ├── client.ts          ← fetch 래퍼 (base URL, error handling)
│       │   └── types.ts           ← API 응답 타입 정의
│       ├── hooks/
│       │   ├── usePolicies.ts     ← TanStack Query 훅
│       │   ├── useLists.ts
│       │   └── useStats.ts
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppHeader.tsx
│       │   │   └── AppLayout.tsx
│       │   ├── policy/
│       │   │   ├── PolicyTable.tsx     ← 메인 테이블
│       │   │   ├── PolicyRow.tsx       ← 행 렌더러
│       │   │   ├── PolicyFilters.tsx   ← 필터 바
│       │   │   └── PolicyDetail.tsx    ← 우측 상세 슬라이드
│       │   ├── lists/
│       │   │   ├── ListsPanel.tsx
│       │   │   └── ListEntries.tsx
│       │   ├── analysis/
│       │   │   ├── BatchLookup.tsx
│       │   │   └── ValueLookup.tsx
│       │   ├── diff/
│       │   │   └── DiffView.tsx
│       │   └── common/
│       │       ├── Badge.tsx
│       │       ├── EmptyState.tsx
│       │       └── LoadingSpinner.tsx
│       └── styles/
│           ├── variables.css      ← 기존 CSS 변수 이식
│           └── global.css
├── app/                           ← 기존 FastAPI (변경 없음)
│   ├── api/routes.py
│   ├── core/
│   ├── services/
│   └── static/
│       └── dist/                  ← 빌드 결과물 배포 위치
└── main.py
```

---

## 4. 레이아웃 설계

### 전체 구조
```
┌─────────────────────────────────────────────────────────┐
│  Header: [파일명 선택▼] [🗑️] [XML 업로드]              │
├──────────────┬──────────────────────────────────────────┤
│              │  [Policy] [Lists] [Analysis] [Diff]  탭  │
│  (탭 없음)   ├──────────────────────────────────────────┤
│              │  필터 바 (항상 고정)                      │
│              │  ┌──────────────────────────────────────┐│
│              │  │  정책 테이블 (가상스크롤)             ││
│              │  │  ...                                  ││
│              │  └──────────────────────────────────────┘│
└──────────────┴──────────────────────────────────────────┘
```

탭은 **메인 패널 상단**으로 이동. 사이드바 제거 — 분석 기능은 탭으로 접근.

### Policy 탭 (메인)

```
┌─[필터 바]───────────────────────────────────────────────────────────┐
│ [🔍 전체 검색...] [유형: 전체▼] [상태: 전체▼] [만료▼] [⬇️ Excel] │
└─────────────────────────────────────────────────────────────────────┘
┌─[테이블 헤더]───────────────────────────────────────────────────────┐
│  이름                    │ 유형  │ 상태 │ Condition 요약  │ Path    │
├─────────────────────────────────────────────────────────────────────┤
│ ▌ Security Group         │ Group │ 활성 │                 │ Root    │ ← 그룹: 짙은 배경
│   ├ Block Malware        │ Rule  │ 활성 │ List(Malware).. │ Securi..│
│   ├ Block Ads            │ Rule  │비활성│ List(Ads)...    │ Securi..│
│ ▌ Allow Group            │ Group │ 활성 │                 │ Root    │
│   ├ Allow Office365      │ Rule  │ 활성 │ List(O365)...   │ Allow.. │
└─────────────────────────────────────────────────────────────────────┘
```

**그룹/Rule 구분 방법**
- Group 행: 좌측 컬러 바(accent) + 짙은 배경 + 굵은 폰트
- Rule 행: Path의 depth에 따라 들여쓰기 (패딩으로 표현)
- 클릭 시 우측에서 상세 슬라이드 패널 열림

**테이블 컬럼**

| 컬럼 | 소스 필드 | 특이사항 |
|------|---------|---------|
| 이름 | `Name` | depth별 들여쓰기, 아이콘(📁/📄) |
| 유형 | `Type` | Group / Rule 배지 |
| 상태 | `Enabled` | 활성(녹색) / 비활성(회색) 배지 |
| Condition | `Condition` | 100자 truncate, hover 시 전체 표시 |
| Actions | `Actions` | 짧게 표시 |
| Path | `Path` | 마지막 segment만 표시, hover 시 전체 |
| 만료 | `Condition` | detectExpiry로 D-day 배지 |

### Lists 탭

```
┌─[검색]──────────────────────────────────────────────────────────────┐
│ [🔍 리스트 이름 검색]  [🔍 값으로 검색]     [⬇️ 전체 Excel]       │
└─────────────────────────────────────────────────────────────────────┘
┌─[2열 분할]───────────────────────────────┬──────────────────────────┐
│  리스트 목록                              │  선택된 리스트 항목      │
│  ┌─────────────────────────────────────┐ │  ┌────────────────────┐  │
│  │ 📦 Blocked Domains        500건 ⬇️ │ │  │ Value | Desc | Type│  │
│  │ 📦 Allow Office365        120건 ⬇️ │ │  │ google.com | ... | │  │
│  │ ...                                 │ │  │ ...                │  │
│  └─────────────────────────────────────┘ │  └────────────────────┘  │
└──────────────────────────────────────────┴──────────────────────────┘
```

### Analysis 탭 (기존 Stats + 배치조회 통합)

```
┌─[서브탭]────────────────────────────────────────────────┐
│ [📊 정책 통계] [🔍 값 조회] [📋 배치 조회]              │
├─────────────────────────────────────────────────────────┤
│ (선택된 서브탭에 따라 내용 변경)                        │
└─────────────────────────────────────────────────────────┘
```

### Diff 탭

기존과 동일하되, 모달 제거 → 탭 내에서 바로 비교 대상 선택

---

## 5. 주요 컴포넌트 설계

### 5.1 PolicyTable

TanStack Table의 `useReactTable` + `useVirtualizer` 조합.

```typescript
// 핵심 구조
const table = useReactTable({
  data: policies,           // 전체 정책 (최대 20k행)
  columns,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
  state: { columnFilters, sorting, globalFilter },
})

// 가상스크롤: rowVirtualizer로 보이는 행만 렌더링
const rowVirtualizer = useVirtualizer({
  count: table.getRowModel().rows.length,
  estimateSize: () => 36,
  overscan: 20,
})
```

데이터 로드: `GET /api/v1/policies/{set_id}/search?limit=20000` 로 전체 로드 후 클라이언트 필터링. 20k행도 가상스크롤로 부드럽게 동작.

### 5.2 PolicyFilters

```typescript
interface FilterState {
  keyword: string        // 전체 텍스트 검색
  type: 'all' | 'Group' | 'Rule'
  enabled: 'all' | 'true' | 'false'
  expiry: 'all' | 'expired' | 'expiring'
  fields: 'all' | 'name' | 'condition' | 'actions'
}
```

필터 변경 시 TanStack Table의 `columnFilters` 업데이트. DB 재요청 없이 클라이언트 필터링.

### 5.3 PolicyDetail (슬라이드 패널)

행 클릭 시 오른쪽에서 슬라이드로 열림. 기존 `detail.js`의 내용을 이식.
- 정책 이름 / 상태 / 만료 배지
- Condition 전체 (포맷팅)
- Actions
- Path (클릭 가능한 breadcrumb)
- 기술 정보 (Type, Level, CloudSynced 등)

### 5.4 BatchLookup

```typescript
// 핵심 상태
const [inputText, setInputText] = useState('')   // textarea 값
const [result, setResult] = useState(null)        // API 응답

const values = inputText.split(',').map(v => v.trim()).filter(Boolean)

// 조회: POST /api/v1/analysis/{set_id}/value-lookup-batch
// 저장: POST /api/v1/analysis/{set_id}/value-lookup-batch/export → blob 다운로드
```

---

## 6. API 타입 정의

```typescript
// api/types.ts

interface PolicySet {
  _pk_auto: number
  filename: string
  upload_time: string
}

interface Policy {
  _pk_auto: number
  set_id: number
  parent_pk: number
  Type: 'Group' | 'Rule'
  Name: string
  PolicyID: string
  Enabled: 'true' | 'false'
  Condition: string
  ConditionRaw: string
  Actions: string
  Path: string
  ParentPath: string
  Description: string
  Level: number
  CloudSynced: string
}

interface ListObject {
  list_id: string
  list_name: string
  entry_value: string
  entry_type: string
  entry_details: string
}

interface PolicyStats {
  total: number
  rules: number
  groups: number
  enabled: number
  disabled: number
  block: number
  unconditional: number
  disabled_block: number
}

interface BatchLookupResult {
  total_input: number
  matched_count: number
  unmatched_values: string[]
  matched_values: Record<string, Array<{ list_id: string; list_name: string }>>
  policies: Array<Policy & { list_id: string; list_name: string }>
  policy_count: number
}

interface DiffResult {
  set_a: PolicySet
  set_b: PolicySet
  policies: {
    added: Policy[]
    removed: Policy[]
    changed: Array<{
      PolicyID: string
      changes: Record<string, { a: string; b: string }>
      a: Policy
      b: Policy
    }>
    summary: { added: number; removed: number; changed: number; unchanged: number }
  }
  lists: {
    added: Array<{ list_id: string; list_name: string }>
    removed: Array<{ list_id: string; list_name: string }>
    changed: Array<{
      list_id: string
      list_name: string
      entries_added: string[]
      entries_removed: string[]
      entry_count_a: number
      entry_count_b: number
    }>
    summary: { added: number; removed: number; changed: number; unchanged: number }
  }
}
```

---

## 7. FastAPI 연동

### 7.1 개발 환경 (프록시)

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000'  // FastAPI로 프록시
    }
  },
  build: {
    outDir: '../app/static/dist'       // 빌드 결과를 FastAPI static 폴더로
  }
})
```

### 7.2 FastAPI SPA 서빙 (main.py 수정)

```python
# main.py 추가
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# API 라우터 먼저
app.include_router(router, prefix="/api/v1")

# React SPA 서빙 (build 결과물)
app.mount("/assets", StaticFiles(directory="app/static/dist/assets"), name="assets")

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    return FileResponse("app/static/dist/index.html")
```

### 7.3 배포 절차 (망분리)

```bash
# 개발 머신 (인터넷 가능)
cd frontend
npm install
npm run build
# → app/static/dist/ 에 빌드 결과물 생성

# 망분리 서버로 복사 (파일 전달 방식)
# app/static/dist/ 폴더만 복사하면 됨
# Python 패키지는 기존과 동일 (추가 설치 없음)
```

---

## 8. 마이그레이션 전략

단계별로 진행해서 기존 서비스를 유지하면서 전환.

### Phase 1: 기반 구축
- Vite + React + TypeScript 셋업
- API 클라이언트 / 타입 정의
- 레이아웃 뼈대 (Header, 탭 구조)
- FastAPI SPA 서빙 연동 확인

### Phase 2: Policy 탭 (핵심)
- PolicyTable (TanStack Table + 가상스크롤)
- PolicyFilters
- PolicyDetail 슬라이드 패널
- Excel 내보내기 (기존 서버 엔드포인트 재사용)

### Phase 3: 나머지 탭 이식
- Lists 탭 (리스트 목록 + 엔트리)
- Analysis 탭 (정책 통계 + 값 조회 + 배치 조회)
- Diff 탭

### Phase 4: 기존 Vanilla JS 제거
- `app/static/js/`, `app/static/css/` 제거
- `app/templates/index.html` 제거
- main.py SPA 서빙으로 전환

---

## 9. 확정된 설계 결정사항

| 항목 | 결정 |
|------|------|
| Path depth 표현 | **별도 Depth 컬럼** — 숫자로 명시적 표시 |
| 그룹 행 펼침/접기 | **클릭으로 하위 표시/숨김** — Group 행 클릭 시 소속 Rule 토글 |
| 상세 패널 위치 | **하단 Drawer** — 행 클릭 시 하단에서 슬라이드업, 테이블 가리지 않음 |
| 정책 전체 로드 방식 | **페이지네이션** — 초기 로드 부담 없이 페이지 단위 이동 |
| 기존 Vanilla JS 유지 기간 | **Phase 4까지 병행** — React 완성 후 제거 |
