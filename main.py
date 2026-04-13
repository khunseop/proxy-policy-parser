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

# 정적 파일 및 템플릿 설정 (에어갭 대응)
# 디렉토리가 없으면 생성
os.makedirs("app/static", exist_ok=True)
os.makedirs("app/templates", exist_ok=True)

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

@app.get("/")
async def read_root(request: Request):
    """메인 웹 인터페이스 페이지"""
    return templates.TemplateResponse("index.html", {"request": request})

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
