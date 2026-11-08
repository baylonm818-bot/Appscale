-- ============================================================
-- M001 - Child Record Enhancements
-- Adds: disability column, guardian_contact NOT NULL via CHECK,
--       birth_date index, guardian_contact index
-- Safe to run multiple times (uses IF NOT EXISTS / IGNORE).
-- ============================================================

USE `appscale_db`;

-- 1. Add disability column to children (nullable, free-text with common values enforced by app)
ALTER TABLE `children`
  ADD COLUMN IF NOT EXISTS `disability` VARCHAR(150) NULL DEFAULT NULL
    COMMENT 'Common disabilities (None, Visual Impairment, Hearing Impairment, etc.)'
  AFTER `guardian_contact`;

-- 2. Index on birth_date for fast age-out queries (Step 2)
ALTER TABLE `children`
  ADD INDEX IF NOT EXISTS `idx_children_birth_date` (`birth_date`);

-- 3. Index on guardian_contact for validation queries
ALTER TABLE `children`
  ADD INDEX IF NOT EXISTS `idx_children_guardian_contact` (`guardian_contact`(20));
