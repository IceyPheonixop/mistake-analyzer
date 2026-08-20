const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    topic: String,
    questionText: String,
    options: [String], // Array of 4 options
    correctOption: Number, // Index (0, 1, 2, or 3)
    createdBy: String // Teacher's username
});

module.exports = mongoose.model('Question', questionSchema);