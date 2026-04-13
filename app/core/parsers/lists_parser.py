import json
import xmltodict
from typing import Any, Dict, List, Optional, Union

class ListsParser:
    def __init__(self, source, from_xml: bool = False):
        if from_xml:
            self.data = xmltodict.parse(source)
        elif isinstance(source, dict):
            self.data = source
        else:
            raise ValueError("Invalid data source provided. Must be dict or XML string.")

        self.lists_records = []
        self.processed_list_ids = set()

    def _ensure_list(self, value: Any) -> List:
        if value is None: return []
        if isinstance(value, list): return value
        return [value]

    def _extract_all_properties(self, obj: Any) -> Dict[str, Any]:
        """객체 내의 모든 @속성과 단순 값을 딕셔너리로 추출 (JSON 저장용)"""
        props = {}
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k.startswith('@'):
                    props[k[1:]] = v
                elif isinstance(v, (str, int, float, bool)):
                    props[k] = v
        return props

    def _parse_entry_recursive(self, entry: Any, base_info: Dict[str, Any]):
        """listEntry와 그 하위의 complexEntry, recursive entry를 모두 파싱"""
        if not entry: return

        # 1. 단순 문자열 엔트리인 경우
        if isinstance(entry, str):
            row = base_info.copy()
            row["entry_value"] = entry
            row["entry_type"] = "string"
            self.lists_records.append(row)
            return

        # 2. 딕셔너리(객체) 엔트리인 경우
        if isinstance(entry, dict):
            # complexEntry 확인
            ce = entry.get("complexEntry")
            if ce:
                # complexEntry의 기본 정보 추출
                row = base_info.copy()
                row["entry_type"] = "complex"
                
                # 가변적인 모든 속성은 details에 보관 (DB 충돌 방지)
                details = self._extract_all_properties(ce)
                
                # 전형적인 값 추출 시도
                row["entry_value"] = ce.get("description") or ce.get("@id") or "Complex Object"
                row["entry_details"] = json.dumps(details, ensure_ascii=False)
                self.lists_records.append(row)

                # [RECURSIVE] complexEntry 하위의 또 다른 entry들 탐색
                sub_entries = self._ensure_list(ce.get("entry"))
                for se in sub_entries:
                    self._parse_entry_recursive(se, base_info)
            else:
                # 일반 딕셔너리 형태의 엔트리 (예: <IPRange> 등)
                row = base_info.copy()
                row["entry_type"] = "object"
                row["entry_value"] = str(entry)
                row["entry_details"] = json.dumps(entry, ensure_ascii=False)
                self.lists_records.append(row)

    def _process_list_node(self, list_obj: Dict[str, Any]):
        """단일 list 노드 처리"""
        if not isinstance(list_obj, dict): return
        
        list_id = list_obj.get("@id")
        if not list_id or list_id in self.processed_list_ids:
            return
        self.processed_list_ids.add(list_id)

        # 리스트의 기본 메타데이터 (고정 컬럼)
        base_info = {
            "list_id": list_id,
            "list_name": list_obj.get("@name") or "Unnamed",
            "list_type_id": list_obj.get("@typeId"),
            "list_description": list_obj.get("description")
        }

        # content 내의 엔트리들 파싱
        content = list_obj.get("content") or {}
        entries = self._ensure_list(content.get("listEntry"))
        
        if not entries:
            # 빈 리스트라도 메타데이터는 저장
            row = base_info.copy()
            row["entry_value"] = None
            row["entry_type"] = "empty"
            self.lists_records.append(row)
        else:
            for entry in entries:
                self._parse_entry_recursive(entry, base_info)

    def parse(self):
        """XML 전체를 순회하며 모든 list 태그를 재귀적으로 발견"""
        self.lists_records = []
        self.processed_list_ids = set()

        def walk(obj):
            if isinstance(obj, dict):
                # 1. 'list' 태그 발견
                if "list" in obj:
                    self._process_list_node(obj["list"])
                
                # 2. 'entry' 하위의 'list' (libraryContent 구조)
                if "entry" in obj:
                    for e in self._ensure_list(obj["entry"]):
                        if isinstance(e, dict):
                            if "list" in e: self._process_list_node(e["list"])
                            if "string" in e:
                                self.lists_records.append({
                                    "list_id": "global_strings",
                                    "list_name": "Global_Strings",
                                    "entry_value": e["string"],
                                    "entry_type": "global"
                                })

                # 3. 모든 키에 대해 재귀 탐색
                for k, v in obj.items():
                    if k not in ["list", "entry"]:
                        if isinstance(v, (dict, list)): walk(v)
            
            elif isinstance(obj, list):
                for item in obj: walk(item)

        walk(self.data)
        return self.lists_records
