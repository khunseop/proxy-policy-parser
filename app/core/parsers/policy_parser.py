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
        
        # 모든 레코드를 실행 순서대로 저장하는 단일 리스트
        self.all_records = []
        self.max_level = 0

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
                current_level = len(stack) + 1
                self.max_level = max(self.max_level, current_level)
            
                # 1. 현재 노드(Group 또는 Rule) 파싱
                if is_group or "@name" in obj:
                    cond_container = obj.get("condition") or {}
                    parsed_conditions = self.parse_condition(cond_container)
                    if not parsed_conditions:
                        parsed_conditions = [{"expression_text": "Always"}]
                    
                    action_summary = self._parse_actions(obj) if not is_group else ""
                    
                    for idx, cond in enumerate(parsed_conditions):
                        record = {
                            "type": "Group" if is_group else "Rule",
                            "level": current_level,
                            "id": obj.get("@id") if idx == 0 else "",
                            "name": obj.get("@name") if idx == 0 else "",
                            "enabled": obj.get("@enabled") if idx == 0 else "",
                            "condition": cond.get("expression_text", "Always"),
                            "actions": action_summary if idx == 0 else "",
                            "path": " > ".join(stack + [current_name] if current_name else stack),
                            "description": obj.get("description") if idx == 0 else ""
                        }
                        
                        # Staircase Columns (Level 1, Level 2...) 추가
                        for i in range(1, current_level):
                            record[f"Level {i}"] = stack[i-1] if i-1 < len(stack) else ""
                        record[f"Level {current_level}"] = current_name
                        
                        self.all_records.append(record)
                
                # 2. 하위 노드 탐색 (실행 순서 보존을 위해 RuleGroup -> Rule 순서로 탐색)
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
        
        # 탐색 시작
        walk(self.data)
        
        # 3. 엑셀 출력 시 가독성을 위해 Staircase 컬럼들을 왼쪽으로 정렬
        final_records = []
        for rec in self.all_records:
            # 모든 레코드가 동일한 수의 Level 컬럼을 갖도록 보정
            for i in range(1, self.max_level + 1):
                col_name = f"Level {i}"
                if col_name not in rec:
                    rec[col_name] = ""
            
            # 컬럼 순서 재배치 (Level -> Type -> Name -> Enabled -> Condition -> Actions -> Path)
            ordered_rec = {}
            for i in range(1, self.max_level + 1):
                ordered_rec[f"Level {i}"] = rec[f"Level {i}"]
            
            ordered_rec.update({
                "Type": rec["type"],
                "Name": rec["name"],
                "Enabled": rec["enabled"],
                "Condition": rec["condition"],
                "Actions": rec["actions"],
                "Path": rec["path"],
                "ID": rec["id"],
                "Description": rec["description"]
            })
            final_records.append(ordered_rec)
            
        self.all_records = final_records
        return self.all_records
    
    def to_excel(self, output_path: str):
        df = pd.DataFrame(self.all_records)
        df.to_excel(output_path, index=False, engine="openpyxl")
