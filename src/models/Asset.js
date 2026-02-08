const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
    name: { type: String, required: true },
    equipmentType: {
        type: String,
        enum: ['VEHICLE', 'WEAPON', 'AMMUNITION', 'EQUIPMENT', 'OTHER'],
        required: true
    },
    quantity: { type: Number, default: 0 },
    condition: {
        type: String,
        enum: ['GOOD', 'FAIR', 'POOR', 'NEEDS_REPAIR', 'DECOMMISSIONED'],
        default: 'GOOD'
    },
    base: { type: mongoose.Schema.Types.ObjectId, ref: 'Base' }
}, { timestamps: true });

module.exports = mongoose.model('Asset', assetSchema);
