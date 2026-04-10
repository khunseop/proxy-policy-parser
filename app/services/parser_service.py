import os
import logging
from typing import List, Dict, Any, Tuple
from app.core.skyhigh_client import SkyhighSWGClient
from app.core.parsers.policy_parser import PolicyParser
from app.core.parsers.lists_parser import ListsParser
from app.core.config import settings

logger = logging.getLogger(__name__)

class ParserService:
    def __init__(self):
        self.client = SkyhighSWGClient(
            base_url=settings.SKYHIGH_BASE_URL,
            username=settings.SKYHIGH_USERNAME,
            password=settings.SKYHIGH_PASSWORD,
            verify_ssl=settings.VERIFY_SSL
        )

    async def list_rulesets(self) -> List[Dict[str, Any]]:
        try:
            self.client.login()
            rulesets = self.client.list_rulesets()
            self.client.logout()
            return rulesets
        except Exception as e:
            logger.error(f"Rule Set 목록 조회 실패: {str(e)}")
            raise

    async def parse_from_api(self, ruleset_id: str) -> Dict[str, Any]:
        try:
            self.client.login()
            xml_content = self.client.fetch_ruleset_xml(ruleset_id)
            self.client.logout()
            
            return self._parse_xml(xml_content)
        except Exception as e:
            logger.error(f"API 데이터 파싱 실패: {str(e)}")
            raise

    async def parse_from_file(self, xml_content: bytes) -> Dict[str, Any]:
        try:
            return self._parse_xml(xml_content)
        except Exception as e:
            logger.error(f"파일 데이터 파싱 실패: {str(e)}")
            raise

    def _parse_xml(self, xml_content: bytes) -> Dict[str, Any]:
        parser = PolicyParser(xml_content, from_xml=True)
        rulegroups, rules = parser.parse()
        
        return {
            "rulegroups": rulegroups,
            "rules": rules,
            "summary": {
                "rulegroups_count": len(rulegroups),
                "rules_count": len(rules)
            }
        }

    def export_to_excel(self, data: Dict[str, Any], output_path: str):
        import pandas as pd
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            pd.DataFrame(data['rulegroups']).to_excel(writer, sheet_name='RuleGroups', index=False)
            pd.DataFrame(data['rules']).to_excel(writer, sheet_name='Rules', index=False)
        return output_path
