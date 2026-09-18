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


