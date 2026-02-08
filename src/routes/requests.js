const express = require('express');
const { AssetRequest, Asset, Personnel, Assignment, User, AuditLog } = require('../models');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// Get all asset requests - role-based
router.get('/', async (req, res) => {
    try {
        const user = req.user;
        let query = {};

        // PERSONNEL sees only their own requests
        if (user.role === 'PERSONNEL') {
            query.requestedBy = user.id;
        } else if (user.role !== 'ADMIN' && user.baseId) {
            // Get users in this base
            const baseUsers = await User.find({ base: user.baseId });
            query.requestedBy = { $in: baseUsers.map(u => u._id) };
        }

        const requests = await AssetRequest.find(query)
            .populate('asset')
            .populate('requestedBy')
            .populate('reviewedBy')
            .sort({ createdAt: -1 });

        res.json(requests.map(r => ({
            id: r._id,
            quantity: r.quantity,
            reason: r.reason,
            status: r.status,
            requestDate: r.createdAt,
            reviewDate: r.reviewDate,
            asset: r.asset ? { id: r.asset._id, name: r.asset.name, equipmentType: r.asset.equipmentType } : null,
            requestedBy: r.requestedBy ? { fullName: r.requestedBy.fullName } : null,
            reviewedBy: r.reviewedBy ? { fullName: r.reviewedBy.fullName } : null
        })));
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create asset request (PERSONNEL only)
router.post('/', authorize('PERSONNEL'), async (req, res) => {
    try {
        const { assetId, quantity, reason } = req.body;
        const user = req.user;

        const request = await AssetRequest.create({
            asset: assetId,
            requestedBy: user.id,
            quantity,
            reason
        });

        const asset = await Asset.findById(assetId);

        await AuditLog.create({
            action: 'ASSET_REQUEST',
            entityType: 'ASSET_REQUEST',
            entityId: request._id,
            details: `Requested ${quantity} of ${asset?.name}`,
            user: user.id
        });

        res.status(201).json({ id: request._id, status: 'PENDING' });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// Approve asset request
router.post('/:id/approve', authorize('ADMIN', 'LOGISTICS_OFFICER'), async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const request = await AssetRequest.findById(id).populate('requestedBy');

        if (!request || request.status !== 'PENDING') {
            return res.status(400).json({ error: 'Invalid request' });
        }

        // LOGISTICS_OFFICER can only approve for their base
        if (user.role === 'LOGISTICS_OFFICER') {
            const requester = await User.findById(request.requestedBy._id);
            if (requester.base?.toString() !== user.baseId) {
                return res.status(403).json({ error: 'Cannot approve requests from other bases' });
            }
        }

        // Check asset availability
        const asset = await Asset.findById(request.asset);
        if (!asset || asset.quantity < request.quantity) {
            return res.status(400).json({ error: 'Insufficient asset quantity' });
        }

        // Update request status
        request.status = 'APPROVED';
        request.reviewedBy = user.id;
        request.reviewDate = new Date();
        await request.save();

        // Get personnel record for requester
        const personnel = await Personnel.findOne({ user: request.requestedBy._id });

        if (personnel) {
            // Create assignment
            await Assignment.create({
                asset: request.asset,
                personnel: personnel._id,
                quantity: request.quantity,
                issuedBy: user.id
            });

            // Reduce asset quantity
            await Asset.findByIdAndUpdate(request.asset, { $inc: { quantity: -request.quantity } });
        }

        await AuditLog.create({
            action: 'REQUEST_APPROVED',
            entityType: 'ASSET_REQUEST',
            entityId: id,
            details: `Approved request for ${request.quantity} units`,
            user: user.id
        });

        res.json({ message: 'Request approved and asset issued' });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// Reject asset request
router.post('/:id/reject', authorize('ADMIN', 'LOGISTICS_OFFICER'), async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const request = await AssetRequest.findById(id);
        request.status = 'REJECTED';
        request.reviewedBy = req.user.id;
        request.reviewDate = new Date();
        await request.save();

        await AuditLog.create({
            action: 'REQUEST_REJECTED',
            entityType: 'ASSET_REQUEST',
            entityId: id,
            details: reason || 'Request rejected',
            user: req.user.id
        });

        res.json({ message: 'Request rejected' });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
