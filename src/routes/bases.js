const express = require('express');
const { Base, AuditLog } = require('../models');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// Get all bases - role-based
router.get('/', async (req, res) => {
    try {
        const user = req.user;

        // ADMIN sees all bases
        if (user.role === 'ADMIN') {
            const bases = await Base.find().sort({ name: 1 });
            return res.json(bases.map(b => ({
                id: b._id,
                name: b.name,
                location: b.location
            })));
        }

        // Others see only their assigned base
        if (user.baseId) {
            const base = await Base.findById(user.baseId);
            if (base) {
                return res.json([{
                    id: base._id,
                    name: base.name,
                    location: base.location
                }]);
            }
        }

        res.json([]);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create base (ADMIN only)
router.post('/', authorize('ADMIN'), async (req, res) => {
    try {
        const { name, location } = req.body;

        const base = await Base.create({ name, location });

        await AuditLog.create({
            action: 'CREATE_BASE',
            entityType: 'BASE',
            entityId: base._id,
            details: `Created base: ${name}`,
            user: req.user.id
        });

        res.status(201).json({ id: base._id, name, location });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update base (ADMIN only)
router.put('/:id', authorize('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, location } = req.body;

        await Base.findByIdAndUpdate(id, { name, location });

        res.json({ message: 'Base updated' });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete base (ADMIN only)
router.delete('/:id', authorize('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;

        await Base.findByIdAndDelete(id);

        res.json({ message: 'Base deleted' });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
