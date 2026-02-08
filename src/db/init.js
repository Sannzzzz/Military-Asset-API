const db = require('./pool');
const bcrypt = require('bcryptjs');

const initDatabase = async () => {
    console.log('Initializing SQLite database with RBAC...');

    try {
        // Create tables
        db.exec(`
            -- Drop tables if exist
            DROP TABLE IF EXISTS audit_logs;
            DROP TABLE IF EXISTS maintenance_records;
            DROP TABLE IF EXISTS damage_reports;
            DROP TABLE IF EXISTS asset_requests;
            DROP TABLE IF EXISTS assignments;
            DROP TABLE IF EXISTS transfers;
            DROP TABLE IF EXISTS purchases;
            DROP TABLE IF EXISTS assets;
            DROP TABLE IF EXISTS personnel;
            DROP TABLE IF EXISTS users;
            DROP TABLE IF EXISTS bases;

            -- Bases table
            CREATE TABLE bases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                location TEXT
            );

            -- Users table with roles
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                full_name TEXT,
                role TEXT NOT NULL DEFAULT 'PERSONNEL',
                base_id INTEGER REFERENCES bases(id),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            -- Assets table
            CREATE TABLE assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                equipment_type TEXT NOT NULL,
                quantity INTEGER DEFAULT 0,
                condition TEXT DEFAULT 'GOOD',
                base_id INTEGER REFERENCES bases(id)
            );

            -- Personnel table
            CREATE TABLE personnel (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                rank TEXT,
                user_id INTEGER REFERENCES users(id),
                base_id INTEGER REFERENCES bases(id)
            );

            -- Purchases table
            CREATE TABLE purchases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id INTEGER REFERENCES assets(id),
                base_id INTEGER REFERENCES bases(id),
                quantity INTEGER NOT NULL,
                purchase_date TEXT DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER REFERENCES users(id)
            );

            -- Transfers table with approval
            CREATE TABLE transfers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id INTEGER REFERENCES assets(id),
                from_base_id INTEGER REFERENCES bases(id),
                to_base_id INTEGER REFERENCES bases(id),
                quantity INTEGER NOT NULL,
                status TEXT DEFAULT 'PENDING',
                requested_by INTEGER REFERENCES users(id),
                approved_by INTEGER REFERENCES users(id),
                transfer_date TEXT DEFAULT CURRENT_TIMESTAMP,
                approved_date TEXT
            );

            -- Assignments table
            CREATE TABLE assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id INTEGER REFERENCES assets(id),
                personnel_id INTEGER REFERENCES personnel(id),
                quantity INTEGER NOT NULL,
                issued_by INTEGER REFERENCES users(id),
                assignment_date TEXT DEFAULT CURRENT_TIMESTAMP,
                return_date TEXT,
                returned_to INTEGER REFERENCES users(id)
            );

            -- Asset Requests table (for PERSONNEL role)
            CREATE TABLE asset_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id INTEGER REFERENCES assets(id),
                requested_by INTEGER REFERENCES users(id),
                quantity INTEGER NOT NULL,
                reason TEXT,
                status TEXT DEFAULT 'PENDING',
                reviewed_by INTEGER REFERENCES users(id),
                request_date TEXT DEFAULT CURRENT_TIMESTAMP,
                review_date TEXT
            );

            -- Maintenance Records table
            CREATE TABLE maintenance_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id INTEGER REFERENCES assets(id),
                description TEXT,
                maintenance_type TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            -- Damage Reports table
            CREATE TABLE damage_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id INTEGER REFERENCES assets(id),
                assignment_id INTEGER REFERENCES assignments(id),
                description TEXT,
                severity TEXT DEFAULT 'MINOR',
                reported_by INTEGER REFERENCES users(id),
                reported_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            -- Audit logs table
            CREATE TABLE audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                entity_type TEXT,
                entity_id INTEGER,
                details TEXT,
                user_id INTEGER REFERENCES users(id),
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('Tables created');

        // Insert bases
        const insertBase = db.prepare('INSERT INTO bases (name, location) VALUES (?, ?)');
        const base1 = insertBase.run('Alpha Base', 'Northern Region');
        const base2 = insertBase.run('Bravo Base', 'Southern Region');
        const base3 = insertBase.run('Charlie Base', 'Eastern Region');
        console.log('Bases created');

        // Insert users with different roles
        const adminPass = await bcrypt.hash('admin123', 10);
        const commanderPass = await bcrypt.hash('commander123', 10);
        const logisticsPass = await bcrypt.hash('logistics123', 10);
        const personnelPass = await bcrypt.hash('personnel123', 10);

        const insertUser = db.prepare('INSERT INTO users (username, password, full_name, role, base_id) VALUES (?, ?, ?, ?, ?)');

        // ADMIN - full access
        insertUser.run('admin', adminPass, 'System Administrator', 'ADMIN', null);

        // BASE_COMMANDER - per base
        insertUser.run('commander1', commanderPass, 'Alpha Base Commander', 'BASE_COMMANDER', base1.lastInsertRowid);
        insertUser.run('commander2', commanderPass, 'Bravo Base Commander', 'BASE_COMMANDER', base2.lastInsertRowid);

        // LOGISTICS_OFFICER - per base
        insertUser.run('logistics1', logisticsPass, 'Alpha Logistics Officer', 'LOGISTICS_OFFICER', base1.lastInsertRowid);
        insertUser.run('logistics2', logisticsPass, 'Bravo Logistics Officer', 'LOGISTICS_OFFICER', base2.lastInsertRowid);

        // PERSONNEL - per base
        const p1 = insertUser.run('john.smith', personnelPass, 'John Smith', 'PERSONNEL', base1.lastInsertRowid);
        const p2 = insertUser.run('jane.doe', personnelPass, 'Jane Doe', 'PERSONNEL', base1.lastInsertRowid);
        const p3 = insertUser.run('bob.wilson', personnelPass, 'Bob Wilson', 'PERSONNEL', base2.lastInsertRowid);

        console.log('Users created');

        // Link personnel to users
        const insertPersonnel = db.prepare('INSERT INTO personnel (name, rank, user_id, base_id) VALUES (?, ?, ?, ?)');
        insertPersonnel.run('John Smith', 'Sergeant', p1.lastInsertRowid, base1.lastInsertRowid);
        insertPersonnel.run('Jane Doe', 'Corporal', p2.lastInsertRowid, base1.lastInsertRowid);
        insertPersonnel.run('Bob Wilson', 'Private', p3.lastInsertRowid, base2.lastInsertRowid);
        console.log('Personnel created');

        // Insert assets
        const insertAsset = db.prepare('INSERT INTO assets (name, equipment_type, quantity, condition, base_id) VALUES (?, ?, ?, ?, ?)');
        insertAsset.run('Humvee', 'VEHICLE', 10, 'GOOD', base1.lastInsertRowid);
        insertAsset.run('M16 Rifle', 'WEAPON', 50, 'GOOD', base1.lastInsertRowid);
        insertAsset.run('5.56mm Rounds', 'AMMUNITION', 10000, 'GOOD', base1.lastInsertRowid);
        insertAsset.run('Tank M1', 'VEHICLE', 5, 'GOOD', base2.lastInsertRowid);
        insertAsset.run('AK-47', 'WEAPON', 30, 'FAIR', base2.lastInsertRowid);
        insertAsset.run('9mm Rounds', 'AMMUNITION', 5000, 'GOOD', base3.lastInsertRowid);
        console.log('Assets created');

        console.log('\n✅ Database initialized with RBAC!');
        console.log('\n=== Demo Users ===');
        console.log('ADMIN:            admin / admin123');
        console.log('BASE_COMMANDER:   commander1 / commander123 (Alpha Base)');
        console.log('BASE_COMMANDER:   commander2 / commander123 (Bravo Base)');
        console.log('LOGISTICS_OFFICER: logistics1 / logistics123 (Alpha Base)');
        console.log('LOGISTICS_OFFICER: logistics2 / logistics123 (Bravo Base)');
        console.log('PERSONNEL:        john.smith / personnel123 (Alpha Base)');
        console.log('PERSONNEL:        jane.doe / personnel123 (Alpha Base)');
        console.log('PERSONNEL:        bob.wilson / personnel123 (Bravo Base)');

        process.exit(0);
    } catch (err) {
        console.error('Database initialization failed:', err);
        process.exit(1);
    }
};

initDatabase();
