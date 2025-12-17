import requests
from requests.auth import HTTPBasicAuth
from urllib.parse import urljoin
import xml.etree.ElementTree as ET
import logging
import urllib3
from datetime import datetime
import os
import re
from .policy_parser import PolicyParser

# 보안 경고 무시
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

class SkyhighSWGClient:
    def __init__(self, base_url, username, password, verify_ssl=False):
        self.base_url = base_url.rstrip('/')
        self.username = username
        self.password = password
        self.verify_ssl = verify_ssl
        self.session = requests.Session()
        self.session_id = None

    def login(self):
        login_url = urljoin(self.base_url + '/', 'login')
        response = self.session.post(login_url, auth=HTTPBasicAuth(self.username, self.password), verify=self.verify_ssl)
        if response.status_code == 200:
            if 'Set-Cookie' in response.headers:
                for cookie in response.headers['Set-Cookie'].split(';'):
                    if cookie.strip().startswith('JSESSIONID='):
                        self.session_id = cookie.strip().split('=')[1]
                        break
            if self.session_id:
                logger.info("로그인 성공")
            else:
                raise Exception("세션 ID를 찾을 수 없습니다.")
        else:
            raise Exception(f"로그인 실패: {response.status_code} {response.text}")

    def _build_url(self, endpoint):
        if not self.session_id:
            raise Exception("세션 ID가 없습니다. 먼저 로그인해야 합니다.")
        return urljoin(self.base_url + '/', f"{endpoint};jsessionid={self.session_id}")

    def logout(self):
        logout_url = self._build_url('logout')
        response = self.session.post(logout_url, verify=self.verify_ssl)
        if response.ok:
            logger.info("로그아웃 완료")
        else:
            raise Exception(f"로그아웃 실패: {response.status_code} {response.text}")

    def list_rulesets(self, top_level_only=False, page=1, page_size=-1):
        params = {
            'topLevelOnly': str(top_level_only).lower(),
            'page': page,
            'pageSize': page_size
        }
        url = self._build_url('rulesets')
        response = self.session.get(url, params=params, verify=self.verify_ssl)
        if response.ok:
            try:
                root = ET.fromstring(response.text)
                rulesets = []
                for entry in root.findall('entry'):
                    rule = {
                        'id': entry.findtext('id', default=''),
                        'title': entry.findtext('title', default=''),
                        'position': entry.findtext('position', default=''),
                        'enabled': entry.findtext('enabled', default=''),
                        'no_of_child': entry.findtext('noOfChild', default=''),
                        'link': entry.find('link').get('href') if entry.find('link') is not None else None,
                        'parent_id': None
                    }
                    rulesets.append(rule)
                return rulesets
            except ET.ParseError as e:
                logger.error(f"XML 파싱 오류: {e}")
                raise
        else:
            raise Exception(f"Rule Set 목록 조회 실패: {response.status_code} {response.text}")

    def export_ruleset_to_xml_file(self, ruleset_id, title, output_dir='exports'):
        url = self._build_url(f'rulesets/rulegroups/{ruleset_id}/export')
        response = self.session.post(url, verify=self.verify_ssl)
        if response.ok:
            os.makedirs(output_dir, exist_ok=True)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            safe_title = re.sub(r'[\\/*?:"<>|]', '_', title)
            filename = f"{timestamp}_{safe_title}.xml"
            filepath = os.path.join(output_dir, filename)
            with open(filepath, 'wb') as f:
                f.write(response.content)
            logger.info(f"Rule Set '{title}'이(가) '{filename}'로 저장되었습니다.")
        else:
            raise Exception(f"Rule Set '{title}' 내보내기 실패: {response.status_code} {response.text}")

    def export_ruleset(self, ruleset_id, title, output_dir='exports'):
        url = self._build_url(f'rulesets/rulegroups/{ruleset_id}/export')
        response = self.session.post(url, verify=self.verify_ssl)
        if response.ok:
            os.makedirs(output_dir, exist_ok=True)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            safe_title = re.sub(r'[\\/*?:"<>|]', '_', title)
            filename = f"{timestamp}_{safe_title}"
            filepath = os.path.join(output_dir, filename)

            parser = PolicyParser(response.content, from_xml=True)
            parser.parse()
            parser.to_excel(f"{filepath}_rulegroups.xlsx", f"{filepath}_rules.xlsx")
    
            logger.info(f"Rule Set '{title}'이(가) '{filename}'로 저장되었습니다.")
        else:
            raise Exception(f"Rule Set '{title}' 내보내기 실패: {response.status_code} {response.text}")    