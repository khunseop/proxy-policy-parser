import os
import uvicorn
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from app.api import routes
from app.core.config import settings

app = FastAPI(title="Skyhigh Policy Parser API")

# API 라우터 연결
app.include_router(routes.router, prefix="/api/v1")

# 현재 파일의 절대 경로를 기준으로 디렉토리 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "app/static")
TEMPLATE_DIR = os.path.join(BASE_DIR, "app/templates")

# 디렉토리 생성 보장
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(TEMPLATE_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
templates = Jinja2Templates(directory=TEMPLATE_DIR)

@app.get("/")
async def read_root(request: Request):
    """메인 웹 인터페이스 페이지"""
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={}
    )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
