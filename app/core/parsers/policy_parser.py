import json
import pandas as pd
import xmltodict
from .condition_parser import ConditionParser

class PolicyParser:
    def __init__(self, source, from_xml: bool = False):
        if from_xml:
            parsed = xmltodict.parse(source)
            self.data = parsed.get("libraryContent", {}).get("ruleGroup", {})
        elif isinstance(source, dict):
            self.data = source.get("libraryContent", {}).get("ruleGroup", {})
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
        if ac:
            action_id = ac.get("@actionId", "UnknownAction")
            actions.append(f"Action: {action_id}")
        
        # 2. 즉시 실행 액션 (immediateActionContainers)
        iac = obj.get("immediateActionContainers", {})
        
        # 2.1 Set Action
        for sac in self._ensure_list(iac.get("setActionContainer")):
            prop_id = sac.get("@propertyId", "UnknownProperty")
            # 간단한 값 추출 시도 (ConditionParser의 로직 재사용 가능하나 여기선 약식으로)
            actions.append(f"Set: {prop_id}")
            
        # 2.2 Execute Action (Procedures)
        for eac in self._ensure_list(iac.get("executeActionContainer")):
            proc_val = eac.get("procedureValue", {})
            proc_id = proc_val.get("@procedureId", "UnknownProcedure")
            actions.append(f"Execute: {proc_id}")
            
        # 2.3 Enable Engine Action
        for eec in self._ensure_list(iac.get("enableEngineActionContainer")):
            engine_id = eec.get("@engineId", "UnknownEngine")
            actions.append(f"EnableEngine: {engine_id}")
            
        return " | ".join(actions) if actions else "None"

    def parse_condition(self, condition_dict: dict):
        try:
            return ConditionParser(condition_dict).to_rows()   # List[Dict]
        except Exception as e:
            return [{"error": str(e)}]
    
    def parse(self):
        def walk(obj, stack=None):
            if stack is None:
                stack = []
            
            if isinstance(obj, dict):
                is_group = "@name" in obj and ("rules" in obj or "ruleGroups" in obj)
                current_name = obj.get("@name")
            
                # group 또는 rule 여부와 관계없이 condition이 있으면 파싱
                if is_group or "@name" in obj:
                    parsed_conditions = self.parse_condition(obj.get("condition", {}))
                    if not parsed_conditions:
                        # 조건이 없는 경우 기본 행 생성
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
                
                # 하위 노드 탐색
                if "ruleGroups" in obj:
                    for rg in self._ensure_list(obj["ruleGroups"].get("ruleGroup")):
                        walk(rg, stack)
                if "rules" in obj:
                    for r in self._ensure_list(obj["rules"].get("rule")):
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
