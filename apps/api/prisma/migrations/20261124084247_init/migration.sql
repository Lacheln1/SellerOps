-- CreateTable
CREATE TABLE `Store` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `webhookSecret` VARCHAR(128) NOT NULL,
    `policyDoc` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Inquiry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `storeId` INTEGER NOT NULL,
    `externalId` VARCHAR(100) NOT NULL,
    `body` TEXT NOT NULL,
    `status` ENUM('received', 'classified', 'drafted', 'approved', 'sent', 'handed_off', 'failed') NOT NULL DEFAULT 'received',
    `category` VARCHAR(50) NULL,
    `urgency` ENUM('low', 'normal', 'high') NULL,
    `confidence` DOUBLE NULL,
    `classification` JSON NULL,
    `handoffReason` VARCHAR(50) NULL,
    `failureReason` VARCHAR(255) NULL,
    `receivedAt` DATETIME(3) NOT NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Inquiry_storeId_status_createdAt_idx`(`storeId`, `status`, `createdAt`),
    INDEX `Inquiry_status_updatedAt_idx`(`status`, `updatedAt`),
    UNIQUE INDEX `Inquiry_storeId_externalId_key`(`storeId`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Draft` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inquiryId` INTEGER NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `body` TEXT NOT NULL,
    `finalBody` TEXT NULL,
    `policyRefs` JSON NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Draft_inquiryId_version_key`(`inquiryId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Review` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `storeId` INTEGER NOT NULL,
    `externalId` VARCHAR(100) NOT NULL,
    `rating` TINYINT NOT NULL,
    `body` TEXT NOT NULL,
    `complaintType` VARCHAR(50) NULL,
    `postedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Review_storeId_postedAt_idx`(`storeId`, `postedAt`),
    UNIQUE INDEX `Review_storeId_externalId_key`(`storeId`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Briefing` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `storeId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `sections` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Briefing_storeId_date_key`(`storeId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `storeId` INTEGER NULL,
    `entityType` VARCHAR(50) NOT NULL,
    `entityId` INTEGER NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `actor` VARCHAR(20) NOT NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LlmCall` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kind` VARCHAR(30) NOT NULL,
    `provider` VARCHAR(30) NOT NULL,
    `model` VARCHAR(50) NOT NULL,
    `promptVersion` VARCHAR(30) NOT NULL,
    `status` ENUM('success', 'invalid_output', 'error', 'timeout', 'rate_limited') NOT NULL,
    `attempt` INTEGER NOT NULL DEFAULT 1,
    `durationMs` INTEGER NOT NULL,
    `inputTokens` INTEGER NULL,
    `outputTokens` INTEGER NULL,
    `errorMessage` TEXT NULL,
    `inquiryId` INTEGER NULL,
    `reviewId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LlmCall_kind_createdAt_idx`(`kind`, `createdAt`),
    INDEX `LlmCall_inquiryId_idx`(`inquiryId`),
    INDEX `LlmCall_reviewId_idx`(`reviewId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Inquiry` ADD CONSTRAINT `Inquiry_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Draft` ADD CONSTRAINT `Draft_inquiryId_fkey` FOREIGN KEY (`inquiryId`) REFERENCES `Inquiry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Briefing` ADD CONSTRAINT `Briefing_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LlmCall` ADD CONSTRAINT `LlmCall_inquiryId_fkey` FOREIGN KEY (`inquiryId`) REFERENCES `Inquiry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LlmCall` ADD CONSTRAINT `LlmCall_reviewId_fkey` FOREIGN KEY (`reviewId`) REFERENCES `Review`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
