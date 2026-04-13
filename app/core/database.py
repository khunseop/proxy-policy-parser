import sqlite3
import pandas as pd
import datetime
import os

# DB 파일 경로 설정
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "policy_data.db")

def get_connection():
    return sqlite3.connect(DB_PATH)

def init_db():
    with get_connection() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS policy_sets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT,
                upload_time DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')

def delete_policy_set(set_id: int):
    """특정 set_id와 연관된 모든 데이터를 삭제합니다."""
    with get_connection() as conn:
        # 1. 하위 데이터 삭제
        for table in ['policies', 'objects', 'metadata']:
            try:
                conn.execute(f'DELETE FROM {table} WHERE set_id = ?', (set_id,))
            except sqlite3.OperationalError:
                pass
        # 2. 메인 세트 삭제
        conn.execute('DELETE FROM policy_sets WHERE id = ?', (set_id,))

def clear_all_history():
    """모든 정책 히스토리를 초기화합니다."""
    with get_connection() as conn:
        for table in ['policies', 'objects', 'metadata', 'policy_sets']:
            try:
                conn.execute(f'DELETE FROM {table}')
            except sqlite3.OperationalError:
                pass

def cleanup_old_sets():
    """가장 최근 5개의 정책 세트만 유지하고 나머지는 삭제합니다."""
    with get_connection() as conn:
        cursor = conn.execute('SELECT id FROM policy_sets ORDER BY upload_time DESC LIMIT 5')
        keep_ids = [row[0] for row in cursor.fetchall()]
        if not keep_ids: return
            
        placeholders = ','.join('?' for _ in keep_ids)
        for table in ['policies', 'objects', 'metadata']:
            try:
                conn.execute(f'DELETE FROM {table} WHERE set_id NOT IN ({placeholders})', keep_ids)
            except sqlite3.OperationalError: pass
        conn.execute(f'DELETE FROM policy_sets WHERE id NOT IN ({placeholders})', keep_ids)

def save_parsed_data(filename: str, parsed_result: dict) -> int:
    init_db()
    with get_connection() as conn:
        cursor = conn.execute('INSERT INTO policy_sets (filename, upload_time) VALUES (?, ?)', 
                              (filename, datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        set_id = cursor.lastrowid
        
        if parsed_result.get('policies'):
            df_pol = pd.DataFrame(parsed_result['policies'])
            df_pol['set_id'] = set_id
            df_pol.to_sql('policies', conn, if_exists='append', index=False)
            
        if parsed_result.get('objects'):
            df_obj = pd.DataFrame(parsed_result['objects'])
            df_obj['set_id'] = set_id
            df_obj.to_sql('objects', conn, if_exists='append', index=False)
            
        if parsed_result.get('metadata', {}).get('config_details'):
            df_meta = pd.DataFrame(parsed_result['metadata']['config_details'])
            df_meta['set_id'] = set_id
            df_meta.to_sql('metadata', conn, if_exists='append', index=False)
            
        # 4. 정책-객체 매핑 데이터 (분석용)
        # Condition에서 List(ID)를 추출하여 매핑 테이블 생성
        import re
        mappings = []
        if parsed_result.get('policies'):
            for pol in parsed_result['policies']:
                cond = pol.get('Condition', '')
                found_ids = re.findall(r'List\(([^)]+)\)', cond)
                for lid in set(found_ids):
                    mappings.append({
                        "set_id": set_id,
                        "policy_id": pol.get('ID'),
                        "list_id": lid
                    })
        
        if mappings:
            df_map = pd.DataFrame(mappings)
            df_map.to_sql('policy_object_mapping', conn, if_exists='append', index=False)

        try:
            conn.execute('CREATE INDEX IF NOT EXISTS idx_pol_set_parent ON policies (set_id, ParentPath)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_pol_set_name ON policies (set_id, Name)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_map_set_list ON policy_object_mapping (set_id, list_id)')
        except Exception: pass

    cleanup_old_sets()
    return set_id

def get_dict_results(query: str, params: tuple = ()):
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(query, params)
        return [dict(row) for row in cur.fetchall()]
