import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config.settings import Settings

logger = logging.getLogger(__name__)


class Database:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None

    async def connect(self, settings: Settings) -> None:
        self.client = AsyncIOMotorClient(settings.mongo_url, serverSelectionTimeoutMS=5000)
        await self.client.admin.command("ping")
        self.db = self.client[settings.db_name]
        await self._create_indexes()
        logger.info("Connected to MongoDB database %s", settings.db_name)

    async def _create_indexes(self) -> None:
        assert self.db is not None
        # Drop legacy index names from old server.py to prevent duplicate key conflicts
        legacy_indexes = [
            ("feedback", "interview_id_1"),
            ("history", "interview_id_1"),
            ("scores", "interview_id_1"),
            ("interviews", "user_id_1_started_at_-1"),
        ]
        for coll_name, index_name in legacy_indexes:
            try:
                await self.db[coll_name].drop_index(index_name)
            except Exception:
                pass

        await self.db.users.create_index("email", unique=True)
        await self.db.interviews.create_index([("userId", 1), ("createdAt", -1)])
        await self.db.feedback.create_index("interviewId", unique=True)
        await self.db.statistics.create_index("userId", unique=True)
        await self.db.sessions.create_index("expiresAt", expireAfterSeconds=0)
        await self.db.sessions.create_index("jti", unique=True)
        await self.db.otp.create_index("expiresAt", expireAfterSeconds=0)
        await self.db.resumes.create_index("userId", unique=True)
        await self.db.profile_images.create_index("userId", unique=True)

    def get_db(self) -> AsyncIOMotorDatabase:
        if self.db is None:
            raise RuntimeError("Database is not connected")
        return self.db

    def close(self) -> None:
        if self.client:
            self.client.close()


database = Database()
