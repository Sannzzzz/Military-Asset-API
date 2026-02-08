const mongoose = require('mongoose');

const personnelSchema = new mongoose.Schema({
    name: { type: String, required: true },
    rank: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    base: { type: mongoose.Schema.Types.ObjectId, ref: 'Base' }
}, { timestamps: true });

module.exports = mongoose.model('Personnel', personnelSchema);
