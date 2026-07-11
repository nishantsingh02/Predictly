/*
  Warnings:

  - A unique constraint covering the columns `[userId,marketId,type]` on the table `Position` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Position_userId_marketId_type_key" ON "Position"("userId", "marketId", "type");
