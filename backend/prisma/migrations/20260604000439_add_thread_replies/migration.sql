-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "reply_to_id" TEXT;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
