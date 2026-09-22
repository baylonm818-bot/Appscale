require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function bootstrap() {
  const rootUser = process.env.MYSQL_ROOT_USER || 'root';
  const rootPass = process.env.MYSQL_ROOT_PASSWORD || '';
  const host = process.env.DB_HOST || 'localhost';

  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@apscale.local';
  const adminPass = process.env.BOOTSTRAP_ADMIN_PASSWORD || '12345678';

  try {
    const rootConn = await mysql.createConnection({
      host,
      user: rootUser,
      password: rootPass,
      multipleStatements: true,
    });

    const createSql = `
      CREATE DATABASE IF NOT EXISTS appscale_db DEFAULT CHARACTER SET utf8mb4;
      CREATE USER IF NOT EXISTS 'app_user'@'localhost' IDENTIFIED BY 'strong_password';
      GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER ON appscale_db.* TO 'app_user'@'localhost';
      FLUSH PRIVILEGES;
      USE appscale_db;
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
    `;

    await rootConn.query(createSql);

    const adminHash = await bcrypt.hash(adminPass, 10);
    const insertAdminSql = `
      INSERT INTO appscale_db.users (username, email, password_hash, first_name, last_name, role)
      SELECT 'admin', ?, ?, 'System', 'Administrator', 'admin' FROM DUAL
      WHERE NOT EXISTS (SELECT 1 FROM appscale_db.users WHERE email = ? LIMIT 1);
    `;

    await rootConn.query(insertAdminSql, [adminEmail, adminHash, adminEmail]);

    console.log('Bootstrap complete. Created DB, app_user, and admin (if missing).');
    await rootConn.end();
    process.exit(0);
  } catch (err) {
    console.error('Bootstrap failed:', err.message || err.stack);
    process.exit(1);
  }
}

bootstrap();
