const express = require('express');
const jwt = require('jsonwebtoken');
const { User, AuditLog } = require('../models');
const { authMiddleware, authorize } = require('../middleware/auth');

const router = express.Router();

// Login - public
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username }).populate('base');

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await user.comparePassword(password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            {
                id: user._id,
                username: user.username,
                role: user.role,
                baseId: user.base?._id,
                baseName: user.base?.name,
                fullName: user.fullName
            },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                fullName: user.fullName,
                role: user.role,
                baseId: user.base?._id,
                baseName: user.base?.name
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get current user profile
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('base').select('-password');
        res.json({
            id: user._id,
            username: user.username,
            fullName: user.fullName,
            role: user.role,
            baseId: user.base?._id,
            baseName: user.base?.name
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ===== ADMIN ONLY: User Management =====

// List all users
router.get('/users', authMiddleware, authorize('ADMIN'), async (req, res) => {
    try {
        const users = await User.find().populate('base').select('-password').sort({ createdAt: -1 });
        res.json(users.map(u => ({
            id: u._id,
            username: u.username,
            full_name: u.fullName,
            role: u.role,
            base_id: u.base?._id,
            base_name: u.base?.name,
            created_at: u.createdAt
        })));
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Create user (ADMIN only)
router.post('/users', authMiddleware, authorize('ADMIN'), async (req, res) => {
    try {
        const { username, password, fullName, role, baseId } = req.body;

        if (!['ADMIN', 'BASE_COMMANDER', 'LOGISTICS_OFFICER', 'PERSONNEL'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const user = new User({
            username,
            password,
            fullName,
            role,
            base: baseId || null
        });

        await user.save();

        await AuditLog.create({
            action: 'CREATE_USER',
            entityType: 'USER',
            entityId: user._id,
            details: `Created user: ${username} with role ${role}`,
            user: req.user.id
        });

        res.status(201).json({ id: user._id, username, role });
    } catch (err) {
        console.error('Create user error:', err);
        if (err.code === 11000) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// Update user (ADMIN only)
router.put('/users/:id', authMiddleware, authorize('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { fullName, role, baseId } = req.body;

        if (role && !['ADMIN', 'BASE_COMMANDER', 'LOGISTICS_OFFICER', 'PERSONNEL'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        await User.findByIdAndUpdate(id, {
            fullName,
            role,
            base: baseId || null
        });

        await AuditLog.create({
            action: 'UPDATE_USER',
            entityType: 'USER',
            entityId: id,
            details: `Updated user role to ${role}`,
            user: req.user.id
        });

        res.json({ message: 'User updated' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete user (ADMIN only)
router.delete('/users/:id', authMiddleware, authorize('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;

        if (id === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }

        const user = await User.findByIdAndDelete(id);

        await AuditLog.create({
            action: 'DELETE_USER',
            entityType: 'USER',
            entityId: id,
            details: `Deleted user: ${user?.username}`,
            user: req.user.id
        });

        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
