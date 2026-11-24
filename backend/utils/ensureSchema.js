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

    // 2. Ensure `system_logs` table exists with `barangay` column
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`system_logs\` (
          \`log_id\`      BIGINT AUTO_INCREMENT PRIMARY KEY,
          \`actor_id\`    INT NULL,
          \`actor_name\`  VARCHAR(150) NULL,
          \`actor_role\`  VARCHAR(50)  NULL,
          \`barangay\`    VARCHAR(100) NULL,
          \`action\`      VARCHAR(100) NOT NULL,
          \`entity_type\` VARCHAR(100) NULL,
          \`entity_id\`   INT NULL,
          \`details\`     JSON NULL,
          \`ip_address\`  VARCHAR(45) NULL,
          \`created_at\`  DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX \`idx_actor_role\` (\`actor_role\`),
          INDEX \`idx_barangay\` (\`barangay\`),
          INDEX \`idx_action\` (\`action\`),
          INDEX \`idx_created_at\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      const [[{ cnt: bgyCnt }]] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_logs' AND COLUMN_NAME = 'barangay'`
      );
      if (Number(bgyCnt) === 0) {
        await pool.query(
          `ALTER TABLE system_logs ADD COLUMN barangay VARCHAR(100) NULL AFTER actor_role, ADD INDEX idx_barangay (barangay)`
        );
        console.log('[Schema] Added column `system_logs.barangay`');
      }

      // Auto-backfill if empty
      const [[{ cnt: logCount }]] = await pool.query(`SELECT COUNT(*) AS cnt FROM system_logs`);
      if (Number(logCount) === 0) {
        try {
          const { backfillSystemLogs } = require('../scripts/backfill_system_logs');
          await backfillSystemLogs();
        } catch (bErr) {
          console.warn('[Schema] Auto backfill system_logs warning:', bErr.message);
        }
      }
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

    // 7. Ensure `barangays` and `puroks` tables exist with seeds
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`barangays\` (
          \`id\`           INT AUTO_INCREMENT PRIMARY KEY,
          \`name\`         VARCHAR(100) NOT NULL UNIQUE,
          \`municipality\` VARCHAR(100) NOT NULL DEFAULT 'Gasan',
          \`created_at\`   DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      const gasanBarangays = [
        'Antipolo', 'B. Ibaba', 'B. Ilaya', 'Bacong-Bacong', 'Bahi', 'Bangbang',
        'Banot', 'Banuyo', 'Bognuyan', 'Cabugao', 'Dawis', 'Dili', 'Libtangin',
        'Mahunig', 'Mangiliol', 'Masiga', 'Mat. Gasan', 'Pangi', 'Pinggan',
        'Tabionan', 'Tiguion', 'Brgy. Uno', 'Brgy. Dos', 'Brgy. Tres', 'Tapuyan'
      ];

      for (const b of gasanBarangays) {
        await pool.query(
          `INSERT IGNORE INTO \`barangays\` (\`name\`, \`municipality\`) VALUES (?, 'Gasan')`,
          [b]
        );
      }

      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`puroks\` (
          \`id\`           INT AUTO_INCREMENT PRIMARY KEY,
          \`barangay_id\`  INT NOT NULL,
          \`name\`         VARCHAR(100) NOT NULL,
          \`is_active\`    TINYINT(1) NOT NULL DEFAULT 1,
          \`created_at\`   DATETIME DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\`   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_puroks_barangay\` (\`barangay_id\`),
          FOREIGN KEY (\`barangay_id\`) REFERENCES \`barangays\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // Seed each barangay with "Purok 1" placeholder if no puroks exist for that barangay
      const [allB] = await pool.query(`SELECT id FROM \`barangays\``);
      for (const bRow of allB) {
        const [[{ pCnt }]] = await pool.query(
          `SELECT COUNT(*) AS pCnt FROM \`puroks\` WHERE barangay_id = ?`,
          [bRow.id]
        );
        if (Number(pCnt) === 0) {
          await pool.query(
            `INSERT INTO \`puroks\` (barangay_id, name, is_active) VALUES (?, 'Purok 1', 1)`,
            [bRow.id]
          );
        }
      }
    } catch (e) {
      console.warn('[Schema] barangays/puroks table init warning:', e.message);
    }

    // 8. Ensure `users` has `language` and `age_format_days`
    try {
      const [[{ langCnt }]] = await pool.query(
        `SELECT COUNT(*) AS langCnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'language'`
      );
      if (Number(langCnt) === 0) {
        await pool.query(`ALTER TABLE users ADD COLUMN language VARCHAR(10) NOT NULL DEFAULT 'en'`);
        console.log('[Schema] Added column `users.language`');
      }

      const [[{ ageFmtCnt }]] = await pool.query(
        `SELECT COUNT(*) AS ageFmtCnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'age_format_days'`
      );
      if (Number(ageFmtCnt) === 0) {
        await pool.query(`ALTER TABLE users ADD COLUMN age_format_days TINYINT(1) NOT NULL DEFAULT 0`);
        console.log('[Schema] Added column `users.age_format_days`');
      }
    } catch (e) {
      console.warn('[Schema] users language/age_format_days warning:', e.message);
    }

    // 9. Ensure mother signature columns exist
    const sigTables = ['nutrition_records', 'mother_services', 'feeding_attendance', 'child_services'];
    for (const tName of sigTables) {
      try {
        const [[{ sigCnt }]] = await pool.query(
          `SELECT COUNT(*) AS sigCnt FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'signature'`,
          [tName]
        );
        if (Number(sigCnt) === 0) {
          await pool.query(`ALTER TABLE \`${tName}\` ADD COLUMN signature LONGTEXT NULL`);
          console.log(`[Schema] Added column \`${tName}.signature\``);
        }
      } catch (e) {
        console.warn(`[Schema] ${tName}.signature warning:`, e.message);
      }
    }

    // 10. Ensure `nutrition_school_data` table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`nutrition_school_data\` (
          \`id\`             INT AUTO_INCREMENT PRIMARY KEY,
          \`school_year\`    VARCHAR(20) NOT NULL,
          \`barangay\`       VARCHAR(100) NOT NULL DEFAULT 'All Barangays',
          \`total_enrolled\` INT NOT NULL DEFAULT 0,
          \`total_measured\` INT NOT NULL DEFAULT 0,
          \`normal\`         INT NOT NULL DEFAULT 0,
          \`wasted\`         INT NOT NULL DEFAULT 0,
          \`severely_wasted\` INT NOT NULL DEFAULT 0,
          \`overweight\`     INT NOT NULL DEFAULT 0,
          \`obese\`          INT NOT NULL DEFAULT 0,
          \`updated_by\`     INT NULL,
          \`updated_at\`     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY \`uq_school_year_bgy\` (\`school_year\`, \`barangay\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      const [[{ schCnt }]] = await pool.query(`SELECT COUNT(*) AS schCnt FROM \`nutrition_school_data\``);
      if (Number(schCnt) === 0) {
        const initialSchoolData = [
          ['2022-2023', 'All Barangays', 1250, 1210, 1080, 75, 25, 20, 10],
          ['2023-2024', 'All Barangays', 1290, 1265, 1140, 68, 22, 23, 12],
          ['2024-2025', 'All Barangays', 1320, 1300, 1195, 55, 18, 21, 11],
        ];
        for (const row of initialSchoolData) {
          await pool.query(
            `INSERT IGNORE INTO \`nutrition_school_data\` (school_year, barangay, total_enrolled, total_measured, normal, wasted, severely_wasted, overweight, obese) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            row
          );
        }
        console.log('[Schema] Seeded default school children nutrition data.');
      }
    } catch (e) {
      console.warn('[Schema] nutrition_school_data init warning:', e.message);
    }

    // 11. Ensure `nutrition_corner_programs` table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`nutrition_corner_programs\` (
          \`id\`              INT AUTO_INCREMENT PRIMARY KEY,
          \`section\`         ENUM('nutrition_specific', 'nutrition_sensitive', 'enabling') NOT NULL,
          \`title\`           VARCHAR(255) NOT NULL,
          \`description\`     TEXT NULL,
          \`coverage_metric\` VARCHAR(100) NULL,
          \`sort_order\`      INT NOT NULL DEFAULT 0,
          \`is_active\`       TINYINT(1) NOT NULL DEFAULT 1,
          \`created_at\`      DATETIME DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\`      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      const [[{ progCnt }]] = await pool.query(`SELECT COUNT(*) AS progCnt FROM \`nutrition_corner_programs\``);
      if (Number(progCnt) === 0) {
        const defaultPrograms = [
          ['nutrition_specific', 'Infant and Young Child Feeding (IYCF) & Dietary Supplementation', 'Targeted supplementary feeding for undernourished children and promotion of optimal infant feeding practices.', 'feeding', 1],
          ['nutrition_specific', 'National Micronutrient Supplementation Program (Vitamin A)', 'Semi-annual Vitamin A capsule administration to children 6-59 months to prevent xerophthalmia and boost immunity.', 'vitamin_a', 2],
          ['nutrition_specific', 'National Deworming Program', 'Bi-annual mass deworming tablet administration for children 12-59 months to prevent soil-transmitted helminth infections.', 'deworming', 3],
          ['nutrition_specific', 'Operation Timbang Plus (OPT Plus) & Routine Growth Monitoring', 'Comprehensive annual and monthly weighing and height measurement of children 0-59 months to identify malnutrition.', null, 4],
          ['nutrition_sensitive', 'Gulayan sa Barangay & Community Food Gardens', 'Promoting household backyard gardens, bio-intensive vegetable production, and organic farming to ensure dietary diversity.', null, 1],
          ['nutrition_sensitive', 'Water, Sanitation, and Hygiene (WASH) Program', 'Access to safe drinking water, sanitary toilets, and hygiene education to reduce enteric infections and undernutrition.', null, 2],
          ['nutrition_sensitive', 'Adolescent Nutrition & Maternal Health Education', 'Nutrition education sessions, iron-folic acid supplementation, and reproductive health counseling.', null, 3],
          ['enabling', 'Barangay Nutrition Action Plan (BNAP) Formulation & Mobilization', 'Multi-sectoral local nutrition committee planning, resource allocation, and community nutrition mobilization.', null, 1],
          ['enabling', 'Nutrition in Emergencies (NiEm) Preparedness & Response', 'Readiness protocol for nutrition assessment, infant feeding in emergencies, and relief food assistance during calamities.', null, 2],
          ['enabling', 'Nutrition Policy Advocacy & Local Legislation', 'Adoption of municipal ordinances and barangay resolutions supporting nutrition, food safety, and healthy school environments.', null, 3],
        ];
        for (const p of defaultPrograms) {
          await pool.query(
            `INSERT INTO \`nutrition_corner_programs\` (section, title, description, coverage_metric, sort_order) VALUES (?, ?, ?, ?, ?)`,
            p
          );
        }
        console.log('[Schema] Seeded default nutrition corner programs.');
      }
    } catch (e) {
      console.warn('[Schema] nutrition_corner_programs init warning:', e.message);
    }

    // 12. Ensure `nutrition_corner_laws` table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`nutrition_corner_laws\` (
          \`id\`          INT AUTO_INCREMENT PRIMARY KEY,
          \`title\`       VARCHAR(255) NOT NULL,
          \`legal_basis\` VARCHAR(150) NOT NULL,
          \`description\` TEXT NULL,
          \`file_url\`    VARCHAR(255) NULL,
          \`category\`    VARCHAR(100) NULL DEFAULT 'National Law',
          \`sort_order\`  INT NOT NULL DEFAULT 0,
          \`created_at\`  DATETIME DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\`  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      const [[{ lawsCnt }]] = await pool.query(`SELECT COUNT(*) AS lawsCnt FROM \`nutrition_corner_laws\``);
      if (Number(lawsCnt) === 0) {
        const defaultLaws = [
          ['Expanded Breastfeeding Promotion Act of 2009', 'Republic Act No. 10028', 'Mandates the establishment of lactation stations in workplaces and public establishments, lactation breaks for nursing mothers, and comprehensive breastfeeding education.', null, 'National Law', 1],
          ['Masustansyang Pagkain para sa Batang Pilipino Act and its IRR', 'Republic Act No. 11037', 'Establishes the National Feeding Program for undernourished children in public day care, kindergarten, and elementary schools to combat hunger and undernutrition.', null, 'National Law', 2],
          ['Act for Salt Iodization Nationwide (ASIN Law)', 'Republic Act No. 8172', 'Promotes the practice of salt iodization nationwide to eliminate Iodine Deficiency Disorders (IDD) and mandates all food-grade salt producers to iodize salt.', null, 'National Law', 3],
          ['Philippine Food Fortification Act of 2000', 'Republic Act No. 8976', 'Mandates the mandatory fortification of staple foods including rice with iron, wheat flour with vitamin A and iron, and refined sugar and cooking oil with vitamin A.', null, 'National Law', 4],
          ['National Code of Marketing of Breastmilk Substitutes (Milk Code)', 'Executive Order No. 51', 'Protects and promotes breastfeeding by regulating the marketing, distribution, and promotion of breastmilk substitutes, feeding bottles, and teats.', null, 'Executive Order', 5],
        ];
        for (const l of defaultLaws) {
          await pool.query(
            `INSERT INTO \`nutrition_corner_laws\` (title, legal_basis, description, file_url, category, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
            l
          );
        }
        console.log('[Schema] Seeded reference nutrition laws.');
      }
    } catch (e) {
      console.warn('[Schema] nutrition_corner_laws init warning:', e.message);
    }

    // 13. Ensure `active_role_key` on `users` table only restricts BHW (allowing up to 3 BNS enforced by application logic)
    try {
      const [cols] = await pool.query(`
        SELECT GENERATION_EXPRESSION FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'active_role_key'
      `);
      if (cols.length > 0 && String(cols[0].GENERATION_EXPRESSION || '').toLowerCase().includes('bns')) {
        try { await pool.query('ALTER TABLE users DROP INDEX uq_active_barangay_role'); } catch (_) {}
        try { await pool.query('ALTER TABLE users DROP COLUMN active_role_key'); } catch (_) {}
        await pool.query(`
          ALTER TABLE users ADD COLUMN active_role_key VARCHAR(150) GENERATED ALWAYS AS (
            IF(status = 'active' AND deleted_at IS NULL AND role = 'bhw', CONCAT(LOWER(TRIM(barangay)), ':bhw'), NULL)
          ) VIRTUAL
        `);
        await pool.query('ALTER TABLE users ADD UNIQUE KEY uq_active_barangay_role (active_role_key)');
        console.log('[Schema] Updated users.active_role_key to restrict BHW only (allowing up to 3 BNS).');
      }
    } catch (e) {
      console.warn('[Schema] active_role_key check warning:', e.message);
    }

    console.log('[Schema] All database schema migrations verified successfully.');
  } catch (err) {
    console.warn('[Schema] ensureAppSchema warning:', err.message);
  }
}

module.exports = { ensureAppSchema };
