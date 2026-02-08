const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
    asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    personnel: { type: mongoose.Schema.Types.ObjectId, ref: 'Personnel', required: true },
    quantity: { type: Number, required: true },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    returnDate: { type: Date },
    returnedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Assignment', assignmentSchema);
