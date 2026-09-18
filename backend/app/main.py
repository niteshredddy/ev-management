from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
from .simulator import simulator_instance
from .auth import auth_router, get_current_user, get_ws_current_user
from .db import engine, Base
from . import models

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables
    Base.metadata.create_all(bind=engine)
    
    sim_task = asyncio.create_task(simulator_instance.run_loop())
    yield
    simulator_instance.stop()
    await sim_task

import os

app = FastAPI(title="GridSync API", lifespan=lifespan)

# Enable CORS for the Next.js frontend
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from .routes.user import router as user_router
from .routes.admin import router as admin_router

app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(user_router, prefix="/api/user", tags=["User"])
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])
@app.get("/api/state")
async def get_state(user: str = Depends(get_current_user)):
    grid = simulator_instance._simulate_grid()
    return {
        "grid": grid,
        "vehicles": simulator_instance.vehicles,
        "active_shedding": False
    }

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@app.websocket("/ws/state")
async def websocket_state(websocket: WebSocket, user: str = Depends(get_ws_current_user)):
    await websocket.accept()
    
    queue = asyncio.Queue()
    
    async def push_to_queue(snapshot):
        await queue.put(snapshot)

    simulator_instance.subscribe(push_to_queue)
    
    try:
        while True:
            snapshot = await queue.get()
            await websocket.send_text(snapshot.model_dump_json())
    except WebSocketDisconnect:
        pass
    finally:
        simulator_instance.unsubscribe(push_to_queue)

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

# Serve Next.js frontend
frontend_out = Path(__file__).parent.parent.parent / "frontend" / "out"

if frontend_out.exists():
    # Mount Next.js static assets
    if (frontend_out / "_next").exists():
        app.mount("/_next", StaticFiles(directory=str(frontend_out / "_next")), name="next_assets")
    
    # Catch-all for Next.js routes
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Prevent accessing files outside frontend_out
        if ".." in full_path:
            return FileResponse(frontend_out / "index.html")
            
        # If empty path, serve index.html
        if not full_path:
            return FileResponse(frontend_out / "index.html")
            
        # 1. Check if exact file exists (e.g., /favicon.ico)
        if (frontend_out / full_path).exists() and (frontend_out / full_path).is_file():
            return FileResponse(frontend_out / full_path)
            
        # 2. Check if an exact HTML file exists (e.g., /login -> /login.html)
        if (frontend_out / f"{full_path}.html").exists():
            return FileResponse(frontend_out / f"{full_path}.html")
            
        # 3. Check if a directory with index.html exists (e.g., /dashboard -> /dashboard/index.html)
        if (frontend_out / full_path / "index.html").exists():
            return FileResponse(frontend_out / full_path / "index.html")
            
        # 4. Fallback to index.html for client-side routing
        return FileResponse(frontend_out / "index.html")

