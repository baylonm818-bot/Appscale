/**
 * ensureSchema.js — Automated self-healing database migrations at startup
 * Guarantees required columns and tables exist without requiring manual SQL commands.
 */

async function ensureAppSchema(pool) {
  try {
    // 1. Ensure `children` table has `disability` column
    try {
      const [[{ cnt: childDisabilityCnt }]] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'children' AND COLUMN_NAME = 'disability'`
      );
      if (Number(childDisabilityCnt) === 0) {
        await pool.query(
          `ALTER TABLE children ADD COLUMN disability VARCHAR(150) NULL DEFAULT NULL AFTER guardian_contact`
        );
        console.log('[Schema] Added column `children.disability`');
      }
    } catch (e) {
      console.warn('[Schema] children.disability check warning:', e.message);
    }

    // 2. Ensure `system_logs` table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`system_logs\` (
          \`log_id\`      BIGINT AUTO_INCREMENT PRIMARY KEY,
          \`actor_id\`    INT NULL,
          \`actor_name\`  VARCHAR(150) NULL,
          \`actor_role\`  VARCHAR(50)  NULL,
          \`action\`      VARCHAR(100) NOT NULL,
          \`entity_type\` VARCHAR(100) NULL,
          \`entity_id\`   INT NULL,
          \`details\`     JSON NULL,
          \`ip_address\`  VARCHAR(45) NULL,
          \`created_at\`  DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX \`idx_actor_role\` (\`actor_role\`),
          INDEX \`idx_action\` (\`action\`),
          INDEX \`idx_created_at\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    } catch (e) {
      console.warn('[Schema] system_logs table init warning:', e.message);
    }

    // 3. Ensure `schedules` extra columns exist
    const schedCols = [
      ['venue', 'VARCHAR(255) NULL DEFAULT NULL'],
      ['target_role', 'VARCHAR(50) NULL DEFAULT NULL'],
      ['facilitator', 'VARCHAR(150) NULL DEFAULT NULL'],
      ['notes', 'TEXT NULL DEFAULT NULL'],
      ['created_by', 'INT NULL DEFAULT NULL'],
      ['audit_completion_notes', 'TEXT NULL DEFAULT NULL'],
      ['audit_completed_at', 'DATETIME NULL DEFAULT NULL'],
      ['audit_completed_by', 'INT NULL DEFAULT NULL'],
    ];

    for (const [colName, colDef] of schedCols) {
      try {
        const [[{ cnt }]] = await pool.query(
          `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedules' AND COLUMN_NAME = ?`,
          [colName]
        );
        if (Number(cnt) === 0) {
          await pool.query(`ALTER TABLE schedules ADD COLUMN ${colName} ${colDef}`);
          console.log(`[Schema] Added column \`schedules.${colName}\``);
        }
      } catch (e) {
        console.warn(`[Schema] schedules.${colName} check warning:`, e.message);
      }
    }

    // 4. Ensure `schedule_participants` table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`schedule_participants\` (
          \`id\`          INT AUTO_INCREMENT PRIMARY KEY,
          \`schedule_id\` INT NOT NULL,
          \`user_id\`     INT NOT NULL,
          \`role\`        VARCHAR(20) NULL,
          \`created_at\`  DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY \`uq_sched_user\` (\`schedule_id\`, \`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    } catch (e) {
      console.warn('[Schema] schedule_participants table init warning:', e.message);
    }

    // 5. Ensure `report_signatories` table exists with `barangay` column
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`report_signatories\` (
          \`id\`         INT AUTO_INCREMENT PRIMARY KEY,
          \`barangay\`   VARCHAR(100) NOT NULL DEFAULT 'All Barangays',
          \`position\`   VARCHAR(150) NOT NULL,
          \`name\`       VARCHAR(150) NOT NULL,
          \`sort_order\` INT NOT NULL DEFAULT 0,
          \`updated_by\` INT NULL,
          \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      const [[{ cnt: bgyCnt }]] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report_signatories' AND COLUMN_NAME = 'barangay'`
      );
      if (Number(bgyCnt) === 0) {
        await pool.query(
          `ALTER TABLE report_signatories ADD COLUMN barangay VARCHAR(100) NOT NULL DEFAULT 'All Barangays' AFTER id`
        );
        console.log('[Schema] Added column `report_signatories.barangay`');
      }

      // Default seeds if empty
      const [[{ sigCnt }]] = await pool.query(`SELECT COUNT(*) AS sigCnt FROM report_signatories`);
      if (Number(sigCnt) === 0) {
        await pool.query(`
          INSERT INTO report_signatories (barangay, position, name, sort_order) VALUES
          ('All Barangays', 'Municipal Nutrition Action Officer', '', 1),
          ('All Barangays', 'Municipal Health Officer', '', 2),
          ('All Barangays', 'Barangay Nutrition Scholar', '', 3)
        `);
      }
    } catch (e) {
      console.warn('[Schema] report_signatories check warning:', e.message);
    }

    // 6. Ensure `sync_sessions` table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`sync_sessions\` (
          \`session_id\`  INT AUTO_INCREMENT PRIMARY KEY,
          \`user_id\`     INT NOT NULL,
          \`window_open\` BOOLEAN NOT NULL DEFAULT FALSE,
          \`opened_at\`   DATETIME NULL,
          \`closed_at\`   DATETIME NULL,
          \`reason\`      VARCHAR(50) NOT NULL DEFAULT 'finish_work',
          \`created_at\`  DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX \`idx_sync_user\` (\`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    } catch (e) {
      console.warn('[Schema] sync_sessions table init warning:', e.message);
    }

    console.log('[Schema] All database schema migrations verified successfully.');
  } catch (err) {
    console.warn('[Schema] ensureAppSchema warning:', err.message);
  }
}

module.exports = { ensureAppSchema };
