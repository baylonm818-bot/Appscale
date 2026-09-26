const mysql = require('mysql2/promise');
require('dotenv').config();

const parseMysqlUrl = (url) => {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        return {
            host: parsed.hostname,
            user: decodeURIComponent(parsed.username),
            password: decodeURIComponent(parsed.password),
            database: parsed.pathname.replace(/^\//, ''),
            port: parsed.port ? Number(parsed.port) : 3306,
        };
    } catch (error) {
        return null;
    }
};

const dbUrlConfig = parseMysqlUrl(process.env.DATABASE_URL || process.env.MYSQL_URL);
const resolvedHost = dbUrlConfig?.host || process.env.DB_HOST || 'localhost';
const shouldUseSsl = process.env.DB_SSL === 'true' || /aivencloud\.com$/i.test(resolvedHost);
const config = {
    host: resolvedHost,
    user: dbUrlConfig?.user || process.env.DB_USER || 'root',
    password: dbUrlConfig?.password ?? process.env.DB_PASSWORD ?? '',
    database: dbUrlConfig?.database || process.env.DB_NAME || '',
    port: dbUrlConfig?.port || (process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306),
    waitForConnections: true,
    ...(shouldUseSsl ? { ssl: { rejectUnauthorized: false } } : {}),
};

console.log('DB config:', {
    host: config.host,
    user: config.user,
    database: config.database,
    port: config.port,
    ssl: shouldUseSsl,
    password: config.password ? '****' : '(empty)',
});

const pool = mysql.createPool(config);

(async () => {
    try {
        const [rows] = await pool.query('SELECT 1+1 AS result');
        console.log('DB initial test OK:', rows[0]);
    } catch (err) {
        console.error('DB initial test failed:', err.message || err.stack);
    }
})();

module.exports = pool;
