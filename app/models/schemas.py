from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict

class ParseRequest(BaseModel):
    ruleset_id: str
    title: Optional[str] = "Ruleset"

class RuleSetItem(BaseModel):
    id: str
    title: str
    enabled: Optional[str] = None
    position: Optional[str] = None
    no_of_child: Optional[str] = None

class ParseResponse(BaseModel):
    rulegroups: List[Dict[str, Any]]
    rules: List[Dict[str, Any]]
    summary: Dict[str, Any]

class ErrorResponse(BaseModel):
    detail: str
