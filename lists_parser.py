import json
import pandas as pd
import xmltodict

class ListsParser:
    def __init__(self, source, from_xml: bool = False):
        if from_xml:
            self.data = xmltodict.parse(source)
        elif isinstance(source, dict):
            self.data = source
        else:
            raise ValueError("Invalid data source provided. Must be dict or XML string.")

        self.lists_records = []
    
    def safe_get(self, d, keys, default=None):
        """중첩 dict에서 안전하게 값 추출"""
        for key in keys:
            if isinstance(d, dict):
                d = d.get(key)
            else:
                return default
        return d if d is not None else default
    
    def parse(self):
        for item in self.data.get("libraryContent", {}).get("lists", {}).get("entry", []):
            list_in_lists = item.get("list", {})
            list_name = list_in_lists.get("@name", None)
            list_id = list_in_lists.get("@id", None)
            list_type_id = list_in_lists.get("@typeId", None)
            list_classifier = list_in_lists.get("@classifier", None)
            list_description = list_in_lists.get("description", None)

            entries = self.safe_get(item, ["list", "content", "listEntry"], [])

            # 리스트인 경우만 처리
            if isinstance(entries, list):
                for entry in entries:
                    if isinstance(entry, dict):
                        row = {
                            "list_name": list_name,
                            "list_id": list_id,
                            "list_type_id": list_type_id,
                            "list_classifier": list_classifier,
                            "list_description": list_description,
                            **entry
                        }
                        self.lists_records.append(row)
                
            elif isinstance(entries, dict):
                row = {
                    "list_name": list_name,
                    "list_id": list_id,
                    "list_type_id": list_type_id,
                    "list_classifier": list_classifier,
                    "list_description": list_description,
                    **entries
                }
                self.lists_records.append(row)
        
        return self.lists_records

    def to_excel(self, lists_path: str):
        df_lists = pd.DataFrame(self.lists_records)
        df_lists.to_excel(lists_path, index=False, engine="openpyxl")