import json
import pandas as pd
import xmltodict
from typing import Any, List, Dict, Optional
from .condition_parser import ConditionParser

class PolicyParser:
    def __init__(self, source, from_xml: bool = False):
        if from_xml:
            parsed = xmltodict.parse(source)
            # libraryContent가 None이거나 ruleGroup이 없을 경우를 대비해 안전하게 추출
            lc = parsed.get("libraryContent") or {}
            self.data = lc.get("ruleGroup") or {}
        elif isinstance(source, dict):
            lc = source.get("libraryContent") or {}
            self.data = lc.get("ruleGroup") or {}
        else:
            raise ValueError("Invalid data source provided. Must be dict or XML string.")
        
        self.rulegroup_records = []
        self.rule_records = []

    def _ensure_list(self, value: Any) -> List:
        if value is None:
            return []
        if isinstance(value, list):
            return value
        return [value]

    def _parse_actions(self, obj: Dict[str, Any]) -> str:
        """actionContainer 및 immediateActionContainers 파싱하여 요약 문자열 반환"""
        actions = []
        
        # 1. 기본 액션 (actionContainer)
        ac = obj.get("actionContainer")
        if ac and isinstance(ac, dict):
            action_id = ac.get("@actionId", "UnknownAction")
            actions.append(f"Action: {action_id}")
        
        # 2. 즉시 실행 액션 (immediateActionContainers)
        iac = obj.get("immediateActionContainers") or {}
        if not isinstance(iac, dict):
            iac = {}
        
        # 2.1 Set Action
        for sac in self._ensure_list(iac.get("setActionContainer")):
            if isinstance(sac, dict):
                prop_id = sac.get("@propertyId", "UnknownProperty")
                actions.append(f"Set: {prop_id}")
            
        # 2.2 Execute Action (Procedures)
        for eac in self._ensure_list(iac.get("executeActionContainer")):
            if isinstance(eac, dict):
                proc_val = eac.get("procedureValue", {})
                proc_id = proc_val.get("@procedureId", "UnknownProcedure")
                actions.append(f"Execute: {proc_id}")
            
        # 2.3 Enable Engine Action
        for eec in self._ensure_list(iac.get("enableEngineActionContainer")):
            if isinstance(eec, dict):
                engine_id = eec.get("@engineId", "UnknownEngine")
                actions.append(f"EnableEngine: {engine_id}")
            
        return " | ".join(actions) if actions else "None"

    def parse_condition(self, condition_dict: dict):
        if not condition_dict or not isinstance(condition_dict, dict):
            return []
        try:
            return ConditionParser(condition_dict).to_rows()   # List[Dict]
        except Exception as e:
            return [{"error": str(e), "expression_text": "Error parsing condition"}]
    
    def parse(self):
        def walk(obj, stack=None):
            if stack is None:
                stack = []
            
            if isinstance(obj, dict):
                is_group = "@name" in obj and ("rules" in obj or "ruleGroups" in obj)
                current_name = obj.get("@name")
            
                # group 또는 rule 여부와 관계없이 파싱 대상인지 확인
                if is_group or "@name" in obj:
                    cond_container = obj.get("condition") or {}
                    parsed_conditions = self.parse_condition(cond_container)
                    if not parsed_conditions:
                        parsed_conditions = [{"expression_text": "Always"}]
                    
                    action_summary = self._parse_actions(obj) if not is_group else None
                    
                    for idx, cond in enumerate(parsed_conditions):
                        record = {
                            "id": obj.get("@id") if idx == 0 else "",
                            "name": obj.get("@name") if idx == 0 else "",
                            "enabled": obj.get("@enabled") if idx == 0 else "",
                            "description": obj.get("description") if idx == 0 else "",
                            "condition_text": cond.get("expression_text", "Always"),
                            "path": " > ".join(stack + [current_name] if current_name else stack)
                        }
                        if is_group:
                            record.update({
                                "type": "group",
                                "cloudSynced": obj.get("@cloudSynced"),
                                "acElements": str(obj.get("acElements")) if idx == 0 else ""
                            })
                            self.rulegroup_records.append(record)
                        else:
                            record.update({
                                "type": "rule",
                                "actions": action_summary if idx == 0 else "",
                                "group_path": " > ".join(stack) if idx == 0 else ""
                            })
                            self.rule_records.append(record)
                
                if is_group and current_name:
                    stack.append(current_name)
                
                # 하위 노드 탐색 (None 체크 강화)
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
                for item in obj:
                    walk(item, stack)
        
        walk(self.data)
        return self.rulegroup_records, self.rule_records
    
    def to_excel(self, group_path: str, rule_path: str):
        df_groups = pd.DataFrame(self.rulegroup_records)
        df_rules = pd.DataFrame(self.rule_records)
        df_groups.to_excel(group_path, index=False, engine="openpyxl")
        df_rules.to_excel(rule_path, index=False, engine="openpyxl")
