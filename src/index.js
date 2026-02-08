require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./db/connection');
const { authMiddleware } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const baseRoutes = require('./routes/bases');
const assetRoutes = require('./routes/assets');
const personnelRoutes = require('./routes/personnel');
const purchaseRoutes = require('./routes/purchases');
const transferRoutes = require('./routes/transfers');
const assignmentRoutes = require('./routes/assignments');
const requestRoutes = require('./routes/requests');
const dashboardRoutes = require('./routes/dashboard');
const auditRoutes = require('./routes/audit');

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/bases', authMiddleware, baseRoutes);
app.use('/api/assets', authMiddleware, assetRoutes);
app.use('/api/personnel', authMiddleware, personnelRoutes);
app.use('/api/purchases', authMiddleware, purchaseRoutes);
app.use('/api/transfers', authMiddleware, transferRoutes);
app.use('/api/assignments', authMiddleware, assignmentRoutes);
app.use('/api/requests', authMiddleware, requestRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/audit', authMiddleware, auditRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'MongoDB Atlas', version: '2.0.0-RBAC' });
});

// Role info endpoint
app.get('/api/roles', authMiddleware, (req, res) => {
    res.json({
        roles: ['ADMIN', 'BASE_COMMANDER', 'LOGISTICS_OFFICER', 'PERSONNEL'],
        permissions: {
            ADMIN: ['Full access to all APIs', 'Manage users', 'Add/edit/delete assets', 'View all bases'],
            BASE_COMMANDER: ['View base assets', 'Approve transfers', 'Transfer assets', 'View reports'],
            LOGISTICS_OFFICER: ['Issue assets', 'Receive returns', 'Update condition', 'Create maintenance'],
            PERSONNEL: ['Request assets', 'View assigned assets', 'Return assets', 'Report damage']
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Connect to MongoDB and start server
const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`\n🚀 Server running on http://localhost:${PORT}`);
            console.log('📦 Database: MongoDB Atlas');
            console.log('\n📋 RBAC Roles:');
            console.log('   - ADMIN: Full access');
            console.log('   - BASE_COMMANDER: Base-level management');
            console.log('   - LOGISTICS_OFFICER: Asset issuance/returns');
            console.log('   - PERSONNEL: Request/view assigned assets');
            console.log('\n💡 Run "npm run seed" to populate demo data');
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

startServer();
