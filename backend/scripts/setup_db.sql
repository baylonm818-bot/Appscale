-- Database setup for AppScale
-- Run as a privileged MySQL user (e.g. root)

CREATE DATABASE IF NOT EXISTS appscale_db
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'app_user'@'localhost' IDENTIFIED BY 'strong_password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER ON appscale_db.* TO 'app_user'@'localhost';
FLUSH PRIVILEGES;

USE appscale_db;

-- users table (columns required by the backend)
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) DEFAULT 'bhw',
  barangay VARCHAR(100),
  municipality VARCHAR(100),
  profile_picture VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  failed_attempts INT DEFAULT 0,
  lock_until DATETIME NULL,
  lock_level INT DEFAULT 0,
  deactivation_reason VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- Note: This script creates the DB, a dedicated DB user, and the users table.
-- Replace 'strong_password' with a secure password and do NOT commit credentials.
