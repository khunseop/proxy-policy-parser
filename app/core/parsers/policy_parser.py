import json
import pandas as pd
import xmltodict
from typing import Any, List, Dict, Optional
from .condition_parser import ConditionParser

class PolicyParser:
    def __init__(self, source, from_xml: bool = False):
        if from_xml:
            parsed = xmltodict.parse(source)
            lc = parsed.get("libraryContent") or {}
            self.data = lc.get("ruleGroup") or {}
        elif isinstance(source, dict):
            lc = source.get("libraryContent") or {}
            self.data = lc.get("ruleGroup") or {}
        else:
            raise ValueError("Invalid data source provided. Must be dict or XML string.")
        
        self.all_records = []
        self.max_level = 0

    def _ensure_list(self, value: Any) -> List:
        if value is None: return []
        if isinstance(value, list): return value
        return [value]

    def _parse_actions(self, obj: Dict[str, Any]) -> Dict[str, str]:
        """actionContainer 및 immediateActionContainers 파싱하여 상세 정보 반환"""
        summaries = []
        details = {"action_id": "", "action_conf_id": ""}
        
        # 1. 기본 액션
        ac = obj.get("actionContainer")
        if ac and isinstance(ac, dict):
            details["action_id"] = ac.get("@actionId", "")
            details["action_conf_id"] = ac.get("@configurationId", "")
            summaries.append(f"Action: {details['action_id']}")
        
        # 2. 즉시 실행 액션
        iac = obj.get("immediateActionContainers") or {}
        if isinstance(iac, dict):
            for sac in self._ensure_list(iac.get("setActionContainer")):
                if isinstance(sac, dict): summaries.append(f"Set: {sac.get('@propertyId')}")
            for eac in self._ensure_list(iac.get("executeActionContainer")):
                if isinstance(eac, dict): summaries.append(f"Execute: {eac.get('procedureValue', {}).get('@procedureId')}")
            for eec in self._ensure_list(iac.get("enableEngineActionContainer")):
                if isinstance(eec, dict): summaries.append(f"EnableEngine: {eec.get('@engineId')}")
            
        details["action_summary"] = " | ".join(summaries) if summaries else "None"
        return details

    def parse_condition(self, condition_dict: dict):
        if not condition_dict or not isinstance(condition_dict, dict):
            return []
        try:
            return ConditionParser(condition_dict).to_rows()
        except Exception as e:
            return [{"error": str(e), "expression_text": "Error parsing condition"}]
    
    def parse(self):
        def walk(obj, stack=None):
            if stack is None: stack = []
            
            if isinstance(obj, dict):
                is_group = "@name" in obj and ("rules" in obj or "ruleGroups" in obj)
                current_name = obj.get("@name")
                current_level = len(stack) + 1
                self.max_level = max(self.max_level, current_level)
            
                if is_group or "@name" in obj:
                    cond_container = obj.get("condition") or {}
                    parsed_conditions = self.parse_condition(cond_container)
                    if not parsed_conditions:
                        parsed_conditions = [{"expression_text": "Always"}]
                    
                    action_info = self._parse_actions(obj) if not is_group else {}
                    
                    for idx, cond in enumerate(parsed_conditions):
                        record = {
                            "Type": "Group" if is_group else "Rule",
                            "Level": current_level,
                            "ID": obj.get("@id") if idx == 0 else "",
                            "Name": obj.get("@name") if idx == 0 else "",
                            "Enabled": obj.get("@enabled") if idx == 0 else "",
                            "Condition": cond.get("expression_text", "Always"),
                            "Actions": action_info.get("action_summary", "") if idx == 0 else "",
                            "ActionID": action_info.get("action_id", "") if idx == 0 else "",
                            "ActionConfigID": action_info.get("action_conf_id", "") if idx == 0 else "",
                            "Path": " > ".join(stack + [current_name] if current_name else stack),
                            "CloudSynced": obj.get("@cloudSynced", ""),
                            "CycleRequest": obj.get("@cycleRequest", ""),
                            "CycleResponse": obj.get("@cycleResponse", ""),
                            "CycleEmbedded": obj.get("@cycleEmbeddedObject", ""),
                            "DefaultRights": obj.get("@defaultRights", ""),
                            "Description": obj.get("description", "") if idx == 0 else ""
                        }
                        
                        # Staircase 컬럼
                        for i in range(1, current_level):
                            record[f"L{i}"] = stack[i-1] if i-1 < len(stack) else ""
                        record[f"L{current_level}"] = current_name
                        
                        self.all_records.append(record)
                
                if is_group and current_name:
                    stack.append(current_name)
                
                rg_container = obj.get("ruleGroups") or {}
                if isinstance(rg_container, dict):
                    for rg in self._ensure_list(rg_container.get("ruleGroup")):
                        walk(rg, stack)
                
                r_container = obj.get("rules") or {}
                if isinstance(r_container, dict):
                    for r in self._ensure_list(r_container.get("rule")):
                        walk(r, stack)
                
                if is_group and current_name:
                    stack.pop()
                
            elif isinstance(obj, list):
                for item in obj: walk(item, stack)
        
        walk(self.data)
        
        # 컬럼 순서 조정
        final_records = []
        for rec in self.all_records:
            ordered_rec = {}
            # L1, L2... 컬럼 먼저 배치
            for i in range(1, self.max_level + 1):
                col = f"L{i}"
                ordered_rec[col] = rec.get(col, "")
            
            # 나머지 핵심 컬럼
            core_fields = ["Type", "Name", "Enabled", "Condition", "Actions", "Path", "ID", 
                           "ActionID", "ActionConfigID", "CloudSynced", "CycleRequest", 
                           "CycleResponse", "CycleEmbedded", "DefaultRights", "Description"]
            for field in core_fields:
                ordered_rec[field] = rec.get(field, "")
            
            final_records.append(ordered_rec)
            
        self.all_records = final_records
        return self.all_records

    def to_excel(self, output_path: str):
        pd.DataFrame(self.all_records).to_excel(output_path, index=False, engine="openpyxl")
