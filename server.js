 const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

// Models
const User = require('./models/User');
const Attempt = require('./models/Attempt');
const Question = require('./models/Question');

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public')); // Serves the frontend

// Database Connection (Fixed for Mongoose v6+)
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/errorSleuth';

mongoose.connect(uri)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ DB Error:", err));

// --- ROUTES ---

// 1. Auth
// 1. Smart Login / Register
app.post('/api/login', async (req, res) => {
    const { username, password, role } = req.body;

    try {
        // Step A: Search for user by USERNAME only
        const existingUser = await User.findOne({ username });

        if (existingUser) {
            // Step B: User exists? Check Password
            if (existingUser.password === password) {
                // Password Matches!
                return res.json({ success: true, user: existingUser });
            } else {
                // Wrong Password
                return res.json({ success: false, message: "❌ Wrong Password! Please try again." });
            }
        } else {
            // Step C: No user found? Create a NEW one (Register)
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
// REPLACE THE ENTIRE app.post('/api/attempt'...) BLOCK WITH THIS:

app.post('/api/attempt', async (req, res) => {
    const { studentName, topic, questionId, isCorrect, mistakeType } = req.body;
    
    console.log(`📝 Processing attempt for: ${studentName}`); // LOG 1

    try {
        // 1. Save the Attempt
        const attempt = new Attempt(req.body);
        await attempt.save();

        // 2. Update Score (ONLY if correct)
        if (isCorrect) {
            console.log(`✅ Correct answer! Updating score...`); // LOG 2
            
            // We use findOneAndUpdate so we can see the result immediately
            const updatedUser = await User.findOneAndUpdate(
                { username: studentName }, 
                { $inc: { score: 10 } },
                { new: true } // This option returns the updated document
            );

            if (updatedUser) {
                console.log(`🎉 New Score for ${studentName}: ${updatedUser.score}`); // LOG 3
            } else {
                console.log(`⚠️ User ${studentName} not found in DB!`); // LOG 4
            }
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

// NEW ROUTE: Get only UNANSWERED questions for a specific student
app.get('/api/questions/unanswered/:username', async (req, res) => {
    const { username } = req.params;

    try {
        // 1. Get all questions
        const allQuestions = await Question.find();

        // 2. Get all attempts by this student
        const userAttempts = await Attempt.find({ studentName: username });

        // 3. Create a list of Question IDs the user has already answered
        const answeredIds = userAttempts.map(attempt => attempt.questionId.toString());

        // 4. Filter: Keep only questions whose ID is NOT in the answered list
        const questionsToDo = allQuestions.filter(q => !answeredIds.includes(q._id.toString()));

        res.json(questionsToDo);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// NEW ROUTE: Reset Student Progress (Delete all attempts)
app.delete('/api/reset/:username', async (req, res) => {
    try {
        const { username } = req.params;
        // Delete all attempts by this student
        await Attempt.deleteMany({ studentName: username });
        
        // Optional: Reset their score to 0
        await User.updateOne({ username: username }, { score: 0 });

        res.json({ success: true, message: "History cleared!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Use environment port or fallback for local development
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}

// Export the Express app for Vercel's serverless runtime
module.exports = app;