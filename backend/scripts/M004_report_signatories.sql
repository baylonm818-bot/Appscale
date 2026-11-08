-- ============================================================
-- M004 - Report Signatories Table
-- Allows Admin to configure who signs printed reports.
-- ============================================================

USE `appscale_db`;

CREATE TABLE IF NOT EXISTS `report_signatories` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `position`    VARCHAR(150) NOT NULL COMMENT 'e.g., Municipal Nutrition Action Officer',
  `name`        VARCHAR(150) NOT NULL,
  `sort_order`  INT          NOT NULL DEFAULT 0,
  `updated_by`  INT NULL,
  `updated_at`  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default signatories so the UI is not empty on first load
INSERT IGNORE INTO `report_signatories` (`position`, `name`, `sort_order`)
VALUES
  ('Municipal Nutrition Action Officer', '', 1),
  ('Municipal Health Officer',           '', 2),
  ('Barangay Nutrition Scholar',         '', 3);
