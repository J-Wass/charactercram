// Chinese Character Practice App with Spaced Repetition

class ChineseCharacterApp {
    constructor() {
        this.characters = [];
        this.currentLevel = 'novice';
        this.currentCharIndex = 0;
        this.currentChar = null;
        this.userProgress = this.loadProgress();
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.hasBackground = false;
        
        this.levelConfig = {
            'novice': 10,
            'beginner': 25,
            'intermediate': 100,
            'advanced': 1000,
            'master': 9900
        };
        
        this.init();
    }
    
    async init() {
        await this.loadCharacters();
        this.setupCanvas();
        this.setupEventListeners();
        this.updateSelectStyling();
        this.updateLevelDropdownMastery();
        this.startNewRound();
    }
    
    async loadCharacters() {
        try {
            // Use the embedded character data
            if (typeof CHINESE_CHARACTERS !== 'undefined') {
                this.characters = CHINESE_CHARACTERS.map(char => {
                    return {
                        character: char.character,
                        pinyin: char.pinyin,
                        definition: char.definition || 'No definition',
                        frequency_rank: parseInt(char.frequency_rank),
                        hsk_level: char.hsk_level
                    };
                });
            } else {
                console.error('Character data not loaded');
                this.characters = [];
            }
        } catch (error) {
            console.error('Error loading characters:', error);
            this.characters = [];
        }
    }
    
    setupCanvas() {
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set up canvas style for calligraphy-like strokes
        this.ctx.lineWidth = 10;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = '#2d3748';
        this.ctx.globalCompositeOperation = 'source-over';
        
        // Enable smoothing for better line quality
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        
        // Draw guide lines
        this.clearCanvas();
        
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const x = (touch.clientX - rect.left) * scaleX;
            const y = (touch.clientY - rect.top) * scaleY;
            
            this.isDrawing = true;
            this.lastX = x;
            this.lastY = y;
            
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!this.isDrawing) return;
            
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const x = (touch.clientX - rect.left) * scaleX;
            const y = (touch.clientY - rect.top) * scaleY;
            
            // Use quadratic curves for smoother lines
            const midX = (this.lastX + x) / 2;
            const midY = (this.lastY + y) / 2;
            
            this.ctx.quadraticCurveTo(this.lastX, this.lastY, midX, midY);
            this.ctx.stroke();
            
            this.lastX = x;
            this.lastY = y;
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopDrawing();
        });
    }
    
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw guide lines
        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 1;
        
        // Draw cross guides
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2, 0);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        this.ctx.moveTo(0, this.canvas.height / 2);
        this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
        this.ctx.stroke();
        
        // Draw diagonal guides
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(this.canvas.width, this.canvas.height);
        this.ctx.moveTo(this.canvas.width, 0);
        this.ctx.lineTo(0, this.canvas.height);
        this.ctx.stroke();
        
        // Draw border
        this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Reset drawing style for calligraphy
        this.ctx.strokeStyle = '#2d3748';
        this.ctx.lineWidth = 10;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        this.lastX = x;
        this.lastY = y;
        
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
    }
    
    draw(e) {
        if (!this.isDrawing) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        // Use quadratic curves for smoother lines
        const midX = (this.lastX + x) / 2;
        const midY = (this.lastY + y) / 2;
        
        this.ctx.quadraticCurveTo(this.lastX, this.lastY, midX, midY);
        this.ctx.stroke();
        
        this.lastX = x;
        this.lastY = y;
    }
    
    stopDrawing() {
        this.isDrawing = false;
    }
    
    setupEventListeners() {
        // Level selector
        document.getElementById('levelSelect').addEventListener('change', (e) => {
            this.currentLevel = e.target.value;
            this.updateSelectStyling();
            this.updateLevelDropdownMastery();
            this.startNewRound();
        });
        
        // Clear button
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearCanvas();
            // Don't remove background - keep it for reference while redrawing
        });
        
        // Show answer button
        document.getElementById('showAnswerBtn').addEventListener('click', () => {
            this.showAnswer();
        });
        
        // Difficulty buttons
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const difficulty = parseInt(e.target.dataset.difficulty);
                const difficultyText = e.target.textContent.replace(/\d+/, '').trim(); // Remove number, keep text
                const difficultyColors = {
                    1: '#ef4444', // Very Hard - red
                    2: '#f97316', // Hard - orange
                    3: '#f59e0b', // Almost - yellow
                    4: '#84cc16', // Easy - lime
                    5: '#10b981'  // Very Easy - green
                };
                this.showToast(difficultyText, difficultyColors[difficulty]);
                this.recordDifficulty(difficulty);
                this.nextCharacter();
            });
        });
        
        // Keyboard shortcuts for desktop
        document.addEventListener('keydown', (e) => {
            // Spacebar to show answer
            if (e.code === 'Space') {
                e.preventDefault();
                const answerContainer = document.getElementById('answerContainer');
                // Only show answer if it's not already shown
                if (answerContainer && answerContainer.classList.contains('hidden')) {
                    this.showAnswer();
                }
            }
            
            // Number keys 1-5 for difficulty buttons
            if (e.code >= 'Digit1' && e.code <= 'Digit5') {
                e.preventDefault();
                const difficulty = parseInt(e.code.slice(-1));
                const difficultySection = document.getElementById('difficultySection');
                
                // Only allow difficulty selection if buttons are visible
                if (!difficultySection.classList.contains('hidden')) {
                    const difficultyNames = {
                        1: 'Very Hard',
                        2: 'Hard', 
                        3: 'Almost',
                        4: 'Easy',
                        5: 'Very Easy'
                    };
                    const difficultyColors = {
                        1: '#ef4444', // Very Hard - red
                        2: '#f97316', // Hard - orange
                        3: '#f59e0b', // Almost - yellow
                        4: '#84cc16', // Easy - lime
                        5: '#10b981'  // Very Easy - green
                    };
                    this.showToast(difficultyNames[difficulty], difficultyColors[difficulty]);
                    this.recordDifficulty(difficulty);
                    this.nextCharacter();
                }
            }
        });
        
    }
    
    startNewRound() {
        this.currentCharIndex = 0;
        this.updateLevelDropdownMastery();
        this.nextCharacter();
    }
    
    getNextCharacter() {
        const maxChars = this.levelConfig[this.currentLevel];
        const levelChars = this.characters.slice(0, Math.min(maxChars, this.characters.length));
        
        if (levelChars.length === 0) return null;
        
        // Use spaced repetition algorithm
        const weights = levelChars.map((char, index) => {
            const key = `${this.currentLevel}_${index}`;
            const progress = this.userProgress[key] || { difficulty: 3, lastSeen: 0, count: 0 };
            
            // Calculate weight based on difficulty and time since last seen
            const timeSinceLastSeen = Date.now() - progress.lastSeen;
            const hoursElapsed = timeSinceLastSeen / (1000 * 60 * 60);
            
            // Higher difficulty = higher weight
            // More time elapsed = higher weight
            let weight = progress.difficulty;
            
            // Increase weight based on time elapsed
            if (progress.count > 0) {
                weight *= (1 + hoursElapsed / 24); // Increase weight for each day elapsed
            }
            
            // New characters get high weight
            if (progress.count === 0) {
                weight = 5;
            }
            
            // Very easy characters (difficulty 5) with recent review get very low weight
            if (progress.difficulty === 5 && hoursElapsed < 24) {
                weight = 0.1;
            }
            
            return weight;
        });
        
        // Weighted random selection
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < levelChars.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return { char: levelChars[i], index: i };
            }
        }
        
        // Fallback to last character
        return { char: levelChars[levelChars.length - 1], index: levelChars.length - 1 };
    }
    
    nextCharacter() {
        const result = this.getNextCharacter();
        if (!result) {
            alert('No characters available for this level');
            return;
        }
        
        this.currentChar = result.char;
        this.currentCharIndex = result.index;
        
        // Update UI
        document.getElementById('pinyin').textContent = this.currentChar.pinyin || 'N/A';
        document.getElementById('english').textContent = this.currentChar.definition || 'No definition';
        
        // Hide answer container and difficulty section
        document.getElementById('answerContainer').classList.add('hidden');
        document.getElementById('difficultySection').classList.add('hidden');
        
        // Show the canvas control buttons again and reset their visibility
        document.querySelector('.canvas-controls').style.display = 'flex';
        document.getElementById('showAnswerBtn').style.display = 'inline-block';
        document.getElementById('clearBtn').style.display = 'inline-block';
        
        // Clear canvas and remove background
        this.removeCanvasBackground();
        this.clearCanvas();
        
        // Update mastery level and average score
        this.updateMasteryLevel();
        this.updateAverageScore();
        this.updateLevelDropdownMastery();
    }
    
    showAnswer() {
        if (!this.currentChar) return;
        
        const answerContainer = document.getElementById('answerContainer');
        const difficultySection = document.getElementById('difficultySection');
        const canvasControls = document.querySelector('.canvas-controls');
        const strokeGif = document.getElementById('strokeGif');
        
        // Set the GIF source
        strokeGif.src = `stroke_gifs/${this.currentChar.character}.gif`;
        
        // Extract first frame and set as canvas background
        this.setCanvasBackground(`stroke_gifs/${this.currentChar.character}.gif`);
        
        // Show the answer container and difficulty buttons
        answerContainer.classList.remove('hidden');
        difficultySection.classList.remove('hidden');
        
        // Keep clear button visible but hide show answer button
        document.getElementById('showAnswerBtn').style.display = 'none';
        document.getElementById('clearBtn').style.display = 'inline-block';
        
        // Scroll to bottom to show difficulty buttons
        setTimeout(() => {
            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: 'smooth'
            });
        }, 100);
    }
    
    recordDifficulty(difficulty) {
        if (!this.currentChar) return;
        
        const key = `${this.currentLevel}_${this.currentCharIndex}`;
        
        if (!this.userProgress[key]) {
            this.userProgress[key] = {
                character: this.currentChar.character,
                difficulty: difficulty,
                lastSeen: Date.now(),
                count: 1,
                history: [difficulty]
            };
        } else {
            const progress = this.userProgress[key];
            progress.history.push(difficulty);
            
            // Calculate weighted average of recent difficulties
            const recentHistory = progress.history.slice(-5); // Last 5 attempts
            progress.difficulty = recentHistory.reduce((sum, d) => sum + d, 0) / recentHistory.length;
            progress.lastSeen = Date.now();
            progress.count++;
        }
        
        this.saveProgress();
    }
    
    showToast(message, color = '#000000') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.style.backgroundColor = `rgba(${this.hexToRgb(color)}, 0.9)`;
        toast.classList.add('show');
        
        // Hide toast after 800ms
        setTimeout(() => {
            toast.classList.remove('show');
        }, 800);
    }
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? 
            `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : 
            '0, 0, 0';
    }
    
    setCanvasBackground(gifSrc) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            // Store the current canvas drawing
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            // Clear canvas and redraw guide lines
            this.clearCanvas();
            
            // Draw the first frame (scaled to fit) with low opacity
            this.ctx.globalAlpha = 0.3;
            const scale = Math.min(
                this.canvas.width / img.width,
                this.canvas.height / img.height
            );
            const width = img.width * scale;
            const height = img.height * scale;
            const x = (this.canvas.width - width) / 2;
            const y = (this.canvas.height - height) / 2;
            
            this.ctx.drawImage(img, x, y, width, height);
            
            // Restore full opacity for future drawing
            this.ctx.globalAlpha = 1;
            
            // Restore the user's drawing on top
            this.ctx.putImageData(imageData, 0, 0);
            
            // Store that we have a background
            this.hasBackground = true;
        };
        img.src = gifSrc;
    }
    
    removeCanvasBackground() {
        if (this.hasBackground) {
            this.clearCanvas();
            this.hasBackground = false;
        }
    }
    
    updateMasteryLevel() {
        const maxChars = Math.min(this.levelConfig[this.currentLevel], this.characters.length);
        let masteredCount = 0;
        
        for (let i = 0; i < maxChars; i++) {
            const key = `${this.currentLevel}_${i}`;
            const progress = this.userProgress[key];
            
            // Consider a character mastered if difficulty >= 4.0 (Easy/Very Easy) and seen at least 2 times
            if (progress && progress.difficulty >= 4.0 && progress.count >= 2) {
                masteredCount++;
            }
        }
        
        const masteryPercent = Math.round((masteredCount / maxChars) * 100);
        document.getElementById('masteryLevel').textContent = `${masteryPercent}% mastered`;
    }
    
    updateAverageScore() {
        const maxChars = Math.min(this.levelConfig[this.currentLevel], this.characters.length);
        let totalScore = 0;
        let attemptedCount = 0;
        
        for (let i = 0; i < maxChars; i++) {
            const key = `${this.currentLevel}_${i}`;
            const progress = this.userProgress[key];
            
            if (progress && progress.count > 0) {
                // Convert difficulty to score (1=Very Hard gets score 5, 5=Very Easy gets score 1)
                const score = 6 - progress.difficulty;
                totalScore += score;
                attemptedCount++;
            }
        }
        
        if (attemptedCount > 0) {
            const avgScore = totalScore / attemptedCount;
            document.getElementById('avgScore').textContent = `Avg Score: ${avgScore.toFixed(1)}/5`;
        } else {
            document.getElementById('avgScore').textContent = 'Avg Score: -';
        }
    }
    
    getAverageScoreForLevel(level) {
        const maxChars = Math.min(this.levelConfig[level], this.characters.length);
        let totalScore = 0;
        let attemptedCount = 0;
        
        for (let i = 0; i < maxChars; i++) {
            const key = `${level}_${i}`;
            const progress = this.userProgress[key];
            
            if (progress && progress.count > 0) {
                // Convert difficulty to score (1=Very Hard gets score 5, 5=Very Easy gets score 1)
                const score = 6 - progress.difficulty;
                totalScore += score;
                attemptedCount++;
            }
        }
        
        return attemptedCount > 0 ? totalScore / attemptedCount : 0;
    }
    
    updateSelectStyling() {
        const levelSelect = document.getElementById('levelSelect');
        const container = document.querySelector('.container');
        const body = document.body;
        
        // Remove existing level classes from select
        levelSelect.className = levelSelect.className.replace(/level-\w+/g, '');
        // Add current level class to select
        levelSelect.classList.add(`level-${this.currentLevel}`);
        
        // Remove existing level classes from container
        container.className = container.className.replace(/level-\w+/g, '');
        // Add current level class to container for site-wide theming
        container.classList.add(`level-${this.currentLevel}`);
        
        // Remove existing level classes from body
        body.className = body.className.replace(/level-\w+/g, '');
        // Add current level class to body for background theming
        body.classList.add(`level-${this.currentLevel}`);
    }
    
    updateLevelDropdownMastery() {
        const levelSelect = document.getElementById('levelSelect');
        const levels = ['novice', 'beginner', 'intermediate', 'advanced', 'master'];
        const baseTexts = {
            'novice': 'Novice (10 chars)',
            'beginner': 'Beginner (25 chars)', 
            'intermediate': 'Intermediate (100 chars)',
            'advanced': 'Advanced (1000 chars)',
            'master': 'Master (All chars)'
        };
        
        const levelColors = {
            'novice': '#8b9dc3', // muted blue/purple
            'beginner': '#52a085', // muted green 
            'intermediate': '#5a9bb8', // muted blue/green
            'advanced': '#c08552', // muted orange
            'master': '#c36e6e' // muted red
        };
        
        levels.forEach((level, index) => {
            const avgScore = this.getAverageScoreForLevel(level);
            const option = levelSelect.options[index];
            const color = levelColors[level];
            
            // Remove existing classes
            option.className = '';
            
            if (avgScore > 0) {
                const scoreText = avgScore.toFixed(1);
                option.textContent = `${baseTexts[level]} - ${scoreText}/5`;
                
                // Add class for level and score
                const fillPercent = Math.round((avgScore / 5) * 100);
                option.className = `level-${level} fill-${Math.min(100, Math.max(0, fillPercent))}`;
                
                // Try both approaches - class and inline style
                option.style.setProperty('--fill-color', color);
                option.style.setProperty('--fill-percent', `${fillPercent}%`);
                option.style.background = `linear-gradient(to right, ${color} ${fillPercent}%, #f3f4f6 ${fillPercent}%)`;
            } else {
                option.textContent = baseTexts[level];
                option.className = `level-${level} no-score`;
                option.style.background = '#f3f4f6';
            }
        });
    }
    
    updateStatistics() {
        const maxChars = Math.min(this.levelConfig[this.currentLevel], this.characters.length);
        
        // Calculate progress
        let veryEasyCount = 0;
        let totalAttempted = 0;
        const problematicChars = [];
        
        for (let i = 0; i < maxChars; i++) {
            const key = `${this.currentLevel}_${i}`;
            const progress = this.userProgress[key];
            
            if (progress && progress.count > 0) {
                totalAttempted++;
                
                if (progress.difficulty >= 4.0 && progress.count >= 2) {
                    veryEasyCount++;
                }
                
                // Convert difficulty to score (1=Very Hard gets score 5, 5=Very Easy gets score 1)
                const score = 6 - progress.difficulty;
                if (score <= 2.5) { // Show characters with low scores (≤2.5/5)
                    problematicChars.push({
                        character: this.characters[i].character,
                        pinyin: this.characters[i].pinyin,
                        difficulty: progress.difficulty,
                        score: score,
                        attempts: progress.count
                    });
                }
            }
        }
        
        // Sort problematic characters by lowest score (most problematic first)
        problematicChars.sort((a, b) => a.score - b.score);
        
        // Update progress bar
        const progressPercent = totalAttempted > 0 ? (veryEasyCount / totalAttempted) * 100 : 0;
        document.getElementById('progressFill').style.width = `${progressPercent}%`;
        document.getElementById('progressText').textContent = `${Math.round(progressPercent)}% of attempted characters mastered`;
        
        // Update problematic characters list
        const problematicList = document.getElementById('problematicChars');
        problematicList.innerHTML = '';
        
        problematicChars.slice(0, 10).forEach(char => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="char-display">${char.character}</span>
                <span class="char-pinyin">${char.pinyin}</span>
                <span class="char-difficulty">Score: ${char.score.toFixed(1)}/5</span>
            `;
            problematicList.appendChild(li);
        });
        
        if (problematicChars.length === 0) {
            problematicList.innerHTML = '<li>No problematic characters yet!</li>';
        }
        
        // Update level stats
        const levelStats = document.getElementById('levelStats');
        levelStats.innerHTML = `
            <div class="stat-item">
                <span>Total Characters:</span>
                <span>${maxChars}</span>
            </div>
            <div class="stat-item">
                <span>Attempted:</span>
                <span>${totalAttempted}</span>
            </div>
            <div class="stat-item">
                <span>Mastered:</span>
                <span>${veryEasyCount}</span>
            </div>
            <div class="stat-item">
                <span>Needs Practice:</span>
                <span>${problematicChars.length}</span>
            </div>
        `;
    }
    
    saveProgress() {
        localStorage.setItem('chineseCharProgress', JSON.stringify(this.userProgress));
    }
    
    loadProgress() {
        const saved = localStorage.getItem('chineseCharProgress');
        return saved ? JSON.parse(saved) : {};
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new ChineseCharacterApp();
});