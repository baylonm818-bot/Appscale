-- ============================================================
-- M003 - Schedule Multi-Participant + Venue Required + Audit
-- Adds: schedule_participants table, audit columns on schedules
-- ============================================================

USE `appscale_db`;

-- 1. Junction table: many-to-many schedule ↔ users
CREATE TABLE IF NOT EXISTS `schedule_participants` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `schedule_id`  INT NOT NULL,
  `user_id`      INT NOT NULL,
  `role`         VARCHAR(20) NULL COMMENT 'bhw, bns, etc.',
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_sched_user` (`schedule_id`, `user_id`),
  FOREIGN KEY (`schedule_id`) REFERENCES `schedules` (`schedule_id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`)     REFERENCES `users` (`user_id`)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Audit / carry-out verification columns on schedules
ALTER TABLE `schedules`
  ADD COLUMN IF NOT EXISTS `audit_completion_notes` TEXT NULL
    COMMENT 'BHW/BNS notes confirming activity was carried out'
  AFTER `notes`,
  ADD COLUMN IF NOT EXISTS `audit_completed_at` DATETIME NULL
    COMMENT 'When the audit/completion evidence was submitted'
  AFTER `audit_completion_notes`,
  ADD COLUMN IF NOT EXISTS `audit_completed_by` INT NULL
    COMMENT 'FK to users.user_id — who submitted the audit'
  AFTER `audit_completed_at`;

-- 3. FK for audit_completed_by (safe to ignore if column already has FK)
ALTER TABLE `schedules`
  ADD CONSTRAINT IF NOT EXISTS `fk_sched_audit_user`
    FOREIGN KEY (`audit_completed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;
