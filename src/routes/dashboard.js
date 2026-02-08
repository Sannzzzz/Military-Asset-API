const express = require('express');
const { Asset, Assignment, Purchase, Transfer, AssetRequest, Personnel, User } = require('../models');

const router = express.Router();

// Get dashboard data - role-based
router.get('/', async (req, res) => {
    try {
        const user = req.user;
        const { baseId, equipmentType, startDate, endDate } = req.query;

        // PERSONNEL returns limited data
        if (user.role === 'PERSONNEL') {
            const personnel = await Personnel.findOne({ user: user.id });
            if (!personnel) {
                return res.json({ assigned: 0, myRequests: 0, assets: [] });
            }

            const assignedCount = await Assignment.countDocuments({
                personnel: personnel._id,
                returnDate: null
            });

            const myRequestsCount = await AssetRequest.countDocuments({
                requestedBy: user.id,
                status: 'PENDING'
            });

            const assignments = await Assignment.find({
                personnel: personnel._id,
                returnDate: null
            }).populate('asset');

            return res.json({
                assigned: assignedCount,
                myRequests: myRequestsCount,
                assets: assignments.map(a => ({
                    name: a.asset?.name,
                    equipmentType: a.asset?.equipmentType,
                    quantity: a.quantity
                }))
            });
        }

        // Determine base filter
        let effectiveBaseId = user.role === 'ADMIN' ? (baseId || null) : user.baseId;

        // Build asset query
        let assetQuery = {};
        if (effectiveBaseId) {
            assetQuery.base = effectiveBaseId;
        }
        if (equipmentType) {
            assetQuery.equipmentType = equipmentType;
        }

        const assets = await Asset.find(assetQuery).populate('base');
        const closingBalance = assets.reduce((sum, a) => sum + a.quantity, 0);

        // Assigned count
        let assignedQuery = { returnDate: null };
        if (effectiveBaseId) {
            const basePersonnel = await Personnel.find({ base: effectiveBaseId });
            assignedQuery.personnel = { $in: basePersonnel.map(p => p._id) };
        }
        const assignments = await Assignment.find(assignedQuery);
        const assigned = assignments.reduce((sum, a) => sum + a.quantity, 0);

        // Purchases
        let purchaseQuery = {};
        if (effectiveBaseId) purchaseQuery.base = effectiveBaseId;
        if (startDate) purchaseQuery.createdAt = { $gte: new Date(startDate) };
        if (endDate) purchaseQuery.createdAt = { ...purchaseQuery.createdAt, $lte: new Date(endDate) };
        const purchasesList = await Purchase.find(purchaseQuery);
        const purchases = purchasesList.reduce((sum, p) => sum + p.quantity, 0);

        // Transfers In
        let transferInQuery = { status: 'APPROVED' };
        if (effectiveBaseId) transferInQuery.toBase = effectiveBaseId;
        const transfersInList = await Transfer.find(transferInQuery);
        const transfersIn = transfersInList.reduce((sum, t) => sum + t.quantity, 0);

        // Transfers Out
        let transferOutQuery = { status: 'APPROVED' };
        if (effectiveBaseId) transferOutQuery.fromBase = effectiveBaseId;
        const transfersOutList = await Transfer.find(transferOutQuery);
        const transfersOut = transfersOutList.reduce((sum, t) => sum + t.quantity, 0);

        // Pending transfers (for commanders)
        let pendingTransfers = 0;
        if (user.role === 'BASE_COMMANDER' || user.role === 'ADMIN') {
            let pendingQuery = { status: 'PENDING' };
            if (user.role === 'BASE_COMMANDER') {
                pendingQuery.toBase = user.baseId;
            }
            pendingTransfers = await Transfer.countDocuments(pendingQuery);
        }

        // Pending requests (for logistics)
        let pendingRequests = 0;
        if (user.role === 'LOGISTICS_OFFICER' || user.role === 'ADMIN') {
            let reqQuery = { status: 'PENDING' };
            if (user.role === 'LOGISTICS_OFFICER') {
                const baseUsers = await User.find({ base: user.baseId });
                reqQuery.requestedBy = { $in: baseUsers.map(u => u._id) };
            }
            pendingRequests = await AssetRequest.countDocuments(reqQuery);
        }

        const netMovement = purchases + transfersIn - transfersOut;
        const openingBalance = closingBalance - netMovement;

        res.json({
            openingBalance,
            closingBalance,
            netMovement,
            assigned,
            purchases,
            transfersIn,
            transfersOut,
            pendingTransfers,
            pendingRequests,
            assets: assets.map(a => ({
                id: a._id,
                name: a.name,
                equipmentType: a.equipmentType,
                quantity: a.quantity,
                condition: a.condition,
                base: a.base ? { id: a.base._id, name: a.base.name } : null
            }))
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
