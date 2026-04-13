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
        if value is None:
            return []
        if isinstance(value, list):
            return value
        return [value]

    def _parse_complex_entry(self, complex_entry: Dict[str, Any]) -> Dict[str, Any]:
        """complexEntry 내부의 configurationProperties 추출"""
        props = {}
        if not complex_entry or not isinstance(complex_entry, dict):
            return props

        cp_container = complex_entry.get("configurationProperties") or {}
        if not isinstance(cp_container, dict):
            cp_container = {}

        config_props = self._ensure_list(cp_container.get("configurationProperty"))
        
        for p in config_props:
            if not isinstance(p, dict): continue
            key = p.get("@key")
            val = p.get("value", "")
            if key:
                props[f"prop_{key}"] = val
                if p.get("@encrypted") == "true":
                    props[f"prop_{key}_encrypted"] = True
                    
        return props

    def _parse_setup(self, setup_dict: Dict[str, Any]) -> Dict[str, Any]:
        """list 하위의 setup 정보 (connection, proxy, updateTime) 파싱"""
        setup_info = {}
        if not setup_dict or not isinstance(setup_dict, dict):
            return setup_info

        # 1. Connection
        conn = setup_dict.get("connection") or {}
        if isinstance(conn, dict):
            creds = conn.get("credentials") or {}
            if isinstance(creds, dict):
                setup_info["setup_conn_user"] = creds.get("username")
            setup_info["setup_conn_url"] = conn.get("url")

        # 2. Proxy
        proxy = setup_dict.get("proxy") or {}
        if isinstance(proxy, dict):
            creds = proxy.get("credentials") or {}
            if isinstance(creds, dict):
                setup_info["setup_proxy_user"] = creds.get("username")
            setup_info["setup_proxy_host"] = proxy.get("host")
            setup_info["setup_proxy_port"] = proxy.get("port")

        # 3. Update Time
        utime = setup_dict.get("updateTime") or {}
        if isinstance(utime, dict):
            hourly = utime.get("hourly") or {}
            if isinstance(hourly, dict):
                setup_info["setup_update_hourly_minute"] = hourly.get("@minute")

        return setup_info

    def parse(self):
        # libraryContent -> lists -> entry 구조
        lc = self.data.get("libraryContent") or {}
        lists_container = lc.get("lists") or {}
        if not isinstance(lists_container, dict):
            lists_container = {}
            
        entries = self._ensure_list(lists_container.get("entry"))

        for item in entries:
            if not isinstance(item, dict): continue
            
            list_obj = item.get("list") or {}
            if not isinstance(list_obj, dict): continue

            base_info = {
                "list_name": list_obj.get("@name"),
                "list_id": list_obj.get("@id"),
                "list_type_id": list_obj.get("@typeId"),
                "list_classifier": list_obj.get("@classifier"),
                "list_description": list_obj.get("description"),
                "list_mwg_version": list_obj.get("@mwg-version")
            }

            # Setup 정보 파싱
            setup_data = self._parse_setup(list_obj.get("setup") or {})
            base_info.update(setup_data)

            content = list_obj.get("content") or {}
            if not isinstance(content, dict): content = {}
            
            list_entries = self._ensure_list(content.get("listEntry"))

            # 엔트리가 없는 리스트라도 정보를 남기기 위해 처리
            if not list_entries:
                self.lists_records.append(base_info)
                continue

            for entry in list_entries:
                row = base_info.copy()
                
                # 1. 일반 텍스트 엔트리
                if isinstance(entry, str):
                    row["entry_value"] = entry
                
                # 2. 복합 객체 엔트리 (complexEntry)
                elif isinstance(entry, dict):
                    if "complexEntry" in entry:
                        ce = entry["complexEntry"]
                        row["entry_type"] = "complex"
                        row.update(self._parse_complex_entry(ce))
                    else:
                        row.update(entry)
                
                self.lists_records.append(row)
        
        return self.lists_records

    def to_excel(self, lists_path: str):
        if not self.lists_records:
            return
        df_lists = pd.DataFrame(self.lists_records)
        df_lists.to_excel(lists_path, index=False, engine="openpyxl")
