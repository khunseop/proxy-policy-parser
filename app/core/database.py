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
    """안정적인 스키마를 위해 모든 테이블을 미리 정의합니다."""
    with get_connection() as conn:
        # 1. 정책 세트
        conn.execute('''
            CREATE TABLE IF NOT EXISTS policy_sets (
                _pk_auto INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT,
                upload_time DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 2. 정책 (고정 스키마)
        conn.execute('''
            CREATE TABLE IF NOT EXISTS policies (
                _pk_auto INTEGER PRIMARY KEY AUTOINCREMENT,
                set_id INTEGER,
                Type TEXT,
                Name TEXT,
                Path TEXT,
                ParentPath TEXT,
                Condition TEXT,
                Actions TEXT,
                PolicyID TEXT,
                Enabled TEXT,
                Description TEXT,
                Level INTEGER
            )
        ''')

        # 3. 객체 (고정 스키마)
        conn.execute('''
            CREATE TABLE IF NOT EXISTS objects (
                _pk_auto INTEGER PRIMARY KEY AUTOINCREMENT,
                set_id INTEGER,
                list_id TEXT,
                list_name TEXT,
                list_type_id TEXT,
                entry_value TEXT,
                entry_type TEXT,
                entry_details TEXT,
                list_description TEXT
            )
        ''')

        # 4. 분석용 매핑
        conn.execute('''
            CREATE TABLE IF NOT EXISTS policy_object_mapping (
                _pk_auto INTEGER PRIMARY KEY AUTOINCREMENT,
                set_id INTEGER,
                policy_id TEXT,
                list_id TEXT
            )
        ''')

        # 5. 메타데이터
        conn.execute('''
            CREATE TABLE IF NOT EXISTS metadata (
                _pk_auto INTEGER PRIMARY KEY AUTOINCREMENT,
                set_id INTEGER,
                conf_name TEXT,
                conf_id TEXT,
                prop_key TEXT,
                prop_value TEXT,
                description TEXT
            )
        ''')

        try:
            conn.execute('CREATE INDEX IF NOT EXISTS idx_pol_set_parent ON policies (set_id, ParentPath)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_map_set_list ON policy_object_mapping (set_id, list_id)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_obj_set_val ON objects (set_id, entry_value)')
        except Exception: pass

def save_parsed_data(filename: str, parsed_result: dict) -> int:
    init_db()
    with get_connection() as conn:
        cursor = conn.execute('INSERT INTO policy_sets (filename, upload_time) VALUES (?, ?)', 
                              (filename, datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        set_id = cursor.lastrowid
        
        def safe_to_sql(df, table_name):
            if df.empty: return
            # 'id' 컬럼(대소문자 무관) 제거하여 PK 충돌 방지
            drop_cols = [c for c in df.columns if c.lower() == 'id']
            if drop_cols: df = df.drop(columns=drop_cols)
            
            # DB 스키마에 정의된 컬럼만 선별하여 저장
            table_info = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
            valid_cols = [row[1] for row in table_info]
            df = df[[c for c in df.columns if c in valid_cols]]
            
            df.to_sql(table_name, conn, if_exists='append', index=False)

        # 데이터 저장
        if parsed_result.get('policies'):
            df_pol = pd.DataFrame(parsed_result['policies'])
            df_pol['set_id'] = set_id
            safe_to_sql(df_pol, 'policies')
            
        if parsed_result.get('objects'):
            df_obj = pd.DataFrame(parsed_result['objects'])
            df_obj['set_id'] = set_id
            safe_to_sql(df_obj, 'objects')
            
        if parsed_result.get('metadata', {}).get('config_details'):
            df_meta = pd.DataFrame(parsed_result['metadata']['config_details'])
            df_meta['set_id'] = set_id
            safe_to_sql(df_meta, 'metadata')
            
        # 분석용 매핑 데이터 생성
        mappings = []
        if parsed_result.get('policies'):
            for pol in parsed_result['policies']:
                # Condition과 Actions 텍스트에서 List(ID) 패턴 모두 추출
                combined_text = f"{pol.get('Condition', '')} {pol.get('Actions', '')}"
                found_ids = re.findall(r'List\(([^)]+)\)', combined_text)
                
                pol_id = pol.get('PolicyID')
                if not pol_id: continue
                
                for lid in set(found_ids):
                    mappings.append({
                        "set_id": set_id,
                        "policy_id": pol_id,
                        "list_id": lid
                    })
        
        if mappings:
            df_map = pd.DataFrame(mappings)
            df_map.to_sql('policy_object_mapping', conn, if_exists='append', index=False)

    return set_id

def get_dict_results(query: str, params: tuple = ()):
    init_db()
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        try:
            # 외부 노출용 id 필드 호환성 유지
            if "SELECT * FROM policy_sets" in query:
                query = query.replace("SELECT *", "SELECT _pk_auto AS id, *")
            cur.execute(query, params)
            return [dict(row) for row in cur.fetchall()]
        except sqlite3.OperationalError:
            import traceback
            traceback.print_exc()
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
