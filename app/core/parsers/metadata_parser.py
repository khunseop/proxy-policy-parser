import pandas as pd
from typing import Any, Dict, List, Optional

class MetadataParser:
    def __init__(self, source_dict: Dict[str, Any]):
        self.data = source_dict.get("libraryContent", {})
        self.config_records = []
        self.lib_info = {}

    def parse(self) -> Dict[str, Any]:
        # 1. libraryObject 정보
        lib_obj = self.data.get("libraryObject", {})
        self.lib_info = {
            "name": lib_obj.get("name"),
            "description": lib_obj.get("description"),
            "version": lib_obj.get("version")
        }

        # 2. configurations 정보
        configs = self.data.get("configurations", {})
        if configs:
            for conf in self._ensure_list(configs.get("configuration")):
                base_conf = {
                    "conf_name": conf.get("@name"),
                    "conf_id": conf.get("@id"),
                    "mwg_version": conf.get("@mwg-version"),
                    "target_id": conf.get("@targetId"),
                    "description": conf.get("description")
                }
                
                # configurationProperties 추출
                props = self._ensure_list(conf.get("configurationProperties", {}).get("configurationProperty", []))
                if not props:
                    self.config_records.append(base_conf)
                else:
                    for p in props:
                        row = base_conf.copy()
                        row.update({
                            "prop_key": p.get("@key"),
                            "prop_value": p.get("value"),
                            "prop_type": p.get("@type"),
                            "prop_encrypted": p.get("@encrypted")
                        })
                        self.config_records.append(row)
        
        return {
            "library_info": self.lib_info,
            "config_details": self.config_records
        }

    def _ensure_list(self, value: Any) -> List:
        if value is None: return []
        if isinstance(value, list): return value
        return [value]
