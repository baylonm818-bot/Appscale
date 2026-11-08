-- ============================================================
-- M006 - System Logs (BNS/BHW activity audit, Admin-only view)
-- ============================================================

USE `appscale_db`;

CREATE TABLE IF NOT EXISTS `system_logs` (
  `log_id`       INT AUTO_INCREMENT PRIMARY KEY,
  `actor_id`     INT    NULL COMMENT 'FK to users.user_id',
  `actor_name`   VARCHAR(150) NULL,
  `actor_role`   VARCHAR(20)  NULL COMMENT 'admin, bns, bhw',
  `action`       VARCHAR(100) NOT NULL
                 COMMENT 'e.g., CREATE_CHILD, UPDATE_NUTRITION_RECORD, DELETE_SCHEDULE',
  `entity_type`  VARCHAR(50)  NULL COMMENT 'child, mother, schedule, referral, etc.',
  `entity_id`    INT          NULL,
  `details`      JSON         NULL COMMENT 'Before/after values or relevant payload',
  `ip_address`   VARCHAR(50)  NULL,
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`actor_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  INDEX `idx_syslog_actor`  (`actor_id`),
  INDEX `idx_syslog_action` (`action`),
  INDEX `idx_syslog_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
