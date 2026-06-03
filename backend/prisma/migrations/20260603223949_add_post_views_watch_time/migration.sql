-- CreateTable
CREATE TABLE "PostView" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "watch_time_ms" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostView_user_id_idx" ON "PostView"("user_id");

-- CreateIndex
CREATE INDEX "PostView_post_id_idx" ON "PostView"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "PostView_user_id_post_id_key" ON "PostView"("user_id", "post_id");

-- AddForeignKey
ALTER TABLE "PostView" ADD CONSTRAINT "PostView_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostView" ADD CONSTRAINT "PostView_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
