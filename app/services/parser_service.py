import os
import re
import logging
import xmltodict
from typing import List, Dict, Any, Tuple
from app.core.skyhigh_client import SkyhighSWGClient
from app.core.parsers.policy_parser import PolicyParser
from app.core.parsers.lists_parser import ListsParser
from app.core.parsers.metadata_parser import MetadataParser
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

    def _build_list_name_map(self, all_lists: List[Dict[str, Any]]) -> Dict[str, str]:
        """파싱된 lists 결과에서 {list_id: list_name} 맵을 구성한다.

        list_id가 같은 행이 여러 개일 수 있으므로 처음 유효한 list_name만 사용한다.
        """
        name_map: Dict[str, str] = {}
        for row in all_lists:
            lid = row.get("list_id")
            lname = row.get("list_name")
            if lid and lname and lid not in name_map:
                name_map[lid] = lname
        return name_map

    def _resolve_list_refs(self, policies: List[Dict[str, Any]], name_map: Dict[str, str]) -> None:
        """Condition 문자열의 List(id) 패턴을 List(이름) 으로 치환한다 (in-place).

        ConditionRaw는 원본 ID를 보존하기 위해 변경하지 않는다.
        치환할 이름이 없는 경우(알 수 없는 list ID) 원본 그대로 유지한다.
        """
        def _replacer(m: re.Match) -> str:
            lid = m.group(1)
            name = name_map.get(lid)
            return f"List({name})" if name else m.group(0)

        for pol in policies:
            raw_condition = pol.get("Condition", "")
            if raw_condition:
                pol["Condition"] = re.sub(r"List\(([^)]+)\)", _replacer, raw_condition)

    def _parse_xml(self, xml_content: bytes) -> Dict[str, Any]:
        # XML을 Dict로 먼저 변환 (메타데이터 및 리스트 파서 공유용)
        source_dict = xmltodict.parse(xml_content)

        # 1. 리스트(객체) 파싱을 먼저 수행 — 정책 해석에 필요한 list_name_map 구성용
        lists_parser = ListsParser(xml_content, from_xml=True)
        all_lists = lists_parser.parse()

        # 2. 정책 파싱 (Sequential Flat Table)
        policy_parser = PolicyParser(xml_content, from_xml=True)
        all_rules = policy_parser.parse()

        # 3. 파싱 후 해석 패스: list ID → list 이름 치환
        #    ConditionRaw(JSON)는 원본 ID 그대로 보존, Condition 문자열만 치환
        name_map = self._build_list_name_map(all_lists)
        self._resolve_list_refs(all_rules, name_map)

        # 4. 메타데이터 파싱 (Configuration & Library Object)
        metadata_parser = MetadataParser(source_dict)
        meta_data = metadata_parser.parse()

        return {
            "policies": all_rules,
            "objects": all_lists,
            "metadata": meta_data,
            "summary": {
                "policy_entries_count": len(all_rules),
                "object_entries_count": len(all_lists),
                "config_entries_count": len(meta_data["config_details"])
            }
        }

    def export_to_excel(self, data: Dict[str, Any], output_path: str):
        import pandas as pd
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # 1. 통합된 정책 시트
            if data.get('policies'):
                pd.DataFrame(data['policies']).to_excel(writer, sheet_name='Policies', index=False)
            
            # 2. 객체(리스트) 시트
            if data.get('objects'):
                pd.DataFrame(data['objects']).to_excel(writer, sheet_name='Objects', index=False)

            # 3. 메타데이터(설정) 시트
            if data.get('metadata', {}).get('config_details'):
                pd.DataFrame(data['metadata']['config_details']).to_excel(writer, sheet_name='Metadata', index=False)
                
        return output_path
