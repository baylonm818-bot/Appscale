-- ====================================================================
-- AppScale Full Database Schema Creation Script
-- System: AppScale Child & Maternal Nutrition System
-- Database Engine: MySQL / MariaDB (utf8mb4)
-- ====================================================================

CREATE DATABASE IF NOT EXISTS `appscale_db`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `appscale_db`;

-- Set foreign key checks off temporarily for smooth execution
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------------------
-- Table 1: users
-- Core system users (Admin, BHW, BNS)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `user_id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) UNIQUE NOT NULL,
  `email` VARCHAR(255) UNIQUE NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `middle_initial` VARCHAR(5) NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `role` ENUM('admin', 'bhw', 'bns') NOT NULL DEFAULT 'bhw',
  `municipality` VARCHAR(100) NOT NULL DEFAULT 'Gasan',
  `barangay` VARCHAR(100) NOT NULL,
  `purok` VARCHAR(50) NULL,
  `contact_number` VARCHAR(20) NULL,
  `profile_picture` VARCHAR(255) NULL,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `failed_attempts` INT DEFAULT 0,
  `lock_until` DATETIME NULL,
  `lock_level` INT DEFAULT 0,
  `deactivation_reason` VARCHAR(255) NULL,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_email` (`email`),
  INDEX `idx_users_username` (`username`),
  INDEX `idx_users_barangay` (`barangay`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- Table 2: mothers
-- Lactating and pregnant mothers beneficiary registry
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `mothers`;
CREATE TABLE `mothers` (
  `mother_id` INT AUTO_INCREMENT PRIMARY KEY,
  `external_id` VARCHAR(100) UNIQUE NULL COMMENT 'Mobile App Sync UUID',
  `first_name` VARCHAR(50) NOT NULL,
  `middle_initial` VARCHAR(5) NULL,
  `last_name` VARCHAR(50) NOT NULL,
  `birth_date` DATE NOT NULL,
  `weight_kg` DECIMAL(5,2) NULL,
  `height_cm` DECIMAL(5,2) NULL,
  `municipality` VARCHAR(50) NOT NULL DEFAULT 'Gasan',
  `barangay` VARCHAR(50) NOT NULL,
  `purok` VARCHAR(20) NOT NULL,
  `contact_number` VARCHAR(20) NULL,
  `status` ENUM('active', 'inactive', 'transfer', 'move_out', 'graduate') DEFAULT 'active',
  `encoded_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`encoded_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  INDEX `idx_mothers_barangay` (`barangay`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- Table 3: guardians
-- Separate guardians registry
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `guardians`;
CREATE TABLE `guardians` (
  `guardian_id` INT AUTO_INCREMENT PRIMARY KEY,
  `first_name` VARCHAR(50) NOT NULL,
  `middle_initial` CHAR(1) NULL,
  `last_name` VARCHAR(50) NOT NULL,
  `relationship` VARCHAR(50) NOT NULL COMMENT 'Mother, Father, Grandmother, etc.',
  `contact_number` VARCHAR(20) NULL,
  `municipality` VARCHAR(50) NOT NULL DEFAULT 'Gasan',
  `barangay` VARCHAR(50) NOT NULL,
  `purok` VARCHAR(20) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- Table 4: children
-- Children registry (0 to 59 months)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `children`;
CREATE TABLE `children` (
  `child_id` INT AUTO_INCREMENT PRIMARY KEY,
  `external_id` VARCHAR(100) UNIQUE NULL COMMENT 'Mobile App Sync UUID',
  `mother_id` INT NULL,
  `guardian_id` INT NULL,
  `first_name` VARCHAR(50) NOT NULL,
  `middle_initial` VARCHAR(5) NULL,
  `last_name` VARCHAR(50) NOT NULL,
  `birth_date` DATE NOT NULL,
  `sex` ENUM('male', 'female') NOT NULL,
  `age_in_months` INT NOT NULL DEFAULT 0,
  `municipality` VARCHAR(50) NOT NULL DEFAULT 'Gasan',
  `barangay` VARCHAR(50) NOT NULL,
  `purok` VARCHAR(20) NOT NULL,
  `guardian_name` VARCHAR(150) NULL,
  `guardian_contact` VARCHAR(50) NULL,
  `status` ENUM('active', 'transfer', 'move_out', 'dead', 'graduate') DEFAULT 'active',
  `encoded_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`mother_id`) REFERENCES `mothers` (`mother_id`) ON DELETE SET NULL,
  FOREIGN KEY (`guardian_id`) REFERENCES `guardians` (`guardian_id`) ON DELETE SET NULL,
  FOREIGN KEY (`encoded_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  INDEX `idx_children_barangay` (`barangay`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- Table 5: nutrition_records
-- Anthropometric assessments & WHO/DOH classification history
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `nutrition_records`;
CREATE TABLE `nutrition_records` (
  `record_id` INT AUTO_INCREMENT PRIMARY KEY,
  `child_id` INT NOT NULL,
  `record_date` DATE NOT NULL,
  `age_in_months` INT NOT NULL,
  `weight_kg` DECIMAL(5,2) NOT NULL,
  `height_cm` DECIMAL(5,2) NOT NULL,
  `muac_cm` DECIMAL(5,2) NOT NULL,
  `bmi` DECIMAL(5,2) NULL,
  `bmi_status` VARCHAR(50) NULL,
  `weight_status` ENUM('normal', 'underweight', 'severely_underweight', 'overweight', 'obese') NOT NULL,
  `height_status` ENUM('normal', 'stunted', 'severely_stunted') NOT NULL,
  `wasting_status` ENUM('normal', 'wasted', 'severely_wasted') NULL,
  `overall_status` VARCHAR(50) NOT NULL COMMENT 'Normal, MAM, SAM, Obese, Overweight',
  `recorded_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`child_id`) REFERENCES `children` (`child_id`) ON DELETE CASCADE,
  FOREIGN KEY (`recorded_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  INDEX `idx_nutrition_child_date` (`child_id`, `record_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- Table 6: child_services
-- Health & nutrition intervention services given to children
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `child_services`;
CREATE TABLE `child_services` (
  `service_id` INT AUTO_INCREMENT PRIMARY KEY,
  `child_id` INT NOT NULL,
  `service_type` VARCHAR(100) NOT NULL COMMENT 'vitamin_a, deworming, feeding, checkup, etc.',
  `service_name` VARCHAR(150) NULL,
  `dosage` VARCHAR(100) NULL,
  `service_date` DATE NOT NULL,
  `next_schedule` DATE NULL,
  `provided_by` VARCHAR(100) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`child_id`) REFERENCES `children` (`child_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- Table 7: mother_services
-- Health & nutrition intervention services given to mothers
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `mother_services`;
CREATE TABLE `mother_services` (
  `service_id` INT AUTO_INCREMENT PRIMARY KEY,
  `mother_id` INT NOT NULL,
  `service_type` VARCHAR(100) NOT NULL COMMENT 'iron_folic, checkup, counseling, etc.',
  `service_name` VARCHAR(150) NULL,
  `dosage` VARCHAR(100) NULL,
  `service_date` DATE NOT NULL,
  `next_schedule` DATE NULL,
  `provided_by` VARCHAR(100) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`mother_id`) REFERENCES `mothers` (`mother_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- Table 8: feeding_programs
-- Supplemental feeding program enrollment records
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `feeding_programs`;
CREATE TABLE `feeding_programs` (
  `feeding_id` INT AUTO_INCREMENT PRIMARY KEY,
  `child_id` INT NOT NULL,
  `status` ENUM('active', 'completed', 'removed') DEFAULT 'active',
  `start_date` DATE DEFAULT (CURRENT_DATE),
  `end_date` DATE NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`child_id`) REFERENCES `children` (`child_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- Table 9: feeding_attendance
-- Daily attendance for enrolled children in feeding program
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `feeding_attendance`;
CREATE TABLE `feeding_attendance` (
  `attendance_id` INT AUTO_INCREMENT PRIMARY KEY,
  `feeding_id` INT NOT NULL,
  `feeding_date` DATE NOT NULL,
  `status` ENUM('present', 'absent') NOT NULL DEFAULT 'present',
  `remarks` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`feeding_id`) REFERENCES `feeding_programs` (`feeding_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- Table 10: feeding_meals
-- Meals served during feeding program sessions
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `feeding_meals`;
CREATE TABLE `feeding_meals` (
  `meal_id` INT AUTO_INCREMENT PRIMARY KEY,
  `attendance_id` INT NOT NULL,
  `meal_description` VARCHAR(255) NOT NULL,
  `calories` INT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`attendance_id`) REFERENCES `feeding_attendance` (`attendance_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- Table 11: schedules
-- Activity schedules (Immunization, Feeding, Home Visit, Checkup)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `schedules`;
CREATE TABLE `schedules` (
  `schedule_id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(150) NOT NULL,
  `schedule_type` ENUM('feeding', 'home_visit', 'immunization', 'checkup') NOT NULL,
  `schedule_date` DATE NOT NULL,
  `schedule_time` TIME NULL,
  `barangay` VARCHAR(100) NULL,
  `assigned_to` INT NULL COMMENT 'FK to users table',
  `status` ENUM('pending', 'ongoing', 'done', 'cancelled') DEFAULT 'pending',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`assigned_to`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- Table 12: referrals
-- Beneficiary risk referral tracking (BNS to BHW / RHU)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `referrals`;
CREATE TABLE `referrals` (
  `referral_id` INT AUTO_INCREMENT PRIMARY KEY,
  `entity_type` ENUM('child', 'mother') NOT NULL DEFAULT 'child',
  `entity_id` INT NULL,
  `child_id` INT NULL,
  `mother_id` INT NULL,
  `referred_by` INT NOT NULL COMMENT 'BNS User ID',
  `referred_to` INT NOT NULL COMMENT 'BHW / RHU User ID',
  `reason` TEXT NOT NULL,
  `priority` ENUM('low', 'medium', 'high') DEFAULT 'medium',
  `severity` VARCHAR(50) DEFAULT 'Moderate',
  `status` VARCHAR(30) DEFAULT 'Pending' COMMENT 'Pending, Ongoing, Completed, Rejected',
  `notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`child_id`) REFERENCES `children` (`child_id`) ON DELETE SET NULL,
  FOREIGN KEY (`mother_id`) REFERENCES `mothers` (`mother_id`) ON DELETE SET NULL,
  FOREIGN KEY (`referred_by`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`referred_to`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- Table 13: notifications
-- System and user notifications
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `notification_id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL COMMENT 'Target user (NULL for global)',
  `title` VARCHAR(150) NOT NULL,
  `message` TEXT NOT NULL,
  `type` ENUM('alert', 'schedule', 'system') NOT NULL DEFAULT 'alert',
  `is_read` BOOLEAN DEFAULT FALSE,
  `related_id` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- Table 14: password_resets
-- Password reset tokens
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `password_resets`;
CREATE TABLE `password_resets` (
  `reset_id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `reset_token` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- Table 15: archive_records
-- Soft-deleted or graduated beneficiary snapshots
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `archive_records`;
CREATE TABLE `archive_records` (
  `archive_id` INT AUTO_INCREMENT PRIMARY KEY,
  `table_name` VARCHAR(50) NOT NULL COMMENT 'children, mothers, etc.',
  `record_id` INT NOT NULL,
  `snapshot` JSON NOT NULL,
  `reason` ENUM('deleted', 'transfer', 'move_out', 'dead', 'graduate') NOT NULL,
  `archived_by` INT NULL,
  `archived_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`archived_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- Table 16: sync_logs
-- Mobile app offline synchronization logs
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `sync_logs`;
CREATE TABLE `sync_logs` (
  `sync_id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `local_id` VARCHAR(100) NOT NULL,
  `table_name` VARCHAR(50) NOT NULL,
  `status` ENUM('pending', 'synced', 'failed') DEFAULT 'pending',
  `synced_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- Table 17: medical_records_audit_trail
-- Audit trail for BHW/BNS medical updates
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `medical_records_audit_trail`;
CREATE TABLE `medical_records_audit_trail` (
  `audit_id` INT AUTO_INCREMENT PRIMARY KEY,
  `record_type` VARCHAR(50) NOT NULL,
  `record_id` INT NULL,
  `beneficiary_type` VARCHAR(20) NOT NULL COMMENT 'child or mother',
  `beneficiary_id` INT NOT NULL,
  `beneficiary_name` VARCHAR(150) NULL,
  `action` VARCHAR(50) NOT NULL,
  `action_details` TEXT NULL,
  `modified_by` INT NULL,
  `modifier_name` VARCHAR(100) NULL,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- --------------------------------------------------------------------
-- Seed Data: Default System Admin User
-- Password: AppScaleAdmin123! (bcrypt hash below)
-- --------------------------------------------------------------------
INSERT INTO `users` (`username`, `email`, `password_hash`, `first_name`, `last_name`, `role`, `municipality`, `barangay`, `status`)
VALUES (
  'admin',
  'admin@appscale.local',
  '$2b$10$eE0m375.uH5r.2K/E4W68u8JqKjL/vXW7HqJ13076G54q4S/JjV7.',
  'System',
  'Administrator',
  'admin',
  'Gasan',
  'Central',
  'active'
)
ON DUPLICATE KEY UPDATE `status` = 'active';

-- ====================================================================
-- End of AppScale Full Database Schema Script
-- ====================================================================
