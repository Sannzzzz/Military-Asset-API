const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema({
    asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    fromBase: { type: mongoose.Schema.Types.ObjectId, ref: 'Base', required: true },
    toBase: { type: mongoose.Schema.Types.ObjectId, ref: 'Base', required: true },
    quantity: { type: Number, required: true },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING'
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedDate: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Transfer', transferSchema);
