import json
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

    def _ensure_list(self, value: Any) -> List:
        if value is None: return []
        if isinstance(value, list): return value
        return [value]

    def _extract_list_refs_recursive(self, obj: Any) -> List[str]:
        """객체 내부를 끝까지 순회하며 모든 리스트 참조(ID, TypeID) 추출"""
        refs = []
        if isinstance(obj, dict):
            # 1. listValue 직접 참조
            if "listValue" in obj:
                lv = obj["listValue"] or {}
                if isinstance(lv, dict) and "@id" in lv:
                    refs.append(f"List({lv['@id']})")
            
            # 2. @listTypeId 또는 @typeId 참조 (내장 리스트 등)
            if "@listTypeId" in obj:
                refs.append(f"List({obj['@listTypeId']})")
            elif "@typeId" in obj:
                tid = str(obj['@typeId'])
                if tid.startswith('com.scur.'): refs.append(f"List({tid})")

            # 3. 자식 노드 재귀 탐색 (Action 내의 parameters 등)
            for v in obj.values():
                refs.extend(self._extract_list_refs_recursive(v))
        elif isinstance(obj, list):
            for item in obj:
                refs.extend(self._extract_list_refs_recursive(item))
        return refs

    def _parse_actions(self, obj: Dict[str, Any]) -> str:
        """액션을 분석하고 그 안의 리스트 참조까지 요약 텍스트로 반환"""
        summaries = []
        
        # 기본 액션
        ac = obj.get("actionContainer")
        if ac and isinstance(ac, dict):
            summaries.append(f"Action: {ac.get('@actionId')}")
        
        # 즉시 실행 액션 (RECURSIVE 요소 포함)
        iac = obj.get("immediateActionContainers") or {}
        if isinstance(iac, dict):
            # Set Action
            for sac in self._ensure_list(iac.get("setActionContainer")):
                if isinstance(sac, dict):
                    prop = sac.get('@propertyId', 'Unknown')
                    refs = self._extract_list_refs_recursive(sac)
                    ref_str = f" [{', '.join(set(refs))}]" if refs else ""
                    summaries.append(f"Set: {prop}{ref_str}")
            
            # Execute
            for eac in self._ensure_list(iac.get("executeActionContainer")):
                if isinstance(eac, dict):
                    proc = eac.get('procedureValue', {}).get('@procedureId', 'Unknown')
                    summaries.append(f"Execute: {proc}")

        return " | ".join(summaries) if summaries else "None"

    def parse(self):
        """정책 트리를 재귀적으로 순회하며 고정된 스키마로 추출"""
        self.all_records = []

        def walk(obj, stack=None):
            if stack is None: stack = []
            
            if isinstance(obj, dict):
                # ruleGroup 또는 rule 식별 (둘 다 @name을 가짐)
                current_name = obj.get("@name")
                if not current_name: return # 유효하지 않은 노드

                is_group = "rules" in obj or "ruleGroups" in obj
                current_path = " > ".join(stack + [current_name])
                parent_path = " > ".join(stack)

                # 조건 파싱
                cond_container = obj.get("condition") or {}
                condition_text = ConditionParser(cond_container).get_full_expression()
                
                # 액션 및 액션 내 리스트 참조 파싱
                actions_text = self._parse_actions(obj) if not is_group else ""

                record = {
                    "Type": "Group" if is_group else "Rule",
                    "Name": current_name,
                    "Path": current_path,
                    "ParentPath": parent_path,
                    "Condition": condition_text,
                    "Actions": actions_text,
                    "PolicyID": obj.get("@id"),
                    "Enabled": obj.get("@enabled", "true"),
                    "Description": obj.get("description", ""),
                    "Level": len(stack) + 1
                }
                self.all_records.append(record)

                # 재귀 탐색
                new_stack = stack + [current_name]
                
                rg_container = obj.get("ruleGroups") or {}
                for rg in self._ensure_list(rg_container.get("ruleGroup")):
                    walk(rg, new_stack)
                
                r_container = obj.get("rules") or {}
                for r in self._ensure_list(r_container.get("rule")):
                    walk(r, new_stack)
                
            elif isinstance(obj, list):
                for item in obj: walk(item, stack)

        walk(self.data)
        return self.all_records
