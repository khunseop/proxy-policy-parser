from typing import Any, Dict, List, Optional, Union

class ConditionParser:
    def __init__(self, condition: Optional[Dict[str, Any]]) -> None:
        self.condition = condition
        self.parsed = self.parse_condition(condition)

    @classmethod
    def ensure_list(cls, value: Union[Dict, List, None]) -> List:
        if value is None:
            return []
        if isinstance(value, list):
            return value
        return [value]

    def parse_condition(self, condition: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not condition:
            return []
        expressions_container = condition.get("expressions")
        if not isinstance(expressions_container, dict):
            return []
        expressions = self.ensure_list(expressions_container.get("conditionExpression"))
        return [self.parse_expression(expr) for expr in expressions if isinstance(expr, dict)]
    
    def _stringify_property(self, prop_instance: Dict[str, Any]) -> str:
        """propertyInstance 구조를 문자열로 변환 (재귀 지원)"""
        prop_id = prop_instance.get("@propertyId", "<unknown>")
        params = self.ensure_list(prop_instance.get("parameters", {}).get("entry", []))
        
        if not params:
            return prop_id
        
        param_strs = []
        for entry in params:
            key = entry.get("string")
            param_val = entry.get("parameter", {}).get("value", {})
            
            val_str = "None"
            if "stringValue" in param_val:
                val_str = f'"{param_val["stringValue"].get("@value")}"'
            elif "listValue" in param_val:
                val_str = f'List(ID:{param_val["listValue"].get("@id")})'
            elif "propertyInstance" in param_val:
                val_str = self._stringify_property(param_val["propertyInstance"])
            
            param_strs.append(f"{key}={val_str}" if key else val_str)
            
        return f"{prop_id}({', '.join(param_strs)})"

    def _stringify_value(self, param: Dict[str, Any]) -> str:
        """parameter/value 구조를 문자열로 변환 (재귀 지원)"""
        if not param:
            return "None"
        
        # meta-value (valueId, typeId 등) 처리
        if "@valueId" in param:
            return str(param["@valueId"])

        value = param.get("value", {})
        if "stringValue" in value:
            return f'"{value["stringValue"].get("@value")}"'
        elif "listValue" in value:
            return f'List(ID:{value["listValue"].get("@id")})'
        elif "propertyInstance" in value:
            return self._stringify_property(value["propertyInstance"])
        
        return "Unknown"

    def parse_expression(self, expr: Dict[str, Any]) -> Dict[str, Any]:
        prop_instance = expr.get("propertyInstance", {})
        has_prop_parameters = "parameters" in prop_instance

        # 기존 로직 유지 (데이터 추출용)
        property_parameters = self.parse_property_parameters(
            prop_instance.get("parameters", {})
        ) if has_prop_parameters else []

        expression_parameter = self.parse_expression_parameter(expr, has_prop_parameters)

        if not expression_parameter and "parameter" in prop_instance:
            expression_parameter = self.parse_single_property_parameter(prop_instance["parameter"])
        
        values = [
            v.get("value") if v["value_kind"] == "string" else v.get("list_id")
            for v in property_parameters
            if v["value_kind"] in ("string", "list")
        ]

        # 고도화: 문자열 형태의 조건식 생성
        prop_str = self._stringify_property(prop_instance)
        operator = expr.get("@operatorId", "equals")
        val_str = self._stringify_value(expr.get("parameter", {}))
        
        prefix = expr.get("@prefix", "")
        opening = "(" * int(expr.get("@openingBracketCount", 0))
        closing = ")" * int(expr.get("@closingBracketCount", 0))
        
        full_expression = f"{prefix} {opening}{prop_str} {operator} {val_str}{closing}".strip()

        return {
            "prefix": prefix,
            "open_bracket": int(expr.get("@openingBracketCount", 0)),
            "close_bracket": int(expr.get("@closingBracketCount", 0)),
            "property": prop_instance.get("@propertyId", "<unknown>"),
            "operator": operator,
            "property_values": tuple(values) if len(values) > 1 else (values[0] if values else None),
            "expression_value": expression_parameter.get("value") if expression_parameter else None,
            "expression_mode": expression_parameter.get("mode") if expression_parameter else None,
            "expression_text": full_expression  # 엑셀용 평탄화 문자열 추가
        }
    
    # 기존 parse_single_property_parameter, parse_property_parameters, parse_expression_parameter 메서드는 
    # 하위 호환성을 위해 유지하되 로직은 stringify와 유사하게 작동하도록 보존
    
    def parse_single_property_parameter(self, param: Dict[str, Any]) -> Dict[str, Any]:
        value_type = param.get("@valueType")
        value = param.get("value", {})

        if "stringValue" in value:
            sv = value["stringValue"]
            return {
                "mode": "value",
                "value_type": value_type,
                "value_kind": "string",
                "value": sv.get("@value"),
                "modifier": sv.get("@stringModifier"),
                "type_id": sv.get("@typeId")
            }
        elif "listValue" in value:
            lv = value["listValue"]
            return {
                "mode": "value",
                "value_type": value_type,
                "value_kind": "list",
                "list_id": lv.get("@id")
            }
        elif "propertyInstance" in value:
            nested_prop = value["propertyInstance"]
            nested_params = self.parse_property_parameters(nested_prop.get("parameters", {}))
            return {
                "mode": "nested_property",
                "value_type": value_type,
                "property": nested_prop.get("@propertyId"),
                "parameters": nested_params
            }
        else:
            return {
                "mode": "unknown",
                "value_type": value_type,
                "raw_value": value
            }
    
    def parse_property_parameters(self, parameters: Dict[str, Any]) -> List[Dict[str, Any]]:
        entries = self.ensure_list(parameters.get("entry"))
        results = []

        for entry in entries:
            key = entry.get("string")
            param = entry.get("parameter", {})
            value_type = param.get("@valueType")
            value = param.get("value", {})

            if "propertyInstance" in value:
                nested_prop = value["propertyInstance"]
                nested_params = self.parse_property_parameters(nested_prop.get("parameters", {}))
                results.append({
                    "key": key,
                    "value_type": value_type,
                    "value_kind": "nested_property",
                    "property": nested_prop.get("@propertyId"),
                    "parameters": nested_params
                })
            elif "stringValue" in value:
                sv = value["stringValue"]
                results.append({
                    "key": key,
                    "value_type": value_type,
                    "value_kind": "string",
                    "value": sv.get("@value"),
                    "modifier": sv.get("@stringModifier"),
                    "type_id": sv.get("@typeId")
                })
            elif "listValue" in value:
                lv = value["listValue"]
                results.append({
                    "key": key,
                    "value_type": value_type,
                    "value_kind": "list",
                    "list_id": lv.get("@id")
                })
            else:
                results.append({
                    "key": key,
                    "value_type": value_type,
                    "value_kind": "unknown",
                    "raw_value": value
                })
        
        return results
    
    def parse_expression_parameter(self, expr: Dict[str, Any], has_prop_parameters: bool) -> Optional[Dict[str, Any]]:
        param = expr.get("parameter")
        if not param:
            return None
        
        value = param.get("value")

        if value:
            if "propertyInstance" in value:
                nested_prop = value["propertyInstance"]
                return {
                    "mode": "nested_property",
                    "property": nested_prop.get("@propertyId"),
                    "parameters": self.parse_property_parameters(nested_prop.get("parameters", {}))
                }
            if "stringValue" in value:
                sv = value["stringValue"]
                return {
                    "mode": "value",
                    "value_kind": "string",
                    "value": sv.get("@value"),
                    "modifier": sv.get("@stringModifier"),
                    "type_id": sv.get("@typeId")
                }
            if "listValue" in value:
                lv = value["listValue"]
                return {
                    "mode": "value",
                    "value_kind": "list",
                    "list_id": lv.get("@id")
                }
        
        return {
            "mode": "meta",
            "value_type": param.get("@valueType"),
            "value_id": param.get("@valueId"),
            "type_id": param.get("@typeId"),
            "value": param.get("@valueId")
        }
    
    def to_rows(self) -> List[Dict[str, Any]]:
        return self.parsed
