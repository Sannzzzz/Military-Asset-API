const express = require('express');
const { Personnel, AuditLog } = require('../models');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// Get personnel - role-based
router.get('/', async (req, res) => {
    try {
        const user = req.user;
        let query = {};

        // PERSONNEL can only see themselves
        if (user.role === 'PERSONNEL') {
            query.user = user.id;
        } else if (user.role !== 'ADMIN' && user.baseId) {
            query.base = user.baseId;
        }

        const personnelList = await Personnel.find(query).populate('base').sort({ name: 1 });

        res.json(personnelList.map(p => ({
            id: p._id,
            name: p.name,
            rank: p.rank,
            userId: p.user,
            base: p.base ? { id: p.base._id, name: p.base.name } : null
        })));
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create personnel
router.post('/', authorize('ADMIN', 'BASE_COMMANDER', 'LOGISTICS_OFFICER'), async (req, res) => {
    try {
        const { name, rank, userId, baseId } = req.body;
        const user = req.user;

        // Non-admin can only add to their base
        const targetBaseId = user.role === 'ADMIN' ? (baseId || null) : user.baseId;

        const personnel = await Personnel.create({
            name,
            rank,
            user: userId || null,
            base: targetBaseId
        });

        await AuditLog.create({
            action: 'CREATE_PERSONNEL',
            entityType: 'PERSONNEL',
            entityId: personnel._id,
            details: `Created personnel: ${name}`,
            user: user.id
        });

        res.status(201).json({ id: personnel._id, name, rank });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update personnel
router.put('/:id', authorize('ADMIN', 'BASE_COMMANDER'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, rank, baseId } = req.body;
        const user = req.user;

        // Check access for non-admin
        if (user.role !== 'ADMIN') {
            const p = await Personnel.findById(id);
            if (!p || p.base?.toString() !== user.baseId) {
                return res.status(403).json({ error: 'Cannot update personnel from other bases' });
            }
        }

        await Personnel.findByIdAndUpdate(id, { name, rank, base: baseId });

        res.json({ message: 'Personnel updated' });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
