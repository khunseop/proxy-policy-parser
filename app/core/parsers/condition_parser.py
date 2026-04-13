import json
from typing import Any, Dict, List, Optional

class ConditionParser:
    def __init__(self, condition_dict: Dict[str, Any]):
        self.data = condition_dict or {}
        # expressions나 conditionExpression이 None일 경우를 대비해 안전하게 추출
        exp_container = self.data.get("expressions") or {}
        self.expressions = self._ensure_list(exp_container.get("conditionExpression") if isinstance(exp_container, dict) else [])

    def _ensure_list(self, value: Any) -> List:
        if value is None: return []
        if isinstance(value, list): return value
        return [value]

    def _stringify_property(self, prop: Dict[str, Any]) -> str:
        """propertyInstance를 문자열로 변환 (재귀적 파라미터 처리)"""
        if not prop or not isinstance(prop, dict): return "UnknownProperty"
        prop_id = prop.get("@propertyId", "Unknown")
        
        params_container = prop.get("parameters") or {}
        params = self._ensure_list(params_container.get("entry") if isinstance(params_container, dict) else [])
        
        if not params:
            return prop_id
            
        param_strs = []
        for entry in params:
            if not isinstance(entry, dict): continue
            param = entry.get("parameter") or {}
            val_obj = param.get("value") or {}
            
            # 파라미터 값이 또 다른 프로퍼티인 경우 (재귀)
            if isinstance(val_obj, dict) and "propertyInstance" in val_obj:
                param_strs.append(self._stringify_property(val_obj["propertyInstance"]))
            # 일반 값인 경우
            else:
                param_strs.append(self._stringify_value(val_obj))
                
        return f"{prop_id}({', '.join(param_strs)})"

    def _stringify_value(self, val_obj: Dict[str, Any]) -> str:
        """value 노드를 문자열로 변환"""
        if val_obj is None: return ""
        if isinstance(val_obj, str): return f'"{val_obj}"'
        if not isinstance(val_obj, dict): return str(val_obj)
        
        # List 참조인 경우
        if "listValue" in val_obj:
            lv = val_obj["listValue"] or {}
            return f"List({lv.get('@id', 'Unknown')})"
        
        # 일반 문자열인 경우
        if "stringValue" in val_obj:
            sv = val_obj["stringValue"] or {}
            return f'"{sv.get("@value", "")}"'
            
        return str(val_obj)

    def get_full_expression(self) -> str:
        """모든 conditionExpression을 괄호와 연산자를 고려하여 하나의 문자열로 합침"""
        if not self.expressions:
            return "Always" if self.data.get("@always") == "true" else "None"

        full_parts = []
        for i, exp in enumerate(self.expressions):
            if not isinstance(exp, dict): continue
            
            prefix = exp.get("@prefix", "") # "AND", "OR", "NOT" 등
            open_brp = "(" * int(exp.get("@openingBracketCount") or 0)
            close_brp = ")" * int(exp.get("@closingBracketCount") or 0)
            op = exp.get("@operatorId", "==")
            
            # 프로퍼티 추출
            prop_str = "Unknown"
            if "propertyInstance" in exp:
                prop_str = self._stringify_property(exp["propertyInstance"])
            
            # 비교 대상 값 추출
            val_str = ""
            param = exp.get("parameter") or {}
            if isinstance(param, dict):
                val_str = self._stringify_value(param.get("value"))

            # 조합
            part = ""
            if i > 0 and prefix:
                part += f" {prefix} "
            elif i > 0:
                part += " AND "
                
            part += f"{open_brp}{prop_str} {op} {val_str}{close_brp}"
            full_parts.append(part)

        return "".join(full_parts).strip()

    def to_rows(self):
        return [{"expression_text": self.get_full_expression()}]
