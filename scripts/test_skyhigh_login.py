"""Skyhigh SWG API 로그인 테스트.

실행하면 접속 정보를 터미널에서 입력받는다: python scripts/test_skyhigh_login.py
"""
import getpass
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.skyhigh_client import SkyhighSWGClient

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')


def main():
    base_url = input('Base URL: ').strip()
    username = input('Username: ').strip()
    password = getpass.getpass('Password: ')

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
