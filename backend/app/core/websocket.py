import logging
from typing import Dict, List, Any
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Maps user_id -> list of active WebSocket connections
        self.user_connections: Dict[str, List[WebSocket]] = {}
        # Maps connection -> metadata dict (role, branch_id, user_id)
        self.connection_metadata: Dict[WebSocket, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, user_id: str | None = None, role: str | None = None, branch_id: str | None = None):
        await websocket.accept()
        metadata = {
            "user_id": user_id,
            "role": role,
            "branch_id": branch_id
        }
        self.connection_metadata[websocket] = metadata
        if user_id:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = []
            self.user_connections[user_id].append(websocket)
        logger.info(f"WebSocket client connected. user_id={user_id}, role={role}, branch_id={branch_id}. Total connected users: {len(self.user_connections)}")

    def disconnect(self, websocket: WebSocket):
        metadata = self.connection_metadata.pop(websocket, None)
        if metadata:
            user_id = metadata.get("user_id")
            if user_id and user_id in self.user_connections:
                if websocket in self.user_connections[user_id]:
                    self.user_connections[user_id].remove(websocket)
                if not self.user_connections[user_id]:
                    self.user_connections.pop(user_id)
        logger.info(f"WebSocket client disconnected. Remaining connected users: {len(self.user_connections)}")

    async def send_to_user(self, user_id: str, message: dict):
        connections = self.user_connections.get(user_id, [])
        if connections:
            logger.info(f"Sending message to user {user_id} on {len(connections)} connections: {message}")
            for connection in list(connections):
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.warning(f"Error sending message to user {user_id}: {e}")

    async def send_to_role(self, role: str, message: dict):
        target_connections = [
            ws for ws, meta in self.connection_metadata.items()
            if meta.get("role") == role
        ]
        if target_connections:
            logger.info(f"Sending message to role {role} on {len(target_connections)} connections: {message}")
            for connection in target_connections:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.warning(f"Error sending message to role {role}: {e}")

    async def send_to_branch(self, branch_id: str, message: dict):
        target_connections = [
            ws for ws, meta in self.connection_metadata.items()
            if meta.get("branch_id") == branch_id
        ]
        if target_connections:
            logger.info(f"Sending message to branch {branch_id} on {len(target_connections)} connections: {message}")
            for connection in target_connections:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.warning(f"Error sending message to branch {branch_id}: {e}")

    async def send_to_role_in_branch(self, role: str, branch_id: str, message: dict):
        target_connections = [
            ws for ws, meta in self.connection_metadata.items()
            if meta.get("role") == role and meta.get("branch_id") == branch_id
        ]
        if target_connections:
            logger.info(f"Sending message to role {role} in branch {branch_id} on {len(target_connections)} connections: {message}")
            for connection in target_connections:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.warning(f"Error sending message to role {role} in branch {branch_id}: {e}")

    async def broadcast(self, message: dict):
        all_connections = list(self.connection_metadata.keys())
        logger.info(f"Broadcasting message to all {len(all_connections)} connections: {message}")
        for connection in all_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Error broadcasting message to client: {e}")

manager = ConnectionManager()
