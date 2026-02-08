const express = require('express');
const db = require('../db/pool');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// Get maintenance records - role-based
router.get('/', (req, res) => {
    try {
        const user = req.user;
        let query = `
            SELECT m.*, 
                   a.name as asset_name, a.equipment_type,
                   u.full_name as created_by_name
            FROM maintenance_records m
            LEFT JOIN assets a ON m.asset_id = a.id
            LEFT JOIN users u ON m.created_by = u.id
        `;
        const params = [];

        // PERSONNEL cannot view maintenance records
        if (user.role === 'PERSONNEL') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Non-admin sees only their base
        if (user.role !== 'ADMIN') {
            query += ' WHERE a.base_id = ?';
            params.push(user.baseId);
        }

        query += ' ORDER BY m.created_at DESC';

        const rows = db.prepare(query).all(...params);

        const records = rows.map(row => ({
            id: row.id,
            description: row.description,
            maintenanceType: row.maintenance_type,
            createdAt: row.created_at,
            asset: { id: row.asset_id, name: row.asset_name, equipmentType: row.equipment_type },
            createdBy: { fullName: row.created_by_name }
        }));

        res.json(records);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create maintenance record (LOGISTICS_OFFICER, ADMIN)
router.post('/', authorize('ADMIN', 'LOGISTICS_OFFICER'), (req, res) => {
    try {
        const { assetId, description, maintenanceType } = req.body;
        const user = req.user;

        // Check asset is in same base for non-admin
        if (user.role !== 'ADMIN') {
            const asset = db.prepare('SELECT base_id FROM assets WHERE id = ?').get(assetId);
            if (!asset || asset.base_id !== user.baseId) {
                return res.status(403).json({ error: 'Cannot create maintenance for assets from other bases' });
            }
        }

        const result = db.prepare(
            'INSERT INTO maintenance_records (asset_id, description, maintenance_type, created_by) VALUES (?, ?, ?, ?)'
        ).run(assetId, description, maintenanceType, user.id);

        const asset = db.prepare('SELECT name FROM assets WHERE id = ?').get(assetId);

        db.prepare(
            'INSERT INTO audit_logs (action, entity_type, entity_id, details, user_id) VALUES (?, ?, ?, ?, ?)'
        ).run('CREATE_MAINTENANCE', 'MAINTENANCE', result.lastInsertRowid,
            `Maintenance record for ${asset?.name}: ${maintenanceType}`, user.id);

        res.status(201).json({ id: result.lastInsertRowid });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

module.exports = router;
