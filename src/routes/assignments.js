const express = require('express');
const { Assignment, Asset, Personnel, AuditLog } = require('../models');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// Get assignments - role-based
router.get('/', async (req, res) => {
    try {
        const user = req.user;
        let query = { returnDate: null };

        // PERSONNEL can only see their own assignments
        if (user.role === 'PERSONNEL') {
            const personnel = await Personnel.findOne({ user: user.id });
            if (personnel) {
                query.personnel = personnel._id;
            } else {
                return res.json([]);
            }
        } else if (user.role !== 'ADMIN' && user.baseId) {
            // Get personnel in this base
            const basePersonnel = await Personnel.find({ base: user.baseId });
            query.personnel = { $in: basePersonnel.map(p => p._id) };
        }

        const assignments = await Assignment.find(query)
            .populate('asset')
            .populate('personnel')
            .populate('issuedBy')
            .sort({ createdAt: -1 });

        res.json(assignments.map(a => ({
            id: a._id,
            quantity: a.quantity,
            assignmentDate: a.createdAt,
            asset: a.asset ? { id: a.asset._id, name: a.asset.name, equipmentType: a.asset.equipmentType } : null,
            personnel: a.personnel ? { id: a.personnel._id, name: a.personnel.name, rank: a.personnel.rank } : null,
            issuedBy: a.issuedBy ? { fullName: a.issuedBy.fullName } : null
        })));
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Issue asset to personnel
router.post('/', authorize('ADMIN', 'LOGISTICS_OFFICER'), async (req, res) => {
    try {
        const { assetId, personnelId, quantity } = req.body;
        const user = req.user;

        // Validate required fields
        if (!assetId || !personnelId || !quantity) {
            return res.status(400).json({ error: 'assetId, personnelId, and quantity are required' });
        }

        // Check personnel is in same base for non-admin
        if (user.role !== 'ADMIN') {
            const p = await Personnel.findById(personnelId);
            if (!p || p.base?.toString() !== user.baseId) {
                return res.status(403).json({ error: 'Personnel is not in your base' });
            }
        }

        // Check asset quantity
        const a = await Asset.findById(assetId);
        if (!a || a.quantity < quantity) {
            return res.status(400).json({ error: 'Insufficient quantity' });
        }

        // Create assignment
        const assignment = await Assignment.create({
            asset: assetId,
            personnel: personnelId,
            quantity,
            issuedBy: user.id
        });

        // Decrease asset quantity
        await Asset.findByIdAndUpdate(assetId, { $inc: { quantity: -quantity } });

        await AuditLog.create({
            action: 'ISSUE_ASSET',
            entityType: 'ASSIGNMENT',
            entityId: assignment._id,
            details: `Issued ${quantity} of ${a.name} to personnel`,
            user: user.id
        });

        res.status(201).json({ id: assignment._id });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// Return asset
router.post('/:id/return', authorize('ADMIN', 'LOGISTICS_OFFICER', 'PERSONNEL'), async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const assignment = await Assignment.findById(id).populate({
            path: 'personnel',
            populate: { path: 'user' }
        });

        if (!assignment || assignment.returnDate) {
            return res.status(400).json({ error: 'Assignment not found or already returned' });
        }

        // PERSONNEL can only return their own
        if (user.role === 'PERSONNEL' && assignment.personnel?.user?._id.toString() !== user.id) {
            return res.status(403).json({ error: 'You can only return your own assignments' });
        }

        // LOGISTICS_OFFICER must be from same base
        if (user.role === 'LOGISTICS_OFFICER') {
            const personnel = await Personnel.findById(assignment.personnel._id);
            if (personnel.base?.toString() !== user.baseId) {
                return res.status(403).json({ error: 'Cannot receive returns from other bases' });
            }
        }

        // Mark as returned
        assignment.returnDate = new Date();
        assignment.returnedTo = user.id;
        await assignment.save();

        // Return quantity to asset
        await Asset.findByIdAndUpdate(assignment.asset, { $inc: { quantity: assignment.quantity } });

        await AuditLog.create({
            action: 'RETURN_ASSET',
            entityType: 'ASSIGNMENT',
            entityId: id,
            details: `Returned ${assignment.quantity} units`,
            user: user.id
        });

        res.json({ message: 'Asset returned successfully' });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

module.exports = router;
