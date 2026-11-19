-- ============================================================
-- M008 - Barangays and Puroks Tables
-- Adds: barangays table, puroks table, seed data (Purok 1 placeholder per barangay)
-- ============================================================

USE `appscale_db`;

-- 1. Create barangays table if not exists
CREATE TABLE IF NOT EXISTS `barangays` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `name`         VARCHAR(100) NOT NULL UNIQUE,
  `municipality` VARCHAR(100) NOT NULL DEFAULT 'Gasan',
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Create puroks table
CREATE TABLE IF NOT EXISTS `puroks` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `barangay_id`  INT NOT NULL,
  `name`         VARCHAR(100) NOT NULL,
  `is_active`    TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_puroks_barangay` (`barangay_id`),
  FOREIGN KEY (`barangay_id`) REFERENCES `barangays` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Seed the 25 Gasan Barangays
INSERT IGNORE INTO `barangays` (`name`, `municipality`) VALUES
  ('Antipolo', 'Gasan'),
  ('B. Ibaba', 'Gasan'),
  ('B. Ilaya', 'Gasan'),
  ('Bacong-Bacong', 'Gasan'),
  ('Bahi', 'Gasan'),
  ('Bangbang', 'Gasan'),
  ('Banot', 'Gasan'),
  ('Banuyo', 'Gasan'),
  ('Bognuyan', 'Gasan'),
  ('Cabugao', 'Gasan'),
  ('Dawis', 'Gasan'),
  ('Dili', 'Gasan'),
  ('Libtangin', 'Gasan'),
  ('Mahunig', 'Gasan'),
  ('Mangiliol', 'Gasan'),
  ('Masiga', 'Gasan'),
  ('Mat. Gasan', 'Gasan'),
  ('Pangi', 'Gasan'),
  ('Pinggan', 'Gasan'),
  ('Tabionan', 'Gasan'),
  ('Tiguion', 'Gasan'),
  ('Brgy. Uno', 'Gasan'),
  ('Brgy. Dos', 'Gasan'),
  ('Brgy. Tres', 'Gasan'),
  ('Tapuyan', 'Gasan');

-- 4. Seed each barangay with "Purok 1" as initial placeholder
INSERT INTO `puroks` (`barangay_id`, `name`, `is_active`)
SELECT b.id, 'Purok 1', 1
FROM `barangays` b
WHERE NOT EXISTS (
  SELECT 1 FROM `puroks` p WHERE p.barangay_id = b.id AND p.name = 'Purok 1'
);

-- 5. Add user settings columns (language, age_format_days) if not exists
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `language` VARCHAR(10) NOT NULL DEFAULT 'en'
    COMMENT 'UI language: en or tl',
  ADD COLUMN IF NOT EXISTS `age_format_days` TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = include days in age formatting, 0 = months only';

-- 6. Add signature columns for mother/guardian signatures
ALTER TABLE `nutrition_records`
  ADD COLUMN IF NOT EXISTS `signature` LONGTEXT NULL
    COMMENT 'Base64 mother signature';

ALTER TABLE `mother_services`
  ADD COLUMN IF NOT EXISTS `signature` LONGTEXT NULL
    COMMENT 'Base64 mother signature';

ALTER TABLE `feeding_attendance`
  ADD COLUMN IF NOT EXISTS `signature` LONGTEXT NULL
    COMMENT 'Base64 mother signature';

ALTER TABLE `child_services`
  ADD COLUMN IF NOT EXISTS `signature` LONGTEXT NULL
    COMMENT 'Base64 mother signature';
