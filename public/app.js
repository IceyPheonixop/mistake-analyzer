const currentUser = JSON.parse(localStorage.getItem('user'));
let questions = []; // Loaded from DB
let currentQIndex = 0;

// --- INITIALIZATION ---
if (window.location.pathname.includes('dashboard.html')) {
    if (!currentUser) window.location.href = 'index.html';
    
    document.getElementById('welcome-msg').innerText = `Hello, ${currentUser.username}`;

    if (currentUser.role === 'student') {
        document.getElementById('student-view').classList.remove('hidden');
        loadQuestionsFromDB();
        loadLeaderboard();
        loadStudentHistory();

        setInterval(loadLeaderboard, 2000); // Refresh leaderboard every 20s
    } else {
        document.getElementById('teacher-view').classList.remove('hidden');
        loadTeacherAnalytics();
    }
}

// === LOGIN LOGIC ===
async function login() {
    // 1. Force clear any old sessions immediately
    localStorage.removeItem('user'); 

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value; // Make sure you are getting the password!
    const role = document.getElementById('role').value;
    
    if(!username || !password) return alert("Please enter both username and password");

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role })
    });
    
    const data = await res.json();
    
    if (data.success) {
        if(data.message) alert(data.message); // Show "New Account Created" if applicable
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = 'dashboard.html';
    } else {
        // If wrong password, show the error!
        alert(data.message);
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
    
    // Find which radio button is checked for correct answer
    const correctRad = document.querySelector('input[name="correct"]:checked');
    if(!correctRad || !text) return alert("Please fill all fields and select correct option");

    const payload = {
        topic,
        questionText: text,
        options,
        correctOption: parseInt(correctRad.value),
        createdBy: currentUser.username
    };

    const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if(res.ok) {
        alert("Question Added Successfully!");
        location.reload(); // Refresh to clear form
    }
}

async function loadTeacherAnalytics() {
    const res = await fetch('/api/analytics');
    const { mistakeCounts, topicCounts } = await res.json();

    const ctx = document.getElementById('mistakeChart').getContext('2d');

    // FIX 1: Handle "No Data" text color
    if(Object.keys(mistakeCounts).length === 0) {
        ctx.fillStyle = "white"; // <--- Set text color to white
        ctx.font = "16px Outfit";
        ctx.fillText("No mistakes recorded yet", 10, 50);
        return;
    }

    // Check if a chart already exists and destroy it to prevent "glitching"
    // (This helps if you refresh the chart without reloading the page)
    if (window.myChart instanceof Chart) {
        window.myChart.destroy();
    }

    // FIX 2: Set Chart Legend Text to White
   // Make sure we register the plugin
   Chart.register(ChartDataLabels);

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
       // 👇 ADD THIS LINE to activate the plugin for this specific chart
       plugins: [ChartDataLabels], 
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
               // 👇 ADD THIS BLOCK to format the numbers on the chart
               datalabels: {
                   color: 'black', // White text
                   font: {
                       weight: 'bold',
                       size: 16,
                       family: "'Outfit', sans-serif"
                   },
                   formatter: (value, context) => {
                       // Optional: Calculate percentage
                       const dataArray = context.chart.data.datasets[0].data;
                       const total = dataArray.reduce((a, b) => a + b, 0);
                       const percentage = Math.round((value / total) * 100) + "%";
                       
                       // Return what you want to show (Value + Percentage)
                       return value + " (" + percentage + ")"; 
                   }
               }
           }
       }
   });

    // Update the text list below the chart
    document.getElementById('topic-breakdown').innerHTML = 
        Object.entries(topicCounts).map(([k,v]) => 
            `<p style="border-bottom: 1px solid rgba(255,255,255,0.1); padding:5px;">
                <span style="color:var(--accent);">●</span> <b>${k}:</b> ${v} struggles
            </p>`
        ).join('');
}

// === STUDENT FUNCTIONS ===
async function loadQuestionsFromDB() {
    // 👇 CHANGED: We now ask for only "unanswered" questions for this user
    // Added timestamp (?t=...) to prevent browser caching
    const res = await fetch(`/api/questions/unanswered/${currentUser.username}?t=${Date.now()}`);
    questions = await res.json();
    
    // Reset index because we have a fresh list of questions
    currentQIndex = 0; 

    if (questions.length === 0) {
        // 👇 Creative message when they are done
        document.getElementById('quiz-area').innerHTML = `
            <div style="text-align:center; padding: 20px;">
                <h2>🎉 All Caught Up!</h2>
                <p>You have attempted all available questions.</p>
                <p>Check the "Weak Areas" section to see where you can improve.</p>
            </div>
        `;
    } else {
        renderQuestion();
    }

    // 👇 NEW FUNCTION: Handles the reset logic
async function retakeTest() {
    if(!confirm("Are you sure? This will delete your current score and history.")) return;

    await fetch(`/api/reset/${currentUser.username}`, { method: 'DELETE' });
    
    alert("Progress reset! You can now take the test again.");
    location.reload(); // Refresh page to load questions again
}
}

function renderQuestion() {
    if(currentQIndex >= questions.length) {
        document.getElementById('quiz-area').innerHTML = "<h3>🎉 You finished all questions!</h3>";
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
    
    // Logic to guess mistake type (Simulated)
    let mistakeType = 'None';
    if(!isCorrect) {
        const types = ['Concept Confusion', 'Calculation Error', 'Formula Mistake'];
        mistakeType = types[Math.floor(Math.random() * types.length)];
    }

    await fetch('/api/attempt', {
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
    loadLeaderboard(); // Refresh scores

    loadStudentHistory();
}

async function loadLeaderboard() {
    const res = await fetch('/api/leaderboard?t=' + Date.now()); // Prevent caching
    const users = await res.json();
    document.getElementById('leaderboard').innerHTML = users.map((u, i) => `
        <div class="leaderboard-item">
            <span>#${i+1} ${u.username}</span>
            <b>${u.score} pts</b>
        </div>
    `).join('');
}

async function loadStudentHistory() {
    const res = await fetch(`/api/my-mistakes/${currentUser.username}?t=${Date.now()}`); // Prevent caching
    const data = await res.json();
    const uniqueTopics = [...new Set(data.map(d => d.topic))];
    
    document.getElementById('mistake-history').innerHTML = uniqueTopics.length 
        ? uniqueTopics.map(t => `<span class="mistake-tag">${t}</span>`).join(' ')
        : "<p>No mistakes yet! Keep it up.</p>";
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}// === UI TOGGLE FUNCTION FOR TEACHER ===
function toggleTeacherView(viewName) {
    const dashboardContent = document.getElementById('teacher-dashboard-content');
    const formContent = document.getElementById('teacher-form-content');

    if (viewName === 'form') {
        // Hide dashboard, show form
        dashboardContent.classList.add('hidden');
        formContent.classList.remove('hidden');
    } else {
        // Hide form, show dashboard
        formContent.classList.add('hidden');
        dashboardContent.classList.remove('hidden');
        
        // Refresh the chart just in case new data was added
        loadTeacherAnalytics(); 
    }
}