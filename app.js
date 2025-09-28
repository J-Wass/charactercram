// Simplified Chinese Character Practice App with Anki-like Spaced Repetition

class ChineseCharacterApp {
    constructor(algorithmType = 'improved') {
        this.characters = [];
        this.currentChar = null;
        this.userProgress = this.loadProgress();
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.hasBackground = false;

        // Initialize the algorithm
        this.currentAlgorithmType = algorithmType;
        this.algorithm = createAlgorithm(algorithmType);

        // Algorithm state (managed by the app, used by algorithms)
        this.algorithmState = {
            recentFailedCards: new Set(),
            sessionCorrectStreak: 0,
            todayReviews: 0
        };

        this.init();
    }

    // Method to switch algorithms
    switchAlgorithm(algorithmType) {
        if (this.currentAlgorithmType === algorithmType) return;

        this.currentAlgorithmType = algorithmType;
        this.algorithm = createAlgorithm(algorithmType);

        // Reset algorithm state for new algorithm
        this.algorithmState.sessionCorrectStreak = 0;
        this.algorithmState.recentFailedCards.clear();

        // Update UI
        const algorithmNameElement = document.getElementById('algorithmName');
        if (algorithmNameElement) {
            algorithmNameElement.textContent = this.algorithm.name;
        }

        console.log(`Switched to ${this.algorithm.name} algorithm`);
        this.showToast(`Algorithm: ${this.algorithm.name}`, '#667eea');

        // Get next card with new algorithm
        this.nextCharacter();
    }

    // Get current algorithm info
    getAlgorithmInfo() {
        return {
            type: this.currentAlgorithmType,
            name: this.algorithm.name,
            config: this.algorithm.config
        };
    }

    async init() {
        await this.loadCharacters();
        this.setupCanvas();
        this.setupEventListeners();
        this.setupStatsModal();
        this.updateStats();
        this.startNewRound();
    }

    async loadCharacters() {
        try {
            if (typeof CHINESE_CHARACTERS !== 'undefined') {
                // Sort characters by frequency rank (lower number = more frequent)
                this.characters = CHINESE_CHARACTERS
                    .map(char => ({
                        character: char.character,
                        pinyin: char.pinyin,
                        definition: char.definition || 'No definition',
                        frequency_rank: parseInt(char.frequency_rank),
                        hsk_level: char.hsk_level
                    }))
                    .sort((a, b) => a.frequency_rank - b.frequency_rank);
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
        // Clear button
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearCanvas();
        });

        // Show answer button
        document.getElementById('showAnswerBtn').addEventListener('click', () => {
            this.showAnswer();
        });

        // Difficulty buttons
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const difficulty = parseInt(e.target.dataset.difficulty);
                const difficultyText = e.target.textContent.replace(/\d+/, '').trim();
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

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            // Spacebar to show answer
            if (e.code === 'Space') {
                e.preventDefault();
                const answerContainer = document.getElementById('answerContainer');
                if (answerContainer && answerContainer.classList.contains('hidden')) {
                    this.showAnswer();
                }
            }

            // Number keys 1-5 for difficulty buttons
            if (e.code >= 'Digit1' && e.code <= 'Digit5') {
                e.preventDefault();
                const difficulty = parseInt(e.code.slice(-1));
                const difficultySection = document.getElementById('difficultySection');

                if (!difficultySection.classList.contains('hidden')) {
                    const difficultyNames = {
                        1: 'No Idea',
                        2: 'Hard',
                        3: 'Almost',
                        4: 'Easy',
                        5: 'Instant'
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
        this.nextCharacter();
    }

    // Delegate to the selected algorithm
    getNextCharacter() {
        return this.algorithm.getNextCard(this.characters, this.userProgress, this.algorithmState);
    }

    nextCharacter() {
        const result = this.getNextCharacter();
        if (!result) {
            alert('No characters available');
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

        // Show the show answer button again
        document.querySelector('.canvas-controls').style.display = 'flex';
        document.getElementById('showAnswerBtn').style.display = 'inline-block';

        // Clear canvas and remove background
        this.removeCanvasBackground();
        this.clearCanvas();

        // Force scroll to the top
        setTimeout(() => {
            this.smoothScrollTo(0);
        }, 100);
    }

    showAnswer() {
        if (!this.currentChar) return;

        const answerContainer = document.getElementById('answerContainer');
        const difficultySection = document.getElementById('difficultySection');
        const gif = document.getElementById('strokeGif');

        // Set the GIF source
        gif.src = `img/${this.currentChar.character}.gif`;

        // Extract first frame and set as canvas background
        this.setCanvasBackground(`img/${this.currentChar.character}.gif`);

        // Show the answer container and difficulty buttons
        answerContainer.classList.remove('hidden');
        difficultySection.classList.remove('hidden');

        // Hide show answer button
        document.getElementById('showAnswerBtn').style.display = 'none';

        // Scroll to bottom to show difficulty buttons
        setTimeout(() => {
            const maxHeight = Math.max(
                document.body.scrollHeight,
                document.documentElement.scrollHeight
            );
            this.smoothScrollTo(maxHeight);
        }, 100);
    }

    recordDifficulty(difficulty) {
        if (!this.currentChar) return;

        const now = Date.now();
        const index = this.currentCharIndex;

        // Update algorithm state
        if (this.algorithm.isCardFailed(difficulty)) {
            this.algorithmState.recentFailedCards.add(index);
            this.algorithmState.sessionCorrectStreak = 0;

            // Auto-remove from failed set after timeout
            setTimeout(() => {
                this.algorithmState.recentFailedCards.delete(index);
            }, this.algorithm.config.failedCardTimeout);
        } else {
            this.algorithmState.sessionCorrectStreak++;
            this.algorithmState.recentFailedCards.delete(index);
        }

        if (!this.userProgress[index]) {
            // First time seeing this card
            const initialInterval = this.algorithm.calculateInitialInterval(difficulty);
            this.userProgress[index] = {
                character: this.currentChar.character,
                firstSeen: now,
                reviewCount: 1,
                successCount: this.algorithm.isCardCorrect(difficulty) ? 1 : 0,
                successRate: this.algorithm.isCardCorrect(difficulty) ? 1 : 0,
                lastDifficulty: difficulty,
                lastSeen: now,
                nextReview: now + initialInterval,
                interval: initialInterval,
                history: [difficulty]
            };
        } else {
            // Updating existing card
            const progress = this.userProgress[index];
            progress.reviewCount++;
            progress.lastDifficulty = difficulty;
            progress.lastSeen = now;

            // Add to history
            if (!progress.history) {
                progress.history = [];
            }
            progress.history.push(difficulty);

            // Update success rate
            if (this.algorithm.isCardCorrect(difficulty)) {
                progress.successCount++;
            }
            progress.successRate = progress.successCount / progress.reviewCount;

            // Calculate next interval using the algorithm
            progress.interval = this.algorithm.calculateNextInterval(
                difficulty,
                progress.interval,
                progress.successRate
            );
            progress.nextReview = now + progress.interval;
        }

        // Update stats
        this.algorithmState.todayReviews++;

        this.saveProgress();
        this.updateStats();
    }


    showToast(message, color = '#000000') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.style.backgroundColor = `rgba(${this.hexToRgb(color)}, 0.9)`;
        toast.classList.add('show');

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
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

            this.clearCanvas();

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

            this.ctx.globalAlpha = 1;
            this.ctx.putImageData(imageData, 0, 0);
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

    smoothScrollTo(targetPosition) {
        if (window.scrollTo && 'behavior' in document.documentElement.style) {
            try {
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                return;
            } catch (e) {
                // Fall through to manual animation
            }
        }

        const startPosition = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
        const distance = targetPosition - startPosition;
        const duration = 300;
        let start = null;

        function animation(currentTime) {
            if (start === null) start = currentTime;
            const timeElapsed = currentTime - start;
            const run = easeInOutQuad(timeElapsed, startPosition, distance, duration);

            window.scrollTo(0, run);
            if (document.documentElement.scrollTop !== undefined) {
                document.documentElement.scrollTop = run;
            }
            if (document.body.scrollTop !== undefined) {
                document.body.scrollTop = run;
            }

            if (timeElapsed < duration) {
                requestAnimationFrame(animation);
            }
        }

        function easeInOutQuad(t, b, c, d) {
            t /= d / 2;
            if (t < 1) return c / 2 * t * t + b;
            t--;
            return -c / 2 * (t * (t - 2) - 1) + b;
        }

        requestAnimationFrame(animation);
    }

    saveProgress() {
        localStorage.setItem('chineseCharProgress', JSON.stringify(this.userProgress));
    }

    loadProgress() {
        const saved = localStorage.getItem('chineseCharProgress');
        return saved ? JSON.parse(saved) : {};
    }

    // Stats methods
    setupStatsModal() {
        const cornerBtn = document.getElementById('statsCornerBtn');
        const modal = document.getElementById('statsModal');
        const closeBtn = document.getElementById('statsCloseBtn');
        const searchInput = document.getElementById('charSearchInput');
        const searchResults = document.getElementById('searchResults');

        // Open modal
        cornerBtn.addEventListener('click', () => {
            modal.classList.add('open');
            this.updateStats(); // Update stats when opening
            searchInput.value = ''; // Clear search on open
            searchResults.innerHTML = '';
        });

        // Close modal
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('open');
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('open');
            }
        });

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('open')) {
                modal.classList.remove('open');
            }
        });

        // Setup search functionality
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim().toLowerCase();

            if (query.length === 0) {
                searchResults.innerHTML = '';
                return;
            }

            // Debounce search
            searchTimeout = setTimeout(() => {
                this.searchCharacters(query);
            }, 300);
        });
    }

    searchCharacters(query) {
        const searchResults = document.getElementById('searchResults');
        const matches = [];

        // Normalize query for better matching
        const normalizedQuery = query.toLowerCase().trim();

        // Search through all characters
        for (let i = 0; i < this.characters.length; i++) {
            const char = this.characters[i];

            // Normalize pinyin for comparison (remove tones/accents)
            const normalizedPinyin = char.pinyin.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, ''); // Remove diacritical marks

            // Search in character, pinyin, and definition
            let matchScore = 0;
            let isMatch = false;

            // Exact character match gets highest base score
            if (char.character === normalizedQuery) {
                matchScore = 1000;
                isMatch = true;
            }
            // Exact pinyin match (without tones)
            else if (normalizedPinyin === normalizedQuery) {
                matchScore = 900;
                isMatch = true;
            }
            // Exact pinyin match (with tones)
            else if (char.pinyin.toLowerCase() === normalizedQuery) {
                matchScore = 850;
                isMatch = true;
            }
            // Partial pinyin match (without tones)
            else if (normalizedPinyin.includes(normalizedQuery)) {
                matchScore = 450;
                isMatch = true;
            }
            // Partial pinyin match (with tones)
            else if (char.pinyin.toLowerCase().includes(normalizedQuery)) {
                matchScore = 400;
                isMatch = true;
            }
            // Definition match - check for whole word matches for better accuracy
            else if (char.definition) {
                const defLower = char.definition.toLowerCase();

                // Check for exact word match (surrounded by word boundaries)
                const wordRegex = new RegExp(`\\b${normalizedQuery}\\b`, 'i');
                if (wordRegex.test(char.definition)) {
                    matchScore = 300; // Higher score for whole word match
                    isMatch = true;
                }
                // Check for "I" specifically - match characters that mean "I/me"
                else if (normalizedQuery === 'i' &&
                         (defLower.includes('i;') ||
                          defLower.includes('i,') ||
                          defLower.includes('i ') ||
                          defLower === 'i' ||
                          defLower.includes('me;') ||
                          defLower.includes('me,') ||
                          defLower.includes('me ') ||
                          defLower === 'me')) {
                    matchScore = 350; // Boost for pronoun matches
                    isMatch = true;
                }
                // Partial definition match
                else if (defLower.includes(normalizedQuery)) {
                    matchScore = 200;
                    isMatch = true;
                }
            }

            if (isMatch) {
                // Boost score based on study status and frequency
                const progress = this.userProgress[i];

                // Studied characters get a boost (users likely want to review these)
                if (progress) {
                    matchScore += 100;
                    // Additional boost for recently studied
                    if (progress.reviewCount > 0 && progress.reviewCount < 5) {
                        matchScore += 50;
                    }
                }

                // Boost common characters (lower frequency rank = more common)
                // Normalize frequency rank (1-9900) to score (0-100)
                const freqScore = Math.max(0, 100 - (char.frequency_rank / 100));
                matchScore += freqScore;

                matches.push({
                    char: char,
                    index: i,
                    progress: progress,
                    score: matchScore
                });
            }
        }

        // Sort by score (highest first)
        matches.sort((a, b) => b.score - a.score);

        // Limit to top 20 results
        const topMatches = matches.slice(0, 20);

        // Display results
        if (topMatches.length === 0) {
            searchResults.innerHTML = '<div class="search-no-results">No characters found</div>';
        } else {
            searchResults.innerHTML = topMatches.map(match => {
                const masteryText = match.progress ?
                    `${match.progress.reviewCount} reviews, ${Math.round(match.progress.successRate * 100)}% success` :
                    'Not studied yet';

                const freqText = `Word Freq #${match.char.frequency_rank}`;

                const studiedClass = match.progress ? 'studied' : '';
                return `
                    <div class="search-result-item ${studiedClass}" data-index="${match.index}">
                        <div class="search-result-char">${match.char.character}</div>
                        <div class="search-result-info">
                            <div class="search-result-pinyin">${match.char.pinyin}</div>
                            <div class="search-result-meaning">${match.char.definition || 'No definition'}</div>
                            <div class="search-result-meaning" style="font-size: 0.8em; margin-top: 5px; color: #999;">
                                ${masteryText} • ${freqText}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Add click handlers to practice specific character
            searchResults.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const index = parseInt(item.dataset.index);
                    this.practiceSpecificCharacter(index);
                    document.getElementById('statsModal').classList.remove('open');
                });
            });
        }
    }

    practiceSpecificCharacter(index) {
        // Set the current character to the selected one
        this.currentChar = this.characters[index];
        this.currentCharIndex = index;

        // Update UI
        document.getElementById('pinyin').textContent = this.currentChar.pinyin || 'N/A';
        document.getElementById('english').textContent = this.currentChar.definition || 'No definition';

        // Hide answer and show drawing canvas
        document.getElementById('answerContainer').classList.add('hidden');
        document.getElementById('difficultySection').classList.add('hidden');
        document.getElementById('showAnswerBtn').style.display = 'block';

        // Clear canvas
        this.clearCanvas();
    }

    updateStats() {
        const totalLearned = Object.keys(this.userProgress).length;
        const totalCards = this.characters.length;
        const now = Date.now();
        const todayEnd = new Date().setHours(23, 59, 59, 999);

        // Calculate mastered and nearly mastered cards
        let masteredCount = 0;
        let nearlyMasteredCount = 0;
        let dueTodayCount = 0;

        for (const [index, progress] of Object.entries(this.userProgress)) {
            // Mastered: 80%+ success rate with 3+ reviews
            if (progress.successRate >= 0.8 && progress.reviewCount >= 3) {
                masteredCount++;
            }
            // Nearly mastered: 60-79% success rate OR exactly 2 reviews with good performance
            else if ((progress.successRate >= 0.6 && progress.successRate < 0.8 && progress.reviewCount >= 2) ||
                     (progress.reviewCount === 2 && progress.successRate >= 0.5)) {
                nearlyMasteredCount++;
            }

            // Due today: cards that need review before end of today
            if (progress.nextReview && progress.nextReview <= todayEnd) {
                dueTodayCount++;
            }
        }

        // Update DOM
        const learnedElement = document.getElementById('totalLearned');
        const prevLearned = parseInt(learnedElement.textContent) || 0;
        learnedElement.textContent = totalLearned;

        // Animate milestone achievements
        if (totalLearned > prevLearned && totalLearned % 10 === 0) {
            learnedElement.classList.add('milestone');
            setTimeout(() => learnedElement.classList.remove('milestone'), 500);
        }

        document.getElementById('mastered').textContent = masteredCount;
        document.getElementById('nearlyMastered').textContent = nearlyMasteredCount;
        document.getElementById('dueToday').textContent = dueTodayCount;
    }

    getTodayReviewCount() {
        const todayStart = new Date().setHours(0, 0, 0, 0);
        let count = 0;

        for (const progress of Object.values(this.userProgress)) {
            if (progress.lastSeen >= todayStart) {
                count++;
            }
        }

        return count;
    }

}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new ChineseCharacterApp();
});