-- CreateTable
CREATE TABLE `Species` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `variety` VARCHAR(120) NULL,
    `category` ENUM('VEGETABLE', 'FRUIT', 'FLOWER', 'HERB') NOT NULL,
    `scientificName` VARCHAR(160) NULL,
    `cycle` ENUM('ANNUAL', 'BIENNIAL', 'PERENNIAL') NOT NULL DEFAULT 'ANNUAL',
    `spacingCm` INTEGER NULL,
    `daysToFlower` INTEGER NULL,
    `daysToHarvest` INTEGER NULL,
    `notes` TEXT NULL,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Species_category_idx`(`category`),
    INDEX `Species_archived_idx`(`archived`),
    UNIQUE INDEX `Species_name_variety_key`(`name`, `variety`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GardenArea` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `kind` ENUM('BED', 'RAISED_BED', 'POT', 'BORDER', 'GREENHOUSE', 'WINDOWSILL', 'OTHER') NOT NULL,
    `widthCm` INTEGER NOT NULL,
    `depthCm` INTEGER NOT NULL,
    `gridX` INTEGER NOT NULL,
    `gridY` INTEGER NOT NULL,
    `notes` TEXT NULL,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GardenArea_archived_idx`(`archived`),
    UNIQUE INDEX `GardenArea_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Planting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `speciesId` INTEGER NOT NULL,
    `areaId` INTEGER NOT NULL,
    `plantedOn` DATE NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `source` ENUM('SEED', 'SEEDLING', 'CUTTING', 'BARE_ROOT', 'DIVISION', 'OTHER') NOT NULL,
    `status` ENUM('ACTIVE', 'ENDED') NOT NULL DEFAULT 'ACTIVE',
    `endedOn` DATE NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Planting_areaId_idx`(`areaId`),
    INDEX `Planting_speciesId_idx`(`speciesId`),
    INDEX `Planting_plantedOn_idx`(`plantedOn`),
    INDEX `Planting_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Milestone` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plantingId` INTEGER NOT NULL,
    `kind` ENUM('SOWN', 'GERMINATED', 'TRANSPLANTED', 'FIRST_FLOWER', 'FIRST_FRUIT', 'BEGINNING_TO_DECLINE', 'DIED', 'HARVEST_ENDED') NOT NULL,
    `occurredOn` DATE NOT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Milestone_plantingId_occurredOn_idx`(`plantingId`, `occurredOn`),
    INDEX `Milestone_kind_idx`(`kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CareLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plantingId` INTEGER NOT NULL,
    `kind` ENUM('WATERED', 'PRUNED', 'TIED', 'FED', 'MULCHED', 'REPPOTTED', 'THINNED', 'OTHER') NOT NULL,
    `performedOn` DATE NOT NULL,
    `amount` DECIMAL(8, 2) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CareLog_plantingId_kind_performedOn_idx`(`plantingId`, `kind`, `performedOn`),
    INDEX `CareLog_performedOn_idx`(`performedOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Issue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plantingId` INTEGER NOT NULL,
    `kind` ENUM('PEST', 'DISEASE', 'NUTRIENT_DEFICIENCY', 'WEATHER_DAMAGE', 'PHYSICAL_DAMAGE', 'COMPETITION', 'OTHER') NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL,
    `status` ENUM('OPEN', 'MONITORING', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
    `openedOn` DATE NOT NULL,
    `resolvedOn` DATE NULL,
    `resolution` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Issue_plantingId_idx`(`plantingId`),
    INDEX `Issue_status_idx`(`status`),
    INDEX `Issue_openedOn_idx`(`openedOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Harvest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plantingId` INTEGER NOT NULL,
    `harvestedOn` DATE NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL,
    `unit` ENUM('GRAM', 'KILOGRAM', 'PIECE', 'BUNCH', 'BUCKET', 'LITRE') NOT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Harvest_plantingId_idx`(`plantingId`),
    INDEX `Harvest_harvestedOn_idx`(`harvestedOn`),
    INDEX `Harvest_unit_idx`(`unit`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeedSave` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `harvestId` INTEGER NOT NULL,
    `kept` BOOLEAN NOT NULL DEFAULT true,
    `quantity` DECIMAL(10, 2) NULL,
    `storageMethod` ENUM('PAPER_ENVELOPE', 'GLASS_JAR', 'PLASTIC_BAG', 'FROZEN', 'OTHER') NOT NULL,
    `storageLocation` VARCHAR(160) NULL,
    `savedOn` DATE NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SeedSave_harvestId_idx`(`harvestId`),
    INDEX `SeedSave_kept_idx`(`kept`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Guide` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(220) NOT NULL,
    `category` ENUM('VEGETABLE_GROWING', 'FLOWER_CARE', 'PESTS_AND_DISEASE', 'SOIL_AND_COMPOST', 'SEED_SAVING', 'GENERAL') NOT NULL,
    `summary` TEXT NULL,
    `body` LONGTEXT NOT NULL,
    `sourceName` VARCHAR(160) NULL,
    `sourceUrl` VARCHAR(500) NULL,
    `publishedOn` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Guide_slug_key`(`slug`),
    INDEX `Guide_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,

    UNIQUE INDEX `Tag_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_GuideToTag` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_GuideToTag_AB_unique`(`A`, `B`),
    INDEX `_GuideToTag_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Planting` ADD CONSTRAINT `Planting_speciesId_fkey` FOREIGN KEY (`speciesId`) REFERENCES `Species`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Planting` ADD CONSTRAINT `Planting_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `GardenArea`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Milestone` ADD CONSTRAINT `Milestone_plantingId_fkey` FOREIGN KEY (`plantingId`) REFERENCES `Planting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CareLog` ADD CONSTRAINT `CareLog_plantingId_fkey` FOREIGN KEY (`plantingId`) REFERENCES `Planting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Issue` ADD CONSTRAINT `Issue_plantingId_fkey` FOREIGN KEY (`plantingId`) REFERENCES `Planting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Harvest` ADD CONSTRAINT `Harvest_plantingId_fkey` FOREIGN KEY (`plantingId`) REFERENCES `Planting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeedSave` ADD CONSTRAINT `SeedSave_harvestId_fkey` FOREIGN KEY (`harvestId`) REFERENCES `Harvest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_GuideToTag` ADD CONSTRAINT `_GuideToTag_A_fkey` FOREIGN KEY (`A`) REFERENCES `Guide`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_GuideToTag` ADD CONSTRAINT `_GuideToTag_B_fkey` FOREIGN KEY (`B`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
