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
        self._current_pk = 0

    def _ensure_list(self, value: Any) -> List:
        if value is None: return []
        if isinstance(value, list): return value
        return [value]

    def _extract_list_refs_recursive(self, obj: Any) -> List[str]:
        refs = []
        if isinstance(obj, dict):
            if "listValue" in obj:
                lv = obj["listValue"] or {}
                if isinstance(lv, dict) and "@id" in lv: refs.append(f"List({lv['@id']})")
            if "@listTypeId" in obj: refs.append(f"List({obj['@listTypeId']})")
            elif "@typeId" in obj:
                tid = str(obj['@typeId'])
                if tid.startswith('com.scur.'): refs.append(f"List({tid})")
            for v in obj.values(): refs.extend(self._extract_list_refs_recursive(v))
        elif isinstance(obj, list):
            for item in obj: refs.extend(self._extract_list_refs_recursive(item))
        return refs

    def _parse_actions(self, obj: Dict[str, Any]) -> str:
        summaries = []
        ac = obj.get("actionContainer")
        if ac and isinstance(ac, dict): summaries.append(f"Action: {ac.get('@actionId')}")
        iac = obj.get("immediateActionContainers") or {}
        if isinstance(iac, dict):
            for sac in self._ensure_list(iac.get("setActionContainer")):
                if isinstance(sac, dict):
                    prop = sac.get('@propertyId', 'Unknown')
                    refs = self._extract_list_refs_recursive(sac)
                    ref_str = f" [{', '.join(set(refs))}]" if refs else ""
                    summaries.append(f"Set: {prop}{ref_str}")
            for eac in self._ensure_list(iac.get("executeActionContainer")):
                if isinstance(eac, dict):
                    proc = eac.get('procedureValue', {}).get('@procedureId', 'Unknown')
                    summaries.append(f"Execute: {proc}")
            for eng in self._ensure_list(iac.get("enableEngineActionContainer")):
                if isinstance(eng, dict):
                    engine_id = eng.get('@engineId', 'Unknown')
                    config_id = eng.get('@configurationId', '')
                    suffix = f"[cfg:{config_id}]" if config_id else ""
                    summaries.append(f"EnableEngine: {engine_id}{suffix}")
        return " | ".join(summaries) if summaries else "None"

    def parse(self):
        self.all_records = []
        self._current_pk = 0

        def walk(obj, parent_pk=None, stack=None):
            if stack is None: stack = []
            if isinstance(obj, dict):
                current_name = obj.get("@name") or "(Unnamed)"
                # @name이 없는 루트 컨테이너 노드의 경우, 자신은 기록하지 않되
                # 하위 ruleGroups / rules 는 반드시 순회해야 한다.
                is_unnamed_root = not obj.get("@name")
                if is_unnamed_root:
                    rg_container = obj.get("ruleGroups") or {}
                    for rg in self._ensure_list(rg_container.get("ruleGroup")):
                        walk(rg, parent_pk, stack)
                    r_container = obj.get("rules") or {}
                    for r in self._ensure_list(r_container.get("rule")):
                        walk(r, parent_pk, stack)
                    return

                self._current_pk += 1
                current_pk = self._current_pk
                is_group = "rules" in obj or "ruleGroups" in obj

                condition_parser = ConditionParser(obj.get("condition") or {})
                record = {
                    "_pk_auto": current_pk,
                    "parent_pk": parent_pk,
                    "Type": "Group" if is_group else "Rule",
                    "Name": current_name,
                    "PolicyID": obj.get("@id"),
                    "Enabled": obj.get("@enabled", "true"),
                    "Condition": condition_parser.get_full_expression(),
                    "ConditionRaw": json.dumps(condition_parser.to_raw_dict(), ensure_ascii=False),
                    "Actions": self._parse_actions(obj) if not is_group else "",
                    "Path": " > ".join(stack + [current_name]),
                    "ParentPath": " > ".join(stack),
                    "Description": obj.get("description", ""),
                    "Level": len(stack) + 1,
                    "CloudSynced": obj.get("@cloudSynced"),
                    "CycleRequest": obj.get("@cycleRequest"),
                    "CycleResponse": obj.get("@cycleResponse"),
                    "CycleEmbedded": obj.get("@cycleEmbeddedObject"),
                    "DefaultRights": obj.get("@defaultRights"),
                    "ACElements": str(obj.get("acElements", ""))
                }
                self.all_records.append(record)

                new_stack = stack + [current_name]
                rg_container = obj.get("ruleGroups") or {}
                for rg in self._ensure_list(rg_container.get("ruleGroup")):
                    walk(rg, current_pk, new_stack)
                r_container = obj.get("rules") or {}
                for r in self._ensure_list(r_container.get("rule")):
                    walk(r, current_pk, new_stack)
            elif isinstance(obj, list):
                for item in obj: walk(item, parent_pk, stack)

        walk(self.data)
        return self.all_records
