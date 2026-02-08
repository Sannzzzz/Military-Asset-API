const express = require('express');
const { Transfer, Asset, AuditLog } = require('../models');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// Get transfers - role-based
router.get('/', async (req, res) => {
    try {
        const user = req.user;
        let query = {};

        // Non-admin users see only their base transfers
        if (user.role !== 'ADMIN' && user.baseId) {
            query.$or = [{ fromBase: user.baseId }, { toBase: user.baseId }];
        }

        const transfers = await Transfer.find(query)
            .populate('asset')
            .populate('fromBase')
            .populate('toBase')
            .populate('requestedBy')
            .populate('approvedBy')
            .sort({ createdAt: -1 });

        res.json(transfers.map(t => ({
            id: t._id,
            quantity: t.quantity,
            status: t.status,
            transferDate: t.createdAt,
            approvedDate: t.approvedDate,
            asset: t.asset ? { id: t.asset._id, name: t.asset.name, equipmentType: t.asset.equipmentType } : null,
            fromBase: t.fromBase ? { id: t.fromBase._id, name: t.fromBase.name } : null,
            toBase: t.toBase ? { id: t.toBase._id, name: t.toBase.name } : null,
            requestedBy: t.requestedBy ? { fullName: t.requestedBy.fullName } : null,
            approvedBy: t.approvedBy ? { fullName: t.approvedBy.fullName } : null
        })));
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create transfer request
router.post('/', authorize('ADMIN', 'BASE_COMMANDER'), async (req, res) => {
    try {
        const { asset, fromBase, toBase, quantity } = req.body;
        const user = req.user;

        // BASE_COMMANDER can only transfer FROM their base
        if (user.role === 'BASE_COMMANDER' && fromBase.id !== user.baseId) {
            return res.status(403).json({ error: 'You can only transfer assets from your base' });
        }

        // Check source asset quantity
        const sourceAsset = await Asset.findById(asset.id);
        if (!sourceAsset || sourceAsset.quantity < quantity) {
            return res.status(400).json({ error: 'Insufficient quantity for transfer' });
        }

        // ADMIN transfers are auto-approved
        const status = user.role === 'ADMIN' ? 'APPROVED' : 'PENDING';

        const transfer = await Transfer.create({
            asset: asset.id,
            fromBase: fromBase.id,
            toBase: toBase.id,
            quantity,
            status,
            requestedBy: user.id,
            approvedBy: user.role === 'ADMIN' ? user.id : null,
            approvedDate: user.role === 'ADMIN' ? new Date() : null
        });

        // If approved, execute the transfer
        if (status === 'APPROVED') {
            await executeTransfer(asset.id, fromBase.id, toBase.id, quantity, sourceAsset);
        }

        await AuditLog.create({
            action: 'TRANSFER_REQUEST',
            entityType: 'TRANSFER',
            entityId: transfer._id,
            details: `Transfer ${quantity} of ${sourceAsset.name} - Status: ${status}`,
            user: user.id
        });

        res.status(201).json({ id: transfer._id, status });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// Approve transfer
router.post('/:id/approve', authorize('ADMIN', 'BASE_COMMANDER'), async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const transfer = await Transfer.findById(id).populate('asset');
        if (!transfer) {
            return res.status(404).json({ error: 'Transfer not found' });
        }

        if (transfer.status !== 'PENDING') {
            return res.status(400).json({ error: 'Transfer is not pending' });
        }

        // BASE_COMMANDER can only approve transfers TO their base
        if (user.role === 'BASE_COMMANDER' && transfer.toBase.toString() !== user.baseId) {
            return res.status(403).json({ error: 'You can only approve transfers to your base' });
        }

        // Check quantity still available
        const sourceAsset = await Asset.findById(transfer.asset._id);
        if (!sourceAsset || sourceAsset.quantity < transfer.quantity) {
            return res.status(400).json({ error: 'Insufficient quantity for transfer' });
        }

        // Update transfer status
        transfer.status = 'APPROVED';
        transfer.approvedBy = user.id;
        transfer.approvedDate = new Date();
        await transfer.save();

        // Execute the transfer
        await executeTransfer(transfer.asset._id, transfer.fromBase, transfer.toBase, transfer.quantity, sourceAsset);

        await AuditLog.create({
            action: 'TRANSFER_APPROVED',
            entityType: 'TRANSFER',
            entityId: id,
            details: `Approved transfer of ${transfer.quantity} units`,
            user: user.id
        });

        res.json({ message: 'Transfer approved' });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// Reject transfer
router.post('/:id/reject', authorize('ADMIN', 'BASE_COMMANDER'), async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const transfer = await Transfer.findById(id);
        if (!transfer || transfer.status !== 'PENDING') {
            return res.status(400).json({ error: 'Cannot reject this transfer' });
        }

        if (user.role === 'BASE_COMMANDER' && transfer.toBase.toString() !== user.baseId) {
            return res.status(403).json({ error: 'You can only reject transfers to your base' });
        }

        transfer.status = 'REJECTED';
        await transfer.save();

        await AuditLog.create({
            action: 'TRANSFER_REJECTED',
            entityType: 'TRANSFER',
            entityId: id,
            details: 'Transfer rejected',
            user: user.id
        });

        res.json({ message: 'Transfer rejected' });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Helper function to execute transfer
async function executeTransfer(assetId, fromBaseId, toBaseId, quantity, sourceAsset) {
    // Reduce from source
    await Asset.findByIdAndUpdate(assetId, { $inc: { quantity: -quantity } });

    // Check if asset exists at destination
    let destAsset = await Asset.findOne({ base: toBaseId, name: sourceAsset.name });

    if (destAsset) {
        await Asset.findByIdAndUpdate(destAsset._id, { $inc: { quantity: quantity } });
    } else {
        await Asset.create({
            name: sourceAsset.name,
            equipmentType: sourceAsset.equipmentType,
            quantity: quantity,
            condition: sourceAsset.condition,
            base: toBaseId
        });
    }
}

module.exports = router;
