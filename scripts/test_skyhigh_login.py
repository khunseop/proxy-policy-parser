"""Skyhigh SWG API 로그인 테스트.

환경변수로 접속 정보를 읽어 로그인/로그아웃만 시도한다.

    SKYHIGH_BASE_URL=https://swg.example.com:port \
    SKYHIGH_USERNAME=admin \
    SKYHIGH_PASSWORD=secret \
    python scripts/test_skyhigh_login.py
"""
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.skyhigh_client import SkyhighSWGClient

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')


def main():
    base_url = os.environ.get('SKYHIGH_BASE_URL')
    username = os.environ.get('SKYHIGH_USERNAME')
    password = os.environ.get('SKYHIGH_PASSWORD')

    missing = [name for name, val in [
        ('SKYHIGH_BASE_URL', base_url),
        ('SKYHIGH_USERNAME', username),
        ('SKYHIGH_PASSWORD', password),
    ] if not val]
    if missing:
        print(f"환경변수가 설정되지 않았습니다: {', '.join(missing)}")
        sys.exit(1)

    client = SkyhighSWGClient(base_url, username, password)
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
