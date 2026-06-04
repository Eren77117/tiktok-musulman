-- CreateTable
CREATE TABLE "BlockedUser" (
    "id" TEXT NOT NULL,
    "blocker_id" TEXT NOT NULL,
    "blocked_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiddenUser" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "hidden_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiddenUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlockedUser_blocker_id_idx" ON "BlockedUser"("blocker_id");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedUser_blocker_id_blocked_id_key" ON "BlockedUser"("blocker_id", "blocked_id");

-- CreateIndex
CREATE INDEX "HiddenUser_user_id_idx" ON "HiddenUser"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "HiddenUser_user_id_hidden_id_key" ON "HiddenUser"("user_id", "hidden_id");

-- AddForeignKey
ALTER TABLE "BlockedUser" ADD CONSTRAINT "BlockedUser_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedUser" ADD CONSTRAINT "BlockedUser_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenUser" ADD CONSTRAINT "HiddenUser_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenUser" ADD CONSTRAINT "HiddenUser_hidden_id_fkey" FOREIGN KEY ("hidden_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
