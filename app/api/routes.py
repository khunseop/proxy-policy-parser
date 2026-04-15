from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from typing import Dict, Any, List
from app.services.parser_service import ParserService
from app.core.database import save_parsed_data, get_dict_results, delete_policy_set, clear_all_history, compare_policy_sets, get_policy_stats
import os
import traceback
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
service = ParserService()

@router.post("/upload")
async def upload_xml(file: UploadFile = File(...)):
    if not file.filename.endswith('.xml'):
        raise HTTPException(status_code=400, detail="XML 파일만 업로드 가능합니다.")
    
    content = await file.read()
    try:
        result = await service.parse_from_file(content)
        set_id = save_parsed_data(file.filename, result)
        return {
            "message": "성공적으로 업로드 및 저장되었습니다.",
            "set_id": set_id,
            "summary": result["summary"]
        }
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"업로드 처리 실패:\n{tb}")
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {str(e)}")

@router.get("/history")
async def get_history():
    return get_dict_results("SELECT * FROM policy_sets ORDER BY upload_time DESC")

@router.delete("/history/{set_id}")
async def delete_history_item(set_id: int):
    """특정 정책 세트를 삭제합니다."""
    try:
        delete_policy_set(set_id)
        return {"message": f"Set {set_id} deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/history")
async def delete_all_history():
    """모든 정책 히스토리를 초기화합니다."""
    try:
        clear_all_history()
        return {"message": "All history cleared."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/policies/{set_id}")
async def get_policies(set_id: int, parent_path: str = Query("")):
    query = "SELECT * FROM policies WHERE set_id = ? AND ParentPath = ?"
    return get_dict_results(query, (set_id, parent_path))

@router.get("/policies/{set_id}/search")
async def search_policies(set_id: int, query: str = Query(...)):
    search_pattern = f"%{query}%"
    sql = """
        SELECT * FROM policies 
        WHERE set_id = ? 
        AND (Name LIKE ? OR Condition LIKE ? OR Actions LIKE ? OR Path LIKE ?)
        LIMIT 200
    """
    return get_dict_results(sql, (set_id, search_pattern, search_pattern, search_pattern, search_pattern))

@router.get("/analysis/{set_id}/value-lookup")
async def value_lookup(set_id: int, value: str = Query(...)):
    """특정 값이 포함된 리스트를 찾고, 해당 리스트를 참조하는 정책들을 반환합니다."""
    # 1. 값이 포함된 리스트 ID들 찾기
    val_pattern = f"%{value}%"
    list_ids_query = "SELECT DISTINCT list_id FROM objects WHERE set_id = ? AND entry_value LIKE ?"
    lists = get_dict_results(list_ids_query, (set_id, val_pattern))
    
    if not lists:
        return {"value": value, "found_in_lists": [], "policies": []}
    
    found_list_ids = [l["list_id"] for l in lists]
    
    # 2. 해당 리스트 ID를 참조하는 정책들 찾기
    # Condition은 list 이름으로 치환되어 있으므로, 원본 ID가 보존된 ConditionRaw를 검색한다.
    policies = []
    for lid in found_list_ids:
        pol_query = "SELECT * FROM policies WHERE set_id = ? AND ConditionRaw LIKE ?"
        matches = get_dict_results(pol_query, (set_id, f"%{lid}%"))
        for m in matches:
            m["MatchedListID"] = lid
            policies.append(m)
            
    return {
        "value": value,
        "found_in_lists": found_list_ids,
        "policies": policies,
        "count": len(policies)
    }

@router.get("/analysis/{set_id}/top-hosts")
async def top_hosts(set_id: int, limit: int = 20):
    """가장 많은 정책에서 참조되고 있는 Host/값들을 분석합니다."""
    sql = """
        SELECT o.entry_value, COUNT(DISTINCT m.policy_id) as policy_count, GROUP_CONCAT(DISTINCT o.list_name) as list_names
        FROM objects o
        JOIN policy_object_mapping m ON o.set_id = m.set_id AND o.list_id = m.list_id
        WHERE o.set_id = ? AND o.entry_value IS NOT NULL AND o.entry_value != ''
        GROUP BY o.entry_value
        ORDER BY policy_count DESC
        LIMIT ?
    """
    return get_dict_results(sql, (set_id, limit))

@router.get("/diff")
async def diff_policy_sets(set_a: int = Query(...), set_b: int = Query(...)):
    """두 정책 세트 간의 차이를 분석합니다."""
    if set_a == set_b:
        raise HTTPException(status_code=400, detail="두 세트가 동일합니다.")
    sets = get_dict_results(
        "SELECT * FROM policy_sets WHERE _pk_auto IN (?, ?)",
        (set_a, set_b)
    )
    if len(sets) < 2:
        raise HTTPException(status_code=404, detail="존재하지 않는 정책 세트입니다.")
    try:
        return compare_policy_sets(set_a, set_b)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/objects/{set_id}")
async def get_objects(set_id: int):
    return get_dict_results("SELECT * FROM objects WHERE set_id = ?", (set_id,))

@router.get("/metadata/{set_id}")
async def get_metadata(set_id: int):
    return get_dict_results("SELECT * FROM metadata WHERE set_id = ?", (set_id,))

@router.get("/analysis/{set_id}/policy-stats")
async def policy_stats_endpoint(set_id: int):
    try:
        return get_policy_stats(set_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
