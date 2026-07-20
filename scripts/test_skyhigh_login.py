"""Skyhigh SWG API 로그인 테스트.

아래 값을 직접 채운 뒤 실행한다: python scripts/test_skyhigh_login.py
"""
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.skyhigh_client import SkyhighSWGClient

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

BASE_URL = 'https://swg.example.com:port'
USERNAME = 'admin'
PASSWORD = 'secret'


def main():
    client = SkyhighSWGClient(BASE_URL, USERNAME, PASSWORD)
    # 사내 프록시(SWG)가 관리 API 인증서를 신뢰하지 못해 차단하는 걸 피하기 위해
    # 시스템/환경변수 프록시 설정을 무시하고 직접 접속한다.
    client.session.trust_env = False
    try:
        client.login()
        print(f"로그인 성공. session_id={client.session_id}")
    except Exception as e:
        print(f"로그인 실패: {e}")
        sys.exit(1)
    finally:
        if client.session_id:
            client.logout()


if __name__ == '__main__':
    main()
