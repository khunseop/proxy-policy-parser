import sqlite3
import pandas as pd
import datetime
import os
import re

# DB 파일 경로 설정
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "policy_data.db")

def get_connection():
    return sqlite3.connect(DB_PATH)

def init_db():
    """보고서의 모든 속성을 반영한 고정 스키마를 생성합니다."""
    with get_connection() as conn:
        # 1. 정책 세트
        conn.execute('''
            CREATE TABLE IF NOT EXISTS policy_sets (
                _pk_auto INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT,
                upload_time DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 2. 정책 (재귀를 위해 parent_pk 도입)
        conn.execute('''
            CREATE TABLE IF NOT EXISTS policies (
                _pk_auto INTEGER PRIMARY KEY AUTOINCREMENT,
                set_id INTEGER,
                parent_pk INTEGER,   -- 부모 노드 참조
                Type TEXT,           -- Group or Rule
                Name TEXT,
                PolicyID TEXT,
                Enabled TEXT,
                Condition TEXT,      -- 해석된 조건 문자열 (list ID → list 이름 치환 후)
                ConditionRaw TEXT,   -- 원본 구조 JSON (모든 ID 보존, 검색·비교용)
                Actions TEXT,
                Path TEXT,
                ParentPath TEXT,
                Description TEXT,
                Level INTEGER,
                CloudSynced TEXT,
                CycleRequest TEXT,
                CycleResponse TEXT,
                CycleEmbedded TEXT,
                DefaultRights TEXT,
                ACElements TEXT
            )
        ''')

        # 3. 객체 (리스트 엔트리 재귀 대응)
        conn.execute('''
            CREATE TABLE IF NOT EXISTS objects (
                _pk_auto INTEGER PRIMARY KEY AUTOINCREMENT,
                set_id INTEGER,
                parent_entry_pk INTEGER, -- complexEntry 하위 재귀 참조
                list_id TEXT,
                list_name TEXT,
                list_type_id TEXT,
                entry_value TEXT,
                entry_type TEXT,
                entry_details TEXT, -- 기타 유동적 속성 (JSON)
                list_description TEXT,
                list_classifier TEXT,
                list_feature TEXT,
                list_structural TEXT,
                list_system TEXT,
                list_version TEXT,
                list_mwg_version TEXT
            )
        ''')

        # 4. 설정 메타데이터 (configurations + libraryObject)
        conn.execute('''
            CREATE TABLE IF NOT EXISTS metadata (
                _pk_auto INTEGER PRIMARY KEY AUTOINCREMENT,
                set_id INTEGER,
                conf_name TEXT,
                conf_id TEXT,
                mwg_version TEXT,
                target_id TEXT,
                template_id TEXT,
                version TEXT,
                default_rights TEXT,
                ac_elements TEXT,
                description TEXT,
                prop_key TEXT,
                prop_value TEXT,
                prop_type TEXT,
                prop_list_type TEXT,
                prop_encrypted TEXT
            )
        ''')

        # 5. 분석용 매핑
        conn.execute('''
            CREATE TABLE IF NOT EXISTS policy_object_mapping (
                _pk_auto INTEGER PRIMARY KEY AUTOINCREMENT,
                set_id INTEGER,
                policy_id TEXT,
                list_id TEXT
            )
        ''')

        try:
            conn.execute('CREATE INDEX IF NOT EXISTS idx_pol_set_parent ON policies (set_id, ParentPath)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_obj_list_id ON objects (set_id, list_id)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_map_lookup ON policy_object_mapping (set_id, list_id)')
        except Exception: pass

def save_parsed_data(filename: str, parsed_result: dict) -> int:
    init_db()
    with get_connection() as conn:
        cursor = conn.execute('INSERT INTO policy_sets (filename, upload_time) VALUES (?, ?)', 
                              (filename, datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        set_id = cursor.lastrowid
        
        def safe_to_sql(data_list, table_name):
            if not data_list: return
            df = pd.DataFrame(data_list)
            df['set_id'] = set_id
            
            # id 컬럼 충돌 방지
            drop_cols = [c for c in df.columns if c.lower() == 'id']
            if drop_cols: df = df.drop(columns=drop_cols)
            
            # 스키마에 정의된 컬럼만 필터링
            table_info = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
            valid_cols = [row[1] for row in table_info]
            df = df[[c for c in df.columns if c in valid_cols]]
            
            df.to_sql(table_name, conn, if_exists='append', index=False)

        safe_to_sql(parsed_result.get('policies'), 'policies')
        safe_to_sql(parsed_result.get('objects'), 'objects')
        
        if parsed_result.get('metadata', {}).get('config_details'):
            safe_to_sql(parsed_result['metadata']['config_details'], 'metadata')
            
        # 매핑 데이터: list ID는 반드시 원본 ID에서 추출해야 한다.
        # - Condition은 list 이름으로 치환되어 있으므로 ConditionRaw(JSON)에서 추출
        # - Actions는 List(id) 형태 그대로이므로 정규식 추출
        mappings = []
        if parsed_result.get('policies'):
            for pol in parsed_result['policies']:
                found_ids = set()

                # ConditionRaw에서 list ID 추출 (listRef / listTypeId 필드)
                raw_json = pol.get('ConditionRaw', '{}') or '{}'
                found_ids.update(re.findall(r'"listRef":\s*"([^"]+)"', raw_json))
                found_ids.update(re.findall(r'"listTypeId":\s*"([^"]+)"', raw_json))

                # Actions에서 List(id) 패턴 추출 (Actions는 이름 치환이 없으므로 ID 그대로)
                found_ids.update(re.findall(r'List\(([^)]+)\)', pol.get('Actions', '') or ''))

                pol_id = pol.get('PolicyID')
                if pol_id:
                    for lid in found_ids:
                        mappings.append({"set_id": set_id, "policy_id": pol_id, "list_id": lid})
        
        if mappings:
            pd.DataFrame(mappings).to_sql('policy_object_mapping', conn, if_exists='append', index=False)

    return set_id

def get_dict_results(query: str, params: tuple = ()):
    init_db()
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        try:
            if "SELECT * FROM policy_sets" in query:
                query = query.replace("SELECT *", "SELECT _pk_auto AS id, *")
            cur.execute(query, params)
            return [dict(row) for row in cur.fetchall()]
        except sqlite3.OperationalError:
            return []

def delete_policy_set(set_id: int):
    with get_connection() as conn:
        for table in ['policies', 'objects', 'metadata', 'policy_object_mapping']:
            try: conn.execute(f'DELETE FROM {table} WHERE set_id = ?', (set_id,))
            except sqlite3.OperationalError: pass
        conn.execute('DELETE FROM policy_sets WHERE _pk_auto = ?', (set_id,))

def clear_all_history():
    with get_connection() as conn:
        for table in ['policies', 'objects', 'metadata', 'policy_sets', 'policy_object_mapping']:
            try: conn.execute(f'DELETE FROM {table}')
            except sqlite3.OperationalError: pass

def cleanup_old_sets():
    with get_connection() as conn:
        try:
            cursor = conn.execute('SELECT _pk_auto FROM policy_sets ORDER BY upload_time DESC LIMIT 5')
            keep_ids = [row[0] for row in cursor.fetchall()]
            if not keep_ids: return
            placeholders = ','.join('?' for _ in keep_ids)
            for table in ['policies', 'objects', 'metadata', 'policy_object_mapping']:
                try: conn.execute(f'DELETE FROM {table} WHERE set_id NOT IN ({placeholders})', keep_ids)
                except sqlite3.OperationalError: pass
            conn.execute(f'DELETE FROM policy_sets WHERE _pk_auto NOT IN ({placeholders})', keep_ids)
        except sqlite3.OperationalError: pass


def compare_policy_sets(set_a_id: int, set_b_id: int) -> dict:
    """두 정책 세트 간의 차이를 분석합니다."""
    init_db()
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row

        # 세트 정보 조회
        sets_cur = conn.execute(
            'SELECT _pk_auto AS id, filename, upload_time FROM policy_sets WHERE _pk_auto IN (?, ?)',
            (set_a_id, set_b_id)
        )
        sets_map = {row['id']: dict(row) for row in sets_cur.fetchall()}
        set_a_info = sets_map.get(set_a_id, {})
        set_b_info = sets_map.get(set_b_id, {})

        # ── 정책 비교 ──────────────────────────────────────────────
        pol_cur = conn.execute(
            'SELECT * FROM policies WHERE set_id IN (?, ?)',
            (set_a_id, set_b_id)
        )
        map_a, map_b = {}, {}
        for row in pol_cur.fetchall():
            d = dict(row)
            pid = d.get('PolicyID')
            if not pid:
                continue
            if d['set_id'] == set_a_id:
                map_a[pid] = d
            else:
                map_b[pid] = d

        ids_a = set(map_a.keys())
        ids_b = set(map_b.keys())
        compare_fields = ['Name', 'Enabled', 'Condition', 'ConditionRaw', 'Actions']

        pol_added   = [map_b[pid] for pid in sorted(ids_b - ids_a)]
        pol_removed = [map_a[pid] for pid in sorted(ids_a - ids_b)]
        pol_changed = []
        pol_unchanged_count = 0

        for pid in sorted(ids_a & ids_b):
            a, b = map_a[pid], map_b[pid]
            diff_fields = {}
            for field in compare_fields:
                va = (a.get(field) or '').strip()
                vb = (b.get(field) or '').strip()
                if va != vb:
                    diff_fields[field] = {'a': a.get(field), 'b': b.get(field)}
            if diff_fields:
                pol_changed.append({
                    'PolicyID': pid,
                    'Type': a.get('Type'),
                    'changes': diff_fields,
                    'a': a,
                    'b': b,
                })
            else:
                pol_unchanged_count += 1

        # ── 리스트 비교 ────────────────────────────────────────────
        obj_cur = conn.execute(
            '''SELECT set_id, list_id, list_name, list_type_id, entry_value, entry_type
               FROM objects
               WHERE set_id IN (?, ?)
                 AND entry_value IS NOT NULL AND entry_value != ''
                 AND entry_type IN ('string', 'global', 'object')''',
            (set_a_id, set_b_id)
        )
        lst_a, lst_b = {}, {}
        for row in obj_cur.fetchall():
            d = dict(row)
            lid = d['list_id']
            target = lst_a if d['set_id'] == set_a_id else lst_b
            if lid not in target:
                target[lid] = {'name': d['list_name'], 'type': d['list_type_id'], 'values': set()}
            target[lid]['values'].add(d['entry_value'])

        lids_a = set(lst_a.keys())
        lids_b = set(lst_b.keys())

        lst_added   = [{'list_id': lid, 'list_name': lst_b[lid]['name'], 'list_type_id': lst_b[lid]['type']} for lid in sorted(lids_b - lids_a)]
        lst_removed = [{'list_id': lid, 'list_name': lst_a[lid]['name'], 'list_type_id': lst_a[lid]['type']} for lid in sorted(lids_a - lids_b)]
        lst_changed = []
        lst_unchanged_count = 0

        for lid in sorted(lids_a & lids_b):
            vals_a = lst_a[lid]['values']
            vals_b = lst_b[lid]['values']
            if vals_a != vals_b:
                lst_changed.append({
                    'list_id': lid,
                    'list_name': lst_b[lid]['name'],
                    'list_type_id': lst_b[lid]['type'],
                    'entries_added':   sorted(vals_b - vals_a),
                    'entries_removed': sorted(vals_a - vals_b),
                    'entry_count_a': len(vals_a),
                    'entry_count_b': len(vals_b),
                })
            else:
                lst_unchanged_count += 1

    return {
        'set_a': set_a_info,
        'set_b': set_b_info,
        'policies': {
            'added':   pol_added,
            'removed': pol_removed,
            'changed': pol_changed,
            'summary': {
                'added':     len(pol_added),
                'removed':   len(pol_removed),
                'changed':   len(pol_changed),
                'unchanged': pol_unchanged_count,
            },
        },
        'lists': {
            'added':   lst_added,
            'removed': lst_removed,
            'changed': lst_changed,
            'summary': {
                'added':     len(lst_added),
                'removed':   len(lst_removed),
                'changed':   len(lst_changed),
                'unchanged': lst_unchanged_count,
            },
        },
    }
