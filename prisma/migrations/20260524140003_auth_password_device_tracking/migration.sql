/*
  Warnings:

  - You are about to drop the column `fcmToken` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `pinHash` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "fcmToken",
DROP COLUMN "pinHash",
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "transactionPinHash" TEXT;

-- CreateTable
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fcmToken" TEXT NOT NULL,
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_devices_userId_idx" ON "user_devices"("userId");

-- CreateIndex
CREATE INDEX "user_devices_fcmToken_idx" ON "user_devices"("fcmToken");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_userId_fcmToken_key" ON "user_devices"("userId", "fcmToken");

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
