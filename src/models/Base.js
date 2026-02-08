const mongoose = require('mongoose');

const baseSchema = new mongoose.Schema({
    name: { type: String, required: true },
    location: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Base', baseSchema);
