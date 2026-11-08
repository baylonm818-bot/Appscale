-- ============================================================
-- M007 - Nutritional Status Encryption at Rest
-- ============================================================
-- Requirement: Encrypt nutritional status data at rest in the database.
-- Adds AES encrypted binary column `overall_status_enc` to `nutrition_records`.
-- Existing `overall_status` plaintext remains intact for backwards compatibility
-- during transitional migration.
--
-- Encryption key is supplied via environment variable: APP_DATA_KEY
-- Or derived from MySQL AES functions:
-- AES_ENCRYPT(plain_text, UNHEX(SHA2(@APP_DATA_KEY, 256)))
-- AES_DECRYPT(overall_status_enc, UNHEX(SHA2(@APP_DATA_KEY, 256)))
-- ============================================================

USE `appscale_db`;

-- 1. Add encrypted blob column if not exists
SET @dbname = DATABASE();
SET @tablename = 'nutrition_records';
SET @columnname = 'overall_status_enc';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT "Column overall_status_enc already exists" AS message',
  'ALTER TABLE `nutrition_records` ADD COLUMN `overall_status_enc` VARBINARY(256) NULL AFTER `overall_status`'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2. Populate encrypted column from plaintext if a default key is available
-- (In production, replace 'AppScaleDefaultKey2026' with your secret from APP_DATA_KEY)
SET @enc_key = UNHEX(SHA2(COALESCE(@APP_DATA_KEY, 'AppScaleDefaultKey2026'), 256));

UPDATE `nutrition_records`
SET `overall_status_enc` = AES_ENCRYPT(`overall_status`, @enc_key)
WHERE `overall_status` IS NOT NULL
  AND `overall_status_enc` IS NULL;

-- 3. Verify column addition
DESCRIBE `nutrition_records`;
