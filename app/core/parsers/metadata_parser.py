import pandas as pd
from typing import Any, Dict, List, Optional

class MetadataParser:
    def __init__(self, source_dict: Dict[str, Any]):
        self.data = source_dict.get("libraryContent") or {}
        self.config_records = []
        self.lib_info = {}

    def parse(self) -> Dict[str, Any]:
        # 1. libraryObject 정보
        lib_obj = self.data.get("libraryObject") or {}
        self.lib_info = {
            "name": lib_obj.get("name") if isinstance(lib_obj, dict) else None,
            "description": lib_obj.get("description") if isinstance(lib_obj, dict) else None,
            "version": lib_obj.get("version") if isinstance(lib_obj, dict) else None
        }

        # 2. configurations 정보 (Exhaustive)
        configs = self.data.get("configurations") or {}
        if isinstance(configs, dict):
            for conf in self._ensure_list(configs.get("configuration")):
                if not isinstance(conf, dict): continue
                
                base_conf = {
                    "conf_name": conf.get("@name"),
                    "conf_id": conf.get("@id"),
                    "mwg_version": conf.get("@mwg-version"),
                    "target_id": conf.get("@targetId"),
                    "template_id": conf.get("@templateId"),
                    "version": conf.get("@version"),
                    "default_rights": conf.get("@defaultRights"),
                    "ac_elements": str(conf.get("acElements", "")),
                    "description": conf.get("description")
                }
                
                # configurationProperties 추출
                cp_container = conf.get("configurationProperties") or {}
                if not isinstance(cp_container, dict): cp_container = {}
                
                props = self._ensure_list(cp_container.get("configurationProperty"))
                
                if not props:
                    self.config_records.append(base_conf)
                else:
                    for p in props:
                        if not isinstance(p, dict): continue
                        row = base_conf.copy()
                        row.update({
                            "prop_key": p.get("@key"),
                            "prop_value": p.get("value"),
                            "prop_type": p.get("@type"),
                            "prop_list_type": p.get("@listType"),
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
