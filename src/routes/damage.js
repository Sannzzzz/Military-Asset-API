const express = require('express');
const db = require('../db/pool');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// Get damage reports - role-based
router.get('/', (req, res) => {
    try {
        const user = req.user;
        let query = `
            SELECT d.*, 
                   a.name as asset_name, a.equipment_type,
                   u.full_name as reported_by_name
            FROM damage_reports d
            LEFT JOIN assets a ON d.asset_id = a.id
            LEFT JOIN users u ON d.reported_by = u.id
        `;
        const params = [];

        // PERSONNEL sees only their own reports
        if (user.role === 'PERSONNEL') {
            query += ' WHERE d.reported_by = ?';
            params.push(user.id);
        } else if (user.role !== 'ADMIN') {
            query += ' WHERE a.base_id = ?';
            params.push(user.baseId);
        }

        query += ' ORDER BY d.reported_at DESC';

        const rows = db.prepare(query).all(...params);

        const reports = rows.map(row => ({
            id: row.id,
            description: row.description,
            severity: row.severity,
            reportedAt: row.reported_at,
            asset: { id: row.asset_id, name: row.asset_name, equipmentType: row.equipment_type },
            reportedBy: { fullName: row.reported_by_name }
        }));

        res.json(reports);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Report damage (PERSONNEL, LOGISTICS_OFFICER, ADMIN)
router.post('/', authorize('ADMIN', 'LOGISTICS_OFFICER', 'PERSONNEL'), (req, res) => {
    try {
        const { assetId, assignmentId, description, severity } = req.body;
        const user = req.user;

        // PERSONNEL can only report damage on their assignments
        if (user.role === 'PERSONNEL' && assignmentId) {
            const assignment = db.prepare(`
                SELECT a.*, p.user_id 
                FROM assignments a
                JOIN personnel p ON a.personnel_id = p.id
                WHERE a.id = ?
            `).get(assignmentId);

            if (!assignment || assignment.user_id !== user.id) {
                return res.status(403).json({ error: 'You can only report damage on your own assignments' });
            }
        }

        const result = db.prepare(
            'INSERT INTO damage_reports (asset_id, assignment_id, description, severity, reported_by) VALUES (?, ?, ?, ?, ?)'
        ).run(assetId, assignmentId || null, description, severity || 'MINOR', user.id);

        const asset = db.prepare('SELECT name FROM assets WHERE id = ?').get(assetId);

        db.prepare(
            'INSERT INTO audit_logs (action, entity_type, entity_id, details, user_id) VALUES (?, ?, ?, ?, ?)'
        ).run('DAMAGE_REPORT', 'DAMAGE_REPORT', result.lastInsertRowid,
            `Damage reported on ${asset?.name}: ${severity || 'MINOR'}`, user.id);

        res.status(201).json({ id: result.lastInsertRowid });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

module.exports = router;
