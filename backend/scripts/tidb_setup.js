const pool = require('../config/db.js');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

async function run() {
    try {
        let sql = fs.readFileSync(path.join(__dirname, 'setup_db.sql'), 'utf-8');
        
        // Remove comments
        sql = sql.replace(/--.*$/gm, '');
        
        const statements = sql.split(';').map(s => s.trim()).filter(s => 
            s && 
            !s.toLowerCase().startsWith('create database') && 
            !s.toLowerCase().startsWith('create user') && 
            !s.toLowerCase().startsWith('grant') && 
            !s.toLowerCase().startsWith('flush') && 
            !s.toLowerCase().startsWith('use ')
        );
        
        for (let stmt of statements) {
            console.log('Executing:', stmt.substring(0, 80).replace(/\n/g, ' '));
            await pool.query(stmt);
        }

        const adminHash = await bcrypt.hash('12345678', 10);
        await pool.query(
            'INSERT IGNORE INTO users (username, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)', 
            ['admin', 'admin@apscale.local', adminHash, 'System', 'Admin', 'admin']
        );
        console.log('Done! Database tables created and admin seeded.');
        process.exit(0);
    } catch(err) {
        console.error('Error:', err);
        process.exit(1);
    }
}
run();
