-- CreateTable
CREATE TABLE "admin_statuses" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "admin_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_role_statuses" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "admin_role_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_resources" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "admin_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_roles" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "statusId" INTEGER NOT NULL,

    CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "admin_role_permissions" (
    "id" SERIAL NOT NULL,
    "roleCode" TEXT NOT NULL,
    "resourceId" INTEGER NOT NULL,
    "permissions" TEXT NOT NULL,

    CONSTRAINT "admin_role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_user_permissions" (
    "id" SERIAL NOT NULL,
    "adminId" TEXT NOT NULL,
    "resourceId" INTEGER NOT NULL,
    "permissions" TEXT NOT NULL,

    CONSTRAINT "admin_user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_tokens" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phoneNumber" TEXT,
    "isProfileComplete" BOOLEAN NOT NULL DEFAULT false,
    "invalidOtpCount" INTEGER NOT NULL DEFAULT 0,
    "invitedById" TEXT,
    "roleCode" TEXT NOT NULL,
    "statusId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_activity_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_statuses_name_key" ON "admin_statuses"("name");

-- CreateIndex
CREATE UNIQUE INDEX "admin_role_statuses_name_key" ON "admin_role_statuses"("name");

-- CreateIndex
CREATE UNIQUE INDEX "admin_resources_name_key" ON "admin_resources"("name");

-- CreateIndex
CREATE UNIQUE INDEX "admin_role_permissions_roleCode_resourceId_key" ON "admin_role_permissions"("roleCode", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_permissions_adminId_resourceId_key" ON "admin_user_permissions"("adminId", "resourceId");

-- CreateIndex
CREATE INDEX "admin_tokens_adminId_idx" ON "admin_tokens"("adminId");

-- CreateIndex
CREATE INDEX "admin_tokens_token_idx" ON "admin_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE INDEX "admins_email_idx" ON "admins"("email");

-- CreateIndex
CREATE INDEX "admins_statusId_idx" ON "admins"("statusId");

-- CreateIndex
CREATE INDEX "admin_activity_logs_adminId_idx" ON "admin_activity_logs"("adminId");

-- CreateIndex
CREATE INDEX "admin_activity_logs_createdAt_idx" ON "admin_activity_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "admin_roles" ADD CONSTRAINT "admin_roles_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "admin_role_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_roleCode_fkey" FOREIGN KEY ("roleCode") REFERENCES "admin_roles"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "admin_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_user_permissions" ADD CONSTRAINT "admin_user_permissions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_user_permissions" ADD CONSTRAINT "admin_user_permissions_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "admin_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_tokens" ADD CONSTRAINT "admin_tokens_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_roleCode_fkey" FOREIGN KEY ("roleCode") REFERENCES "admin_roles"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "admin_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_activity_logs" ADD CONSTRAINT "admin_activity_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
