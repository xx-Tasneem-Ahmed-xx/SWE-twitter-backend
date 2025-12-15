-- CreateIndex
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE INDEX "Follow_status_idx" ON "Follow"("status");

-- CreateIndex
CREATE INDEX "tweets_score_idx" ON "tweets"("score" DESC);

-- CreateIndex
CREATE INDEX "tweets_createdAt_idx" ON "tweets"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "tweets_tweetType_idx" ON "tweets"("tweetType");

-- CreateIndex
CREATE INDEX "tweets_parentId_idx" ON "tweets"("parentId");

-- CreateIndex
CREATE INDEX "tweets_userId_tweetType_idx" ON "tweets"("userId", "tweetType");

-- CreateIndex
CREATE INDEX "users_joinDate_idx" ON "users"("joinDate");

-- CreateIndex
CREATE INDEX "users_verified_idx" ON "users"("verified");

-- CreateIndex
CREATE INDEX "users_reputation_idx" ON "users"("reputation");
