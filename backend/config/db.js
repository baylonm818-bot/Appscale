const mysql = require('mysql2/promise');
require('dotenv').config();

const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    waitForConnections: true,
};

// Log non-sensitive connection info for easier debugging (mask password)
console.log('DB config:', {
    host: config.host,
    user: config.user,
    database: config.database,
    port: config.port,
    password: config.password ? '****' : '(empty)'
});

const pool = mysql.createPool(config);

// Test a connection immediately and log a helpful error if it fails
(async () => {
    try {
        const [rows] = await pool.query('SELECT 1+1 AS result');
        console.log('DB initial test OK:', rows[0]);
    } catch (err) {
        console.error('DB initial test failed:', err.message || err.stack);
    }
})();

module.exports = pool;
