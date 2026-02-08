const jwt = require('jsonwebtoken');

// Permission matrix
const PERMISSIONS = {
    ADMIN: {
        canManageUsers: true,
        canViewAllBases: true,
        canAddAssets: true,
        canEditAssets: true,
        canDeleteAssets: true,
        canViewInventory: true,
        canApproveTransfers: true,
        canRequestTransfers: true,
        canIssueAssets: true,
        canReceiveReturns: true,
        canUpdateCondition: true,
        canCreateMaintenance: true,
        canViewReports: true,
        canViewAuditLogs: true,
        canRequestAssets: false,
        canViewAssignedAssets: true
    },
    BASE_COMMANDER: {
        canManageUsers: false,
        canViewAllBases: false,
        canAddAssets: false,
        canEditAssets: false,
        canDeleteAssets: false,
        canViewInventory: true,
        canApproveTransfers: true,  // Only for transfers TO their base
        canRequestTransfers: true,  // Only FROM their base
        canIssueAssets: false,
        canReceiveReturns: false,
        canUpdateCondition: false,
        canCreateMaintenance: false,
        canViewReports: true,
        canViewAuditLogs: true,
        canRequestAssets: false,
        canViewAssignedAssets: true
    },
    LOGISTICS_OFFICER: {
        canManageUsers: false,
        canViewAllBases: false,
        canAddAssets: false,
        canEditAssets: false,
        canDeleteAssets: false,
        canViewInventory: true,
        canApproveTransfers: false,
        canRequestTransfers: false,
        canIssueAssets: true,
        canReceiveReturns: true,
        canUpdateCondition: true,
        canCreateMaintenance: true,
        canViewReports: false,
        canViewAuditLogs: false,
        canRequestAssets: false,
        canViewAssignedAssets: true
    },
    PERSONNEL: {
        canManageUsers: false,
        canViewAllBases: false,
        canAddAssets: false,
        canEditAssets: false,
        canDeleteAssets: false,
        canViewInventory: false,
        canApproveTransfers: false,
        canRequestTransfers: false,
        canIssueAssets: false,
        canReceiveReturns: false,
        canUpdateCondition: false,
        canCreateMaintenance: false,
        canViewReports: false,
        canViewAuditLogs: false,
        canRequestAssets: true,
        canViewAssignedAssets: true  // Only their own
    }
};

// Authentication middleware
const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

        // Set user info on request
        req.user = {
            id: decoded.id,
            username: decoded.username,
            role: decoded.role,
            baseId: decoded.baseId,
            baseName: decoded.baseName,
            fullName: decoded.fullName
        };

        // Set permissions
        req.permissions = PERMISSIONS[decoded.role] || {};

        next();
    } catch (err) {
        console.error('Auth error:', err.message);
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Role-based authorization middleware
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Access denied',
                message: `This action requires one of these roles: ${allowedRoles.join(', ')}`
            });
        }

        next();
    };
};

// Permission-based middleware
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        if (!req.permissions[permission]) {
            return res.status(403).json({
                error: 'Permission denied',
                message: `You don't have permission: ${permission}`
            });
        }

        next();
    };
};

// Base access check middleware
const checkBaseAccess = (req, res, next) => {
    if (req.user.role === 'ADMIN') {
        return next();
    }

    const requestedBaseId = req.params.baseId || req.body.baseId || req.query.baseId;

    if (requestedBaseId && requestedBaseId !== req.user.baseId) {
        return res.status(403).json({
            error: 'Access denied',
            message: 'You can only access resources in your assigned base'
        });
    }

    next();
};

module.exports = {
    authMiddleware,
    authorize,
    requirePermission,
    checkBaseAccess,
    PERMISSIONS
};
