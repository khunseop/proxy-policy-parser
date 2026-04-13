from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from typing import Dict, Any, List
from app.services.parser_service import ParserService
from app.core.database import save_parsed_data, get_dict_results, get_connection
import os

router = APIRouter()
service = ParserService()

@router.post("/upload")
async def upload_xml(file: UploadFile = File(...)):
    """XML 파일을 업로드받아 파싱하고 SQLite DB에 저장합니다."""
    if not file.filename.endswith('.xml'):
        raise HTTPException(status_code=400, detail="XML 파일만 업로드 가능합니다.")
    
    content = await file.read()
    try:
        # 1. 파싱 수행
        result = await service.parse_from_file(content)
        # 2. DB 저장 (최대 5개 관리 로직 포함)
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
    """저장된 정책 세트 히스토리 목록을 반환합니다."""
    return get_dict_results("SELECT * FROM policy_sets ORDER BY upload_time DESC")

@router.get("/policies/{set_id}")
async def get_policies(set_id: int, parent_path: str = Query("")):
    """특정 세트의 정책 목록을 지연 로딩(부모 경로 기준)으로 반환합니다."""
    # ParentPath가 정확히 일치하는 자식 노드들만 조회
    query = "SELECT * FROM policies WHERE set_id = ? AND ParentPath = ?"
    return get_dict_results(query, (set_id, parent_path))

@router.get("/policies/{set_id}/search")
async def search_policies(set_id: int, query: str = Query(...)):
    """전체 정책 내에서 키워드 검색을 수행합니다 (서버사이드 검색)."""
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
    """특정 세트의 전역 객체(Lists) 정보를 반환합니다."""
    return get_dict_results("SELECT * FROM objects WHERE set_id = ?", (set_id,))

@router.get("/metadata/{set_id}")
async def get_metadata(set_id: int):
    """특정 세트의 메타데이터 정보를 반환합니다."""
    return get_dict_results("SELECT * FROM metadata WHERE set_id = ?", (set_id,))
