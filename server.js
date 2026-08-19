const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path'); // Added for reliable directory resolution

// Models
const User = require('./models/User');
const Attempt = require('./models/Attempt');
const Question = require('./models/Question');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Serve static frontend files from the public folder using an absolute path
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/errorSleuth';

mongoose.connect(uri)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ DB Error:", err));

// --- API ROUTES ---

// 1. Auth / Login / Register
app.post('/api/login', async (req, res) => {
    const { username, password, role } = req.body;

    try {
        const existingUser = await User.findOne({ username });

        if (existingUser) {
            if (existingUser.password === password) {
                return res.json({ success: true, user: existingUser });
            } else {
                return res.json({ success: false, message: "❌ Wrong Password! Please try again." });
            }
        } else {
            const newUser = new User({ username, password, role });
            await newUser.save();
            return res.json({ success: true, user: newUser, message: "🎉 New Account Created!" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error: " + error.message });
    }
});

// 2. TEACHER: Add Question
app.post('/api/questions', async (req, res) => {
    try {
        const q = new Question(req.body);
        await q.save();
        res.json({ success: true, message: "Question Added!" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. STUDENT: Get All Questions
app.get('/api/questions', async (req, res) => {
    const questions = await Question.find();
    res.json(questions);
});

// 4. STUDENT: Submit Attempt
app.post('/api/attempt', async (req, res) => {
    const { studentName, topic, questionId, isCorrect, mistakeType } = req.body;
    
    try {
        const attempt = new Attempt(req.body);
        await attempt.save();

        if (isCorrect) {
            await User.findOneAndUpdate(
                { username: studentName }, 
                { $inc: { score: 10 } },
                { new: true }
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. ANALYTICS: Get Stats
app.get('/api/analytics', async (req, res) => {
    const attempts = await Attempt.find({ isCorrect: false });
    
    const mistakeCounts = {};
    const topicCounts = {};

    attempts.forEach(a => {
        mistakeCounts[a.mistakeType] = (mistakeCounts[a.mistakeType] || 0) + 1;
        topicCounts[a.topic] = (topicCounts[a.topic] || 0) + 1;
    });

    res.json({ mistakeCounts, topicCounts });
});

// 6. LEADERBOARD
app.get('/api/leaderboard', async (req, res) => {
    const topStudents = await User.find({ role: 'student' }).sort({ score: -1 }).limit(5);
    res.json(topStudents);
});

// 7. STUDENT: Get History
app.get('/api/my-mistakes/:username', async (req, res) => {
    const attempts = await Attempt.find({ studentName: req.params.username, isCorrect: false });
    res.json(attempts);
});

// 8. Unanswered Questions
app.get('/api/questions/unanswered/:username', async (req, res) => {
    const { username } = req.params;

    try {
        const allQuestions = await Question.find();
        const userAttempts = await Attempt.find({ studentName: username });
        const answeredIds = userAttempts.map(attempt => attempt.questionId.toString());
        const questionsToDo = allQuestions.filter(q => !answeredIds.includes(q._id.toString()));

        res.json(questionsToDo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 9. Reset Student Progress
app.delete('/api/reset/:username', async (req, res) => {
    try {
        const { username } = req.params;
        await Attempt.deleteMany({ studentName: username });
        await User.updateOne({ username: username }, { score: 0 });

        res.json({ success: true, message: "History cleared!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Catch-all route to serve the frontend (index.html)
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Port & Server configuration
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}

module.exports = app;