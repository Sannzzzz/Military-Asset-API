const express = require('express');
const { AuditLog } = require('../models');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// Get audit logs - ADMIN and BASE_COMMANDER only
router.get('/', authorize('ADMIN', 'BASE_COMMANDER'), async (req, res) => {
    try {
        const user = req.user;
        let query = {};

        // BASE_COMMANDER sees only their base's logs
        // This would require tracking base in audit logs, for now show all for commander
        // In production, you'd filter by user's base

        const logs = await AuditLog.find(query)
            .populate('user')
            .sort({ createdAt: -1 })
            .limit(100);

        res.json(logs.map(log => ({
            id: log._id,
            action: log.action,
            entityType: log.entityType,
            entityId: log.entityId,
            details: log.details,
            timestamp: log.createdAt,
            user: log.user ? { fullName: log.user.fullName } : null
        })));
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
