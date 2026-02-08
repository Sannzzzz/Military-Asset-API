const express = require('express');
const { Purchase, Asset, AuditLog } = require('../models');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// Get all purchases - role-based
router.get('/', async (req, res) => {
    try {
        const user = req.user;

        // PERSONNEL cannot view purchases
        if (user.role === 'PERSONNEL') {
            return res.status(403).json({ error: 'Access denied' });
        }

        let query = {};
        if (user.role !== 'ADMIN' && user.baseId) {
            query.base = user.baseId;
        }

        const purchases = await Purchase.find(query)
            .populate('asset')
            .populate('base')
            .populate('createdBy')
            .sort({ createdAt: -1 });

        res.json(purchases.map(p => ({
            id: p._id,
            quantity: p.quantity,
            purchaseDate: p.createdAt,
            asset: p.asset ? { id: p.asset._id, name: p.asset.name, equipmentType: p.asset.equipmentType } : null,
            base: p.base ? { id: p.base._id, name: p.base.name } : null,
            createdBy: p.createdBy ? { fullName: p.createdBy.fullName } : null
        })));
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create purchase (ADMIN only)
router.post('/', authorize('ADMIN'), async (req, res) => {
    try {
        const { asset, base, quantity } = req.body;

        const purchase = await Purchase.create({
            asset: asset.id,
            base: base.id,
            quantity,
            createdBy: req.user.id
        });

        // Increase asset quantity
        await Asset.findByIdAndUpdate(asset.id, { $inc: { quantity: quantity } });

        const assetDoc = await Asset.findById(asset.id);

        await AuditLog.create({
            action: 'PURCHASE',
            entityType: 'PURCHASE',
            entityId: purchase._id,
            details: `Purchased ${quantity} of ${assetDoc?.name}`,
            user: req.user.id
        });

        res.status(201).json({ id: purchase._id });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
