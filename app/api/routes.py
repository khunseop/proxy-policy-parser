from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from typing import List, Dict, Any
from app.models.schemas import ParseRequest, RuleSetItem, ParseResponse, ErrorResponse
from app.services.parser_service import ParserService

router = APIRouter()

def get_parser_service():
    return ParserService()

@router.get("/rulesets", response_model=List[RuleSetItem])
async def list_rulesets(service: ParserService = Depends(get_parser_service)):
    try:
        return await service.list_rulesets()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/parse/skyhigh", response_model=ParseResponse)
async def parse_skyhigh(request: ParseRequest, service: ParserService = Depends(get_parser_service)):
    try:
        result = await service.parse_from_api(request.ruleset_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/parse/upload", response_model=ParseResponse)
async def parse_upload(file: UploadFile = File(...), service: ParserService = Depends(get_parser_service)):
    if not file.filename.endswith('.xml'):
        raise HTTPException(status_code=400, detail="Only XML files are supported.")
    
    try:
        content = await file.read()
        result = await service.parse_from_file(content)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
