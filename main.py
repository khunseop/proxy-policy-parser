import os
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api import routes
from app.core.database import init_db

init_db()

app = FastAPI(title="Skyhigh Policy Parser API")

# API 라우터 (먼저 등록해야 /api/* 가 SPA catch-all보다 우선)
app.include_router(routes.router, prefix="/api/v1")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, "app/static/dist")
ASSETS_DIR = os.path.join(DIST_DIR, "assets")

# React 빌드 결과물 서빙
if os.path.isdir(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

# 기존 Vanilla JS (Phase 4 전까지 /static 경로로 유지)
STATIC_DIR = os.path.join(BASE_DIR, "app/static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

SPA_INDEX = os.path.join(DIST_DIR, "index.html")

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if os.path.isfile(SPA_INDEX):
        return FileResponse(SPA_INDEX)
    return FileResponse(os.path.join(BASE_DIR, "app/templates/index.html"))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
