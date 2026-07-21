"""
Pytest fixtures shared across all test modules.
"""
import asyncio
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.session import get_db
from app.main import app

@pytest.fixture(autouse=True)
def mock_send_email(monkeypatch):
    """Mock the email sender to avoid hitting external SMTP server in tests."""
    async def dummy_send(*args, **kwargs):
        return None
    monkeypatch.setattr("app.utils.email.send_email", dummy_send)

from sqlalchemy.pool import NullPool

TEST_DATABASE_URL = "postgresql+asyncpg://clinic_user:1234@localhost:5432/clinic_test"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)
TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest.fixture(scope="session")
def event_loop():
    """Use a single event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


from app.db.init_db import _seed_branches, _seed_users_and_profiles, _seed_medicines

@pytest_asyncio.fixture(scope="session")
async def setup_db():
    """Create all tables before tests, drop after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Seed the test database with standard accounts
    async with TestingSessionLocal() as db:
        branch_ids = await _seed_branches(db)
        await _seed_users_and_profiles(db, branch_ids, test_mode=True)
        await _seed_medicines(db)
        await db.commit()
        
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session(setup_db) -> AsyncGenerator[AsyncSession, None]:
    """Provide a rolled-back DB session for each test."""
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()


from httpx import ASGITransport, AsyncClient

@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    HTTP test client with DB session override.
    All requests use the test database.
    """
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()
