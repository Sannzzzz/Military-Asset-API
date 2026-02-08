const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
    asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    base: { type: mongoose.Schema.Types.ObjectId, ref: 'Base', required: true },
    quantity: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Purchase', purchaseSchema);
