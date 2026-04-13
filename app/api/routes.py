from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import Dict, Any
from app.services.parser_service import ParserService
import os

router = APIRouter()
service = ParserService()

@router.get("/policies")
async def get_policies():
    """파싱된 전체 정책 데이터를 반환합니다."""
    # 실제 환경에서는 세션이나 특정 파일에서 데이터를 가져와야 하지만, 
    # 일단 테스트용으로 현재 폴더의 최신 XML을 파싱해 반환하거나 빈 값을 반환합니다.
    return {"message": "Policy data endpoint ready"}

@router.post("/upload")
async def upload_xml(file: UploadFile = File(...)):
    """XML 파일을 업로드받아 즉시 파싱하여 결과를 반환합니다."""
    if not file.filename.endswith('.xml'):
        raise HTTPException(status_code=400, detail="XML 파일만 업로드 가능합니다.")
    
    content = await file.read()
    try:
        result = await service.parse_from_file(content)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
