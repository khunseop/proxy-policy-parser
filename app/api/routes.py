from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from typing import Dict, Any, List
from app.services.parser_service import ParserService
from app.core.database import save_parsed_data, get_dict_results, delete_policy_set, clear_all_history
import os

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
        raise HTTPException(status_code=500, detail=str(e))

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

@router.get("/objects/{set_id}")
async def get_objects(set_id: int):
    return get_dict_results("SELECT * FROM objects WHERE set_id = ?", (set_id,))

@router.get("/metadata/{set_id}")
async def get_metadata(set_id: int):
    return get_dict_results("SELECT * FROM metadata WHERE set_id = ?", (set_id,))
