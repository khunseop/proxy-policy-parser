import json
import pandas as pd
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
    
    def _ensure_list(self, value: Any) -> List:
        if value is None: return []
        if isinstance(value, list): return value
        return [value]

    def _parse_complex_entry(self, complex_entry: Dict[str, Any]) -> Dict[str, Any]:
        """complexEntry 내부의 모든 정보 추출"""
        props = {}
        if not complex_entry or not isinstance(complex_entry, dict): return props

        # acElements, defaultRights 등 추출
        props["entry_ac_elements"] = str(complex_entry.get("acElements", ""))
        props["entry_default_rights"] = complex_entry.get("@defaultRights")

        cp_container = complex_entry.get("configurationProperties") or {}
        if not isinstance(cp_container, dict): cp_container = {}

        config_props = self._ensure_list(cp_container.get("configurationProperty"))
        for p in config_props:
            if not isinstance(p, dict): continue
            key = p.get("@key")
            val = p.get("value") or p.get("@value", "")
            if key:
                props[f"prop_{key}"] = val
                if p.get("@encrypted") == "true": props[f"prop_{key}_encrypted"] = True
                if p.get("@listType"): props[f"prop_{key}_listType"] = p.get("@listType")
                if p.get("@type"): props[f"prop_{key}_type"] = p.get("@type")
                    
        return props

    def _parse_setup(self, setup_dict: Dict[str, Any]) -> Dict[str, Any]:
        """list 하위의 setup 정보 (connection, proxy, updateTime) 파싱"""
        setup_info = {}
        if not setup_dict or not isinstance(setup_dict, dict): return setup_info

        # Connection
        conn = setup_dict.get("connection") or {}
        if isinstance(conn, dict):
            creds = conn.get("credentials") or {}
            if isinstance(creds, dict): setup_info["setup_conn_user"] = creds.get("username")
            setup_info["setup_conn_url"] = conn.get("url")

        # Proxy
        proxy = setup_dict.get("proxy") or {}
        if isinstance(proxy, dict):
            creds = proxy.get("credentials") or {}
            if isinstance(creds, dict): setup_info["setup_proxy_user"] = creds.get("username")
            setup_info["setup_proxy_host"] = proxy.get("host")
            setup_info["setup_proxy_port"] = proxy.get("port")

        # Update Time
        utime = setup_dict.get("updateTime") or {}
        if isinstance(utime, dict):
            hourly = utime.get("hourly") or {}
            if isinstance(hourly, dict): setup_info["setup_update_hourly_minute"] = hourly.get("@minute")

        return setup_info

    def parse(self):
        lc = self.data.get("libraryContent") or {}
        lists_container = lc.get("lists") or {}
        entries = self._ensure_list(lists_container.get("entry"))

        for item in entries:
            if not isinstance(item, dict): continue
            
            # 1. list 가 아닌 직접 string 엔트리가 있는 경우 처리
            if "string" in item:
                self.lists_records.append({"list_name": "Global_Strings", "entry_value": item["string"]})
                continue

            list_obj = item.get("list") or {}
            if not isinstance(list_obj, dict): continue

            base_info = {
                "list_name": list_obj.get("@name"),
                "list_id": list_obj.get("@id"),
                "list_type_id": list_obj.get("@typeId"),
                "list_classifier": list_obj.get("@classifier"),
                "list_feature": list_obj.get("@feature"),
                "list_structural": list_obj.get("@structuralList"),
                "list_sub_id": list_obj.get("@subId"),
                "list_system": list_obj.get("@systemList"),
                "list_version": list_obj.get("@version"),
                "list_default_rights": list_obj.get("@defaultRights"),
                "list_ac_elements": str(list_obj.get("acElements", "")),
                "list_description": list_obj.get("description"),
                "list_mwg_version": list_obj.get("@mwg-version")
            }

            base_info.update(self._parse_setup(list_obj.get("setup") or {}))

            content = list_obj.get("content") or {}
            if not isinstance(content, dict): content = {}
            list_entries = self._ensure_list(content.get("listEntry"))

            if not list_entries:
                self.lists_records.append(base_info)
                continue

            for entry in list_entries:
                row = base_info.copy()
                if isinstance(entry, str):
                    row["entry_value"] = entry
                elif isinstance(entry, dict):
                    if "complexEntry" in entry:
                        row["entry_type"] = "complex"
                        row.update(self._parse_complex_entry(entry["complexEntry"]))
                    else:
                        row.update(entry)
                self.lists_records.append(row)
        
        return self.lists_records
    
    def to_excel(self, lists_path: str):
        if not self.lists_records: return
        pd.DataFrame(self.lists_records).to_excel(lists_path, index=False, engine="openpyxl")
