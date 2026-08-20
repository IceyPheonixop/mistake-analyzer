// === API CONFIGURATION ===
// Change this to your deployed backend URL (e.g., 'https://your-backend.vercel.app')
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000' 
    : ' https://mistake-analyzer.onrender.com'; 

const currentUser = JSON.parse(localStorage.getItem('user'));
let questions = []; // Loaded from DB
let currentQIndex = 0;

// --- INITIALIZATION ---
if (window.location.pathname.includes('dashboard.html')) {
    if (!currentUser) window.location.href = 'index.html';
    
    const welcomeMsg = document.getElementById('welcome-msg');
    if (welcomeMsg) welcomeMsg.innerText = `Hello, ${currentUser.username}`;

    if (currentUser.role === 'student') {
        const studentView = document.getElementById('student-view');
        if (studentView) studentView.classList.remove('hidden');
        loadQuestionsFromDB();
        loadLeaderboard();
        loadStudentHistory();

        setInterval(loadLeaderboard, 20000); // Refreshes leaderboard every 20s
    } else {
        const teacherView = document.getElementById('teacher-view');
        if (teacherView) teacherView.classList.remove('hidden');
        loadTeacherAnalytics();
    }
}

// === LOGIN LOGIC ===
async function login() {
    localStorage.removeItem('user'); 

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    
    if(!username || !password) return alert("Please enter both username and password");

    try {
        const res = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role })
        });
        
        const data = await res.json();
        
        if (data.success) {
            if(data.message) alert(data.message);
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = 'dashboard.html';
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert("Failed to connect to backend server. Please check the API configuration.");
    }
}

// === TEACHER FUNCTIONS ===
async function postQuestion() {
    const topic = document.getElementById('new-topic').value;
    const text = document.getElementById('new-q-text').value;
    const options = [
        document.getElementById('opt-0').value,
        document.getElementById('opt-1').value,
        document.getElementById('opt-2').value,
        document.getElementById('opt-3').value
    ];
    
    const correctRad = document.querySelector('input[name="correct"]:checked');
    if(!correctRad || !text) return alert("Please fill all fields and select correct option");

    const payload = {
        topic,
        questionText: text,
        options,
        correctOption: parseInt(correctRad.value),
        createdBy: currentUser.username
    };

    const res = await fetch(`${API_BASE_URL}/api/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if(res.ok) {
        alert("Question Added Successfully!");
        location.reload();
    }
}

async function loadTeacherAnalytics() {
    const res = await fetch(`${API_BASE_URL}/api/analytics`);
    const { mistakeCounts, topicCounts } = await res.json();

    const ctx = document.getElementById('mistakeChart').getContext('2d');

    if(Object.keys(mistakeCounts).length === 0) {
        ctx.fillStyle = "white";
        ctx.font = "16px Outfit";
        ctx.fillText("No mistakes recorded yet", 10, 50);
        return;
    }

    if (window.myChart instanceof Chart) {
        window.myChart.destroy();
    }

    if (typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
    }

    window.myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(mistakeCounts),
            datasets: [{
                data: Object.values(mistakeCounts),
                backgroundColor: ['#ff7675', '#74b9ff', '#ffeaa7', '#fab1a0', '#a29bfe'],
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 2
            }]
        },
        plugins: typeof ChartDataLabels !== 'undefined' ? [ChartDataLabels] : [], 
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: 'white',
                        font: {
                            family: "'Outfit', sans-serif",
                            size: 14
                        }
                    }
                },
                datalabels: {
                    color: 'black',
                    font: {
                        weight: 'bold',
                        size: 16,
                        family: "'Outfit', sans-serif"
                    },
                    formatter: (value, context) => {
                        const dataArray = context.chart.data.datasets[0].data;
                        const total = dataArray.reduce((a, b) => a + b, 0);
                        const percentage = Math.round((value / total) * 100) + "%";
                        return value + " (" + percentage + ")"; 
                    }
                }
            }
        }
    });

    document.getElementById('topic-breakdown').innerHTML = 
        Object.entries(topicCounts).map(([k,v]) => 
            `<p style="border-bottom: 1px solid rgba(255,255,255,0.1); padding:5px;">
                <span style="color:var(--accent);">●</span> <b>${k}:</b> ${v} struggles
            </p>`
        ).join('');
}

// === STUDENT FUNCTIONS ===
async function loadQuestionsFromDB() {
    const res = await fetch(`${API_BASE_URL}/api/questions/unanswered/${currentUser.username}?t=${Date.now()}`);
    questions = await res.json();
    currentQIndex = 0; 

    if (questions.length === 0) {
        document.getElementById('quiz-area').innerHTML = `
            <div style="text-align:center; padding: 20px;">
                <h2>🎉 All Caught Up!</h2>
                <p>You have attempted all available questions.</p>
                <p>Check the "Weak Areas" section to see where you can improve.</p>
                <button class="option-btn" onclick="retakeTest()">Retake Quiz</button>
            </div>
        `;
    } else {
        renderQuestion();
    }
}

// Moved to global scope so onclick handlers can access it
async function retakeTest() {
    if(!confirm("Are you sure? This will delete your current score and history.")) return;

    await fetch(`${API_BASE_URL}/api/reset/${currentUser.username}`, { method: 'DELETE' });
    
    alert("Progress reset! You can now take the test again.");
    location.reload();
}

function renderQuestion() {
    if(currentQIndex >= questions.length) {
        document.getElementById('quiz-area').innerHTML = `
            <div style="text-align:center; padding: 20px;">
                <h3>🎉 You finished all questions!</h3>
                <button class="option-btn" onclick="retakeTest()">Retake Quiz</button>
            </div>
        `;
        return;
    }
    const q = questions[currentQIndex];
    document.getElementById('q-topic').innerText = q.topic.toUpperCase();
    document.getElementById('q-text').innerText = q.questionText;
    
    const optsDiv = document.getElementById('options-container');
    optsDiv.innerHTML = q.options.map((opt, idx) => 
        `<button class="option-btn" onclick="submitAnswer(${idx})">${opt}</button>`
    ).join('');
}

async function submitAnswer(selectedIdx) {
    const q = questions[currentQIndex];
    const isCorrect = selectedIdx === q.correctOption;
    
    let mistakeType = 'None';
    if(!isCorrect) {
        const types = ['Concept Confusion', 'Calculation Error', 'Formula Mistake'];
        mistakeType = types[Math.floor(Math.random() * types.length)];
    }

    await fetch(`${API_BASE_URL}/api/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            studentName: currentUser.username,
            topic: q.topic,
            questionId: q._id,
            isCorrect,
            mistakeType
        })
    });

    alert(isCorrect ? "✅ Correct! Points Added." : `❌ Wrong. System suggests: ${mistakeType}`);
    currentQIndex++;
    renderQuestion();
    loadLeaderboard();
    loadStudentHistory();
}

async function loadLeaderboard() {
    const res = await fetch(`${API_BASE_URL}/api/leaderboard?t=` + Date.now());
    const users = await res.json();
    document.getElementById('leaderboard').innerHTML = users.map((u, i) => `
        <div class="leaderboard-item">
            <span>#${i+1} ${u.username}</span>
            <b>${u.score} pts</b>
        </div>
    `).join('');
}

async function loadStudentHistory() {
    const res = await fetch(`${API_BASE_URL}/api/my-mistakes/${currentUser.username}?t=${Date.now()}`);
    const data = await res.json();
    const uniqueTopics = [...new Set(data.map(d => d.topic))];
    
    document.getElementById('mistake-history').innerHTML = uniqueTopics.length 
        ? uniqueTopics.map(t => `<span class="mistake-tag">${t}</span>`).join(' ')
        : "<p>No mistakes yet! Keep it up.</p>";
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

function toggleTeacherView(viewName) {
    const dashboardContent = document.getElementById('teacher-dashboard-content');
    const formContent = document.getElementById('teacher-form-content');

    if (viewName === 'form') {
        dashboardContent.classList.add('hidden');
        formContent.classList.remove('hidden');
    } else {
        formContent.classList.add('hidden');
        dashboardContent.classList.remove('hidden');
        loadTeacherAnalytics(); 
    }
}