-- Add like_count and archived to Story
ALTER TABLE "Story" ADD COLUMN IF NOT EXISTS "like_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Story" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;

-- Add viewer relation to StoryView
ALTER TABLE "StoryView" ADD COLUMN IF NOT EXISTS "viewer_id_fk" TEXT;

-- StoryLike table
CREATE TABLE IF NOT EXISTS "StoryLike" (
    "id" TEXT NOT NULL,
    "story_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryLike_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StoryLike_story_id_user_id_key" ON "StoryLike"("story_id", "user_id");
ALTER TABLE "StoryLike" ADD CONSTRAINT "StoryLike_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryLike" ADD CONSTRAINT "StoryLike_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- StoryReply table
CREATE TABLE IF NOT EXISTS "StoryReply" (
    "id" TEXT NOT NULL,
    "story_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryReply_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "StoryReply" ADD CONSTRAINT "StoryReply_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryReply" ADD CONSTRAINT "StoryReply_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add viewer FK to StoryView
ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
