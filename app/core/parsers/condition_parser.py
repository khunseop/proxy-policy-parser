import json
from typing import Any, Dict, List, Optional
from app.services.xml_utils import strip_scur

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
        prop_id = strip_scur(prop.get("@propertyId", "Unknown"))
        
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

    def _stringify_parameter(self, param: Dict[str, Any]) -> str:
        """parameter 노드를 문자열로 변환.

        Form A: parameter에 @valueId / @listTypeId 등이 직접 붙는 경우 (value 하위 노드 없음)
        Form B: parameter > value > (stringValue | listValue) 하위 노드가 있는 경우
        """
        if not param or not isinstance(param, dict):
            return ""

        # Form B — value 하위 노드 우선 처리
        if "value" in param:
            return self._stringify_value(param["value"])

        # Form A — 직접 속성값 (com.scur. 접두사 제거 후 표시)
        list_type_id = param.get("@listTypeId")
        if list_type_id:
            return f"List({list_type_id})"  # List ID는 resolution 대상이므로 원본 유지

        value_id = param.get("@valueId")
        if value_id:
            return f'"{strip_scur(value_id)}"'

        type_id = param.get("@typeId")
        if type_id:
            return f"Type({strip_scur(type_id)})"

        return ""

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
            op = strip_scur(exp.get("@operatorId", "=="))
            
            # 프로퍼티 추출
            prop_str = "Unknown"
            if "propertyInstance" in exp:
                prop_str = self._stringify_property(exp["propertyInstance"])
            
            # 비교 대상 값 추출 (Form A/B 모두 처리)
            val_str = ""
            param = exp.get("parameter") or {}
            if isinstance(param, dict):
                val_str = self._stringify_parameter(param)

            # 조합
            # i==0이어도 "NOT" prefix가 있을 수 있으므로 인덱스와 무관하게 처리
            part = ""
            if i == 0:
                if prefix:
                    part += f"{prefix} "
            else:
                part += f" {prefix} " if prefix else " AND "

            part += f"{open_brp}{prop_str} {op} {val_str}{close_brp}"
            full_parts.append(part)

        return "".join(full_parts).strip()

    def _raw_parameter(self, param: Dict[str, Any]) -> Dict[str, Any]:
        """parameter 노드를 손실 없이 dict로 변환 (Form A / Form B 모두)."""
        if not param or not isinstance(param, dict):
            return {}

        # Form B — value 하위 노드
        if "value" in param:
            val = param["value"] or {}
            if isinstance(val, dict):
                if "listValue" in val:
                    lv = val["listValue"] or {}
                    return {"form": "B", "type": "list", "listRef": lv.get("@id")}
                if "stringValue" in val:
                    sv = val["stringValue"] or {}
                    return {
                        "form": "B", "type": "string",
                        "value": sv.get("@value"),
                        "typeId": sv.get("@typeId"),
                        "stringModifier": sv.get("@stringModifier"),
                    }
            return {"form": "B", "type": "unknown", "raw": str(val)}

        # Form A — 직접 속성
        return {
            "form": "A",
            "typeId": param.get("@typeId"),
            "valueId": param.get("@valueId"),
            "valueTyp": param.get("@valueTyp"),
            "listTypeId": param.get("@listTypeId"),
        }

    def _raw_property(self, prop: Dict[str, Any]) -> Dict[str, Any]:
        """propertyInstance를 손실 없이 dict로 변환 (재귀 포함)."""
        if not prop or not isinstance(prop, dict):
            return {}
        result = {
            "propertyId": prop.get("@propertyId"),
            "configurationId": prop.get("@configurationId"),
            "useMostRecentConfiguration": prop.get("@useMostRecentConfiguration"),
        }
        params_container = prop.get("parameters") or {}
        entries = self._ensure_list(
            params_container.get("entry") if isinstance(params_container, dict) else []
        )
        raw_params = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            param = entry.get("parameter") or {}
            val_obj = param.get("value") or {}
            if isinstance(val_obj, dict) and "propertyInstance" in val_obj:
                raw_params.append({"type": "property", "property": self._raw_property(val_obj["propertyInstance"])})
            else:
                raw_params.append(self._raw_parameter(param))
        if raw_params:
            result["parameters"] = raw_params
        return result

    def to_raw_dict(self) -> Dict[str, Any]:
        """조건 전체를 ID 손실 없이 구조화된 dict로 반환.

        Condition 컬럼(사람이 읽을 수 있는 텍스트)과 별도로 ConditionRaw(JSON)에 저장하여,
        list ID 검색, 정책 비교(Diff), 향후 해석(resolution) 용도로 활용한다.
        """
        if not self.expressions:
            return {"always": self.data.get("@always") == "true", "expressions": []}

        raw_expressions = []
        for exp in self.expressions:
            if not isinstance(exp, dict):
                continue
            entry: Dict[str, Any] = {
                "prefix": exp.get("@prefix"),
                "openBrackets": int(exp.get("@openingBracketCount") or 0),
                "closeBrackets": int(exp.get("@closingBracketCount") or 0),
                "operatorId": exp.get("@operatorId"),
            }
            if "propertyInstance" in exp:
                entry["property"] = self._raw_property(exp["propertyInstance"])
            param = exp.get("parameter") or {}
            if isinstance(param, dict):
                entry["parameter"] = self._raw_parameter(param)
            raw_expressions.append(entry)

        return {"always": False, "expressions": raw_expressions}

    def to_rows(self):
        return [{"expression_text": self.get_full_expression()}]
