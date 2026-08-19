const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
    studentName: String,
    topic: String,
    questionId: String, // <--- CHANGED TO STRING
    isCorrect: Boolean,
    mistakeType: { 
        type: String, 
        enum: ['None', 'Formula Mistake', 'Concept Confusion', 'Calculation Error'],
        default: 'None'
    }
});

module.exports = mongoose.model('Attempt', attemptSchema);