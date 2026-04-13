import sqlite3
import pandas as pd
import datetime
import os

# DB 파일 경로 설정 (루트 디렉토리)
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

def cleanup_old_sets():
    """가장 최근 5개의 정책 세트만 유지하고 나머지는 삭제합니다."""
    with get_connection() as conn:
        cursor = conn.execute('SELECT id FROM policy_sets ORDER BY upload_time DESC LIMIT 5')
        keep_ids = [row[0] for row in cursor.fetchall()]
        
        if not keep_ids:
            return
            
        placeholders = ','.join('?' for _ in keep_ids)
        
        # 1. 과거 데이터 삭제 (관련 테이블)
        for table in ['policies', 'objects', 'metadata']:
            try:
                conn.execute(f'DELETE FROM {table} WHERE set_id NOT IN ({placeholders})', keep_ids)
            except sqlite3.OperationalError:
                pass
        
        # 2. 메인 세트 삭제
        conn.execute(f'DELETE FROM policy_sets WHERE id NOT IN ({placeholders})', keep_ids)

def save_parsed_data(filename: str, parsed_result: dict) -> int:
    """파싱된 전체 결과를 SQLite DB에 저장합니다."""
    init_db()
    
    with get_connection() as conn:
        cursor = conn.execute('INSERT INTO policy_sets (filename, upload_time) VALUES (?, ?)', 
                              (filename, datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        set_id = cursor.lastrowid
        
        # Pandas의 to_sql을 이용하여 대용량 데이터를 고속으로 SQLite에 삽입
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
            
        # 성능을 위한 인덱스 생성
        try:
            conn.execute('CREATE INDEX IF NOT EXISTS idx_pol_set_parent ON policies (set_id, ParentPath)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_pol_set_name ON policies (set_id, Name)')
        except Exception:
            pass

    # 저장 완료 후 과거 이력 정리 (Max 5)
    cleanup_old_sets()
    return set_id

def get_dict_results(query: str, params: tuple = ()):
    """SELECT 쿼리 결과를 딕셔너리 리스트로 반환합니다."""
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(query, params)
        return [dict(row) for row in cur.fetchall()]
