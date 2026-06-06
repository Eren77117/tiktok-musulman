CREATE TABLE "LiveWatchHistory" (
    "id" TEXT NOT NULL,
    "viewer_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "watched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiveWatchHistory_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LiveMute" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiveMute_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LiveBan" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiveBan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LiveWatchHistory_viewer_id_session_id_key" ON "LiveWatchHistory"("viewer_id", "session_id");
CREATE INDEX "LiveWatchHistory_viewer_id_idx" ON "LiveWatchHistory"("viewer_id");
CREATE INDEX "LiveWatchHistory_session_id_idx" ON "LiveWatchHistory"("session_id");
CREATE INDEX "LiveMute_session_id_idx" ON "LiveMute"("session_id");
CREATE UNIQUE INDEX "LiveBan_session_id_user_id_key" ON "LiveBan"("session_id", "user_id");
CREATE INDEX "LiveBan_session_id_idx" ON "LiveBan"("session_id");
ALTER TABLE "LiveWatchHistory" ADD CONSTRAINT "LiveWatchHistory_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveWatchHistory" ADD CONSTRAINT "LiveWatchHistory_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveMute" ADD CONSTRAINT "LiveMute_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveBan" ADD CONSTRAINT "LiveBan_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
