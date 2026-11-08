-- ============================================================
-- M005 - Sync Sessions (time-based, time-bound sync gate)
-- ============================================================

USE `appscale_db`;

CREATE TABLE IF NOT EXISTS `sync_sessions` (
  `session_id`  INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`     INT NOT NULL,
  `window_open` BOOLEAN NOT NULL DEFAULT TRUE
                COMMENT 'TRUE = sync allowed; FALSE = window closed',
  `opened_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  `closed_at`   DATETIME NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  INDEX `idx_sync_session_user` (`user_id`, `window_open`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
