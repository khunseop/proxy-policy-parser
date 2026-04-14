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
        self._current_pk = 0 # 가상의 PK 추적 (parent_pk 매핑용)

    def _ensure_list(self, value: Any) -> List:
        if value is None: return []
        if isinstance(value, list): return value
        return [value]

    def _parse_entry_recursive(self, entry: Any, base_info: Dict[str, Any], parent_pk: Optional[int] = None):
        if not entry: return

        self._current_pk += 1
        current_pk = self._current_pk
        row = base_info.copy()
        row["_pk_auto"] = current_pk
        row["parent_entry_pk"] = parent_pk

        if isinstance(entry, str):
            row["entry_value"] = entry
            row["entry_type"] = "string"
            self.lists_records.append(row)
        elif isinstance(entry, dict):
            ce = entry.get("complexEntry")
            if ce:
                # complexEntry: 메타데이터를 포함하는 복합 객체
                row["entry_type"] = "complex"
                row["entry_value"] = ce.get("description") or ce.get("@id")
                row["entry_details"] = json.dumps(ce, ensure_ascii=False)
                self.lists_records.append(row)

                # [RECURSIVE] complexEntry 내부의 하위 엔트리
                for sub in self._ensure_list(ce.get("entry")):
                    self._parse_entry_recursive(sub, base_info, current_pk)

            elif "entry" in entry:
                # 단순 dict 형태: {"entry": "value", "description": "..."}
                # xmltodict가 <listEntry><entry>val</entry><description>desc</description></listEntry>를
                # {'entry': 'val', 'description': '...'} 으로 파싱하는 케이스
                simple_val = entry.get("entry")
                if isinstance(simple_val, str):
                    row["entry_value"] = simple_val
                    row["entry_type"] = "string"
                    row["entry_details"] = entry.get("description") or ""
                    self.lists_records.append(row)
                elif isinstance(simple_val, list):
                    # 동일 listEntry 내에 여러 <entry> 태그가 있는 경우
                    for sub_val in simple_val:
                        self._parse_entry_recursive(sub_val, base_info, current_pk)
                else:
                    row["entry_type"] = "object"
                    row["entry_value"] = str(simple_val)
                    self.lists_records.append(row)
            else:
                # 위 패턴에 해당하지 않는 기타 dict — 원본을 JSON으로 보존
                row["entry_type"] = "object"
                row["entry_value"] = None
                row["entry_details"] = json.dumps(entry, ensure_ascii=False)
                self.lists_records.append(row)

    def _process_list_node(self, list_obj: Dict[str, Any]):
        if not isinstance(list_obj, dict): return
        list_id = list_obj.get("@id")
        if not list_id or list_id in self.processed_list_ids: return
        self.processed_list_ids.add(list_id)

        base_info = {
            "list_id": list_id,
            "list_name": list_obj.get("@name"),
            "list_type_id": list_obj.get("@typeId"),
            "list_description": list_obj.get("description"),
            "list_classifier": list_obj.get("@classifier"),
            "list_feature": list_obj.get("@feature"),
            "list_structural": list_obj.get("@structuralList"),
            "list_system": list_obj.get("@systemList"),
            "list_version": list_obj.get("@version"),
            "list_mwg_version": list_obj.get("@mwg-version")
        }

        content = list_obj.get("content") or {}
        entries = self._ensure_list(content.get("listEntry"))
        if not entries:
            self._current_pk += 1
            row = base_info.copy()
            row["_pk_auto"] = self._current_pk
            row["entry_type"] = "empty"
            self.lists_records.append(row)
        else:
            for entry in entries:
                self._parse_entry_recursive(entry, base_info)

    def parse(self):
        self.lists_records = []
        self.processed_list_ids = set()
        self._current_pk = 0

        def walk(obj):
            if isinstance(obj, dict):
                if "list" in obj: self._process_list_node(obj["list"])
                if "entry" in obj:
                    for e in self._ensure_list(obj["entry"]):
                        if isinstance(e, dict):
                            if "list" in e: self._process_list_node(e["list"])
                            if "string" in e:
                                self._current_pk += 1
                                self.lists_records.append({
                                    "_pk_auto": self._current_pk,
                                    "list_id": "global_strings",
                                    "list_name": "Global_Strings",
                                    "entry_value": e["string"],
                                    "entry_type": "global"
                                })
                for k, v in obj.items():
                    if k not in ["list", "entry"] and isinstance(v, (dict, list)): walk(v)
            elif isinstance(obj, list):
                for item in obj: walk(item)

        walk(self.data)
        return self.lists_records
