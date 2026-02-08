const express = require('express');
const { Asset, AuditLog } = require('../models');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// Get all assets - role-based filtering
router.get('/', async (req, res) => {
    try {
        const user = req.user;

        // PERSONNEL cannot view inventory list
        if (user.role === 'PERSONNEL') {
            return res.status(403).json({ error: 'Personnel cannot view inventory list' });
        }

        let query = {};
        // Non-admin users can only see their base's assets
        if (user.role !== 'ADMIN' && user.baseId) {
            query.base = user.baseId;
        }

        const assets = await Asset.find(query).populate('base').sort({ name: 1 });

        res.json(assets.map(a => ({
            id: a._id,
            name: a.name,
            equipmentType: a.equipmentType,
            quantity: a.quantity,
            condition: a.condition,
            base: a.base ? { id: a.base._id, name: a.base.name, location: a.base.location } : null
        })));
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create asset (ADMIN only)
router.post('/', authorize('ADMIN'), async (req, res) => {
    try {
        const { name, equipmentType, quantity, condition, baseId } = req.body;

        const asset = await Asset.create({
            name,
            equipmentType,
            quantity: quantity || 0,
            condition: condition || 'GOOD',
            base: baseId
        });

        await AuditLog.create({
            action: 'CREATE_ASSET',
            entityType: 'ASSET',
            entityId: asset._id,
            details: `Created asset: ${name}`,
            user: req.user.id
        });

        res.status(201).json({ id: asset._id, name, equipmentType });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update asset (ADMIN only)
router.put('/:id', authorize('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, equipmentType, quantity, condition, baseId } = req.body;

        await Asset.findByIdAndUpdate(id, {
            name,
            equipmentType,
            quantity,
            condition,
            base: baseId
        });

        await AuditLog.create({
            action: 'UPDATE_ASSET',
            entityType: 'ASSET',
            entityId: id,
            details: `Updated asset: ${name}`,
            user: req.user.id
        });

        res.json({ message: 'Asset updated' });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete asset (ADMIN only)
router.delete('/:id', authorize('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;

        const asset = await Asset.findByIdAndDelete(id);

        await AuditLog.create({
            action: 'DELETE_ASSET',
            entityType: 'ASSET',
            entityId: id,
            details: `Deleted asset: ${asset?.name}`,
            user: req.user.id
        });

        res.json({ message: 'Asset deleted' });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update asset condition (LOGISTICS_OFFICER, ADMIN)
router.patch('/:id/condition', authorize('ADMIN', 'LOGISTICS_OFFICER'), async (req, res) => {
    try {
        const { id } = req.params;
        const { condition } = req.body;

        if (!['GOOD', 'FAIR', 'POOR', 'NEEDS_REPAIR', 'DECOMMISSIONED'].includes(condition)) {
            return res.status(400).json({ error: 'Invalid condition' });
        }

        // Check base access for non-admin
        if (req.user.role !== 'ADMIN') {
            const asset = await Asset.findById(id);
            if (asset?.base?.toString() !== req.user.baseId) {
                return res.status(403).json({ error: 'Cannot update assets from other bases' });
            }
        }

        await Asset.findByIdAndUpdate(id, { condition });

        await AuditLog.create({
            action: 'UPDATE_CONDITION',
            entityType: 'ASSET',
            entityId: id,
            details: `Updated condition to: ${condition}`,
            user: req.user.id
        });

        res.json({ message: 'Condition updated' });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
