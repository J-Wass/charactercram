// Simplified Chinese Character Practice App with Anki-like Spaced Repetition

class ChineseCharacterApp {
    constructor(algorithmType = 'bucket') {
        this.characters = [];
        this.currentChar = null;
        this.currentCharIndex = null;
        this.currentResult = null;  // Store the full result from getNextCard
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
        this.setupDebugModal();
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
        if (!result || !result.char) {
            alert('No characters available');
            return;
        }

        this.currentChar = result.char;
        this.currentCharIndex = result.index;
        this.currentResult = result;  // Store the full result

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

        // Calculate target review position for MasteryBased algorithm
        let targetReviewPosition;
        if (this.algorithm.calculateTargetReviewPosition) {
            targetReviewPosition = this.algorithm.calculateTargetReviewPosition(difficulty);
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
                history: [difficulty],
                targetReviewPosition: targetReviewPosition, // Add target position
                // Mastery tracking fields (for algorithms that use them)
                consecutiveGood: difficulty >= 4 ? 1 : 0,
                wasUnmastered: false,
                masteredAt: null,
                // Bucket tracking (for Bucket algorithm)
                inBucket: this.currentResult && this.currentResult.addToBucket ? true : false
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

            // Track consecutive good ratings for mastery-based algorithms
            if (difficulty >= 4) {
                progress.consecutiveGood = (progress.consecutiveGood || 0) + 1;

                // Check if card just reached mastery threshold
                if (this.algorithm.config.masteryThreshold &&
                    progress.consecutiveGood === this.algorithm.config.masteryThreshold &&
                    !progress.masteredAt) {
                    progress.masteredAt = now;
                    progress.wasUnmastered = false;
                    // Remove from bucket when mastered
                    if (this.algorithm.name === 'Bucket Learning') {
                        progress.inBucket = false;
                    }
                    console.log(`Card ${this.currentChar.character} mastered!`);
                }
            } else {
                // Reset consecutive good count
                progress.consecutiveGood = 0;

                // If this was a mastered card, mark it as unmastered
                if (this.algorithm.config.masteryThreshold && progress.masteredAt) {
                    progress.wasUnmastered = true;
                    progress.masteredAt = null;
                    // Add back to bucket when unmastered
                    if (this.algorithm.name === 'Bucket Learning') {
                        progress.inBucket = true;
                    }
                    console.log(`Card ${this.currentChar.character} unmastered (got difficulty ${difficulty})`);
                }
            }

            // Calculate next interval using the algorithm
            progress.interval = this.algorithm.calculateNextInterval(
                difficulty,
                progress.interval,
                progress.successRate
            );
            progress.nextReview = now + progress.interval;

            // Update target review position if using MasteryBased
            if (targetReviewPosition !== undefined) {
                progress.targetReviewPosition = targetReviewPosition;
            }
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

    // Debug methods
    setupDebugModal() {
        const debugBtn = document.getElementById('debugBtn');
        const modal = document.getElementById('debugModal');
        const closeBtn = document.getElementById('debugCloseBtn');

        // Open modal
        debugBtn.addEventListener('click', () => {
            this.updateDebugInfo();
            modal.classList.add('open');
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
    }

    updateDebugInfo() {
        // Session info
        const sessionInfo = document.getElementById('debugSessionInfo');

        // Get bucket/mastered counts if using Bucket algorithm
        let bucketInfo = '';
        if (this.algorithm.name === 'Bucket Learning') {
            const bucketCards = this.algorithm.getActiveBucket(this.userProgress);
            const masteredCards = this.algorithm.getMasteredCards(this.userProgress);
            bucketInfo = `
                <div class="debug-info-row">
                    <span>Active Bucket:</span> <strong>${bucketCards.length} / ${this.algorithm.config.bucketSize}</strong>
                </div>
                <div class="debug-info-row">
                    <span>Mastered Cards:</span> <strong>${masteredCards.length}</strong>
                </div>
            `;
        }

        sessionInfo.innerHTML = `
            <div class="debug-info-row">
                <span>Algorithm:</span> <strong>${this.algorithm.name}</strong>
            </div>
            ${bucketInfo}
            <div class="debug-info-row">
                <span>Cards Seen (Session):</span> <strong>${this.algorithm.sessionCardsSeen || 0}</strong>
            </div>
            <div class="debug-info-row">
                <span>Correct Streak:</span> <strong>${this.algorithmState.sessionCorrectStreak}</strong>
            </div>
            <div class="debug-info-row">
                <span>Failed Cards Active:</span> <strong>${this.algorithmState.recentFailedCards.size}</strong>
            </div>
            <div class="debug-info-row">
                <span>Total Progress Saved:</span> <strong>${Object.keys(this.userProgress).length} cards</strong>
            </div>
        `;

        // Current card info
        const currentCard = document.getElementById('debugCurrentCard');
        if (this.currentChar) {
            const progress = this.userProgress[this.currentCharIndex];

            // Check mastery status for Bucket algorithm
            let masteryStatus = '';
            if (this.algorithm.name === 'Bucket Learning' && progress) {
                if (this.algorithm.isCardMastered(progress)) {
                    masteryStatus = '<span style="color: #10b981; font-weight: bold;">✓ MASTERED</span>';
                } else if (progress.wasUnmastered) {
                    masteryStatus = '<span style="color: #f97316; font-weight: bold;">⚠ UNMASTERED</span>';
                } else if (progress.consecutiveGood > 0) {
                    masteryStatus = `<span style="color: #f59e0b;">Progress: ${progress.consecutiveGood}/${this.algorithm.config.masteryThreshold}</span>`;
                } else {
                    masteryStatus = '<span style="color: #999;">Learning</span>';
                }
            }

            currentCard.innerHTML = `
                <div class="debug-card-info">
                    <span class="debug-char">${this.currentChar.character}</span>
                    <span>${this.currentChar.pinyin}</span>
                    <span class="debug-small">${this.currentChar.definition}</span>
                </div>
                ${progress ? `
                    ${masteryStatus ? `<div class="debug-info-row"><span>Status:</span> ${masteryStatus}</div>` : ''}
                    <div class="debug-info-row">
                        <span>Reviews:</span> <strong>${progress.reviewCount}</strong>
                    </div>
                    <div class="debug-info-row">
                        <span>Success Rate:</span> <strong>${Math.round(progress.successRate * 100)}%</strong>
                    </div>
                    ${progress.consecutiveGood !== undefined ? `
                        <div class="debug-info-row">
                            <span>Consecutive Good:</span> <strong>${progress.consecutiveGood}</strong>
                        </div>
                    ` : ''}
                    ${progress.targetReviewPosition ? `
                        <div class="debug-info-row">
                            <span>Target Position:</span> <strong>${progress.targetReviewPosition}</strong>
                        </div>
                    ` : ''}
                ` : '<div class="debug-info-row">New Card (never seen)</div>'}
            `;
        } else {
            currentCard.innerHTML = '<div>No current card</div>';
        }

        // Get upcoming cards
        this.showUpcomingCards();

        // Show card categories
        this.showCardCategories();
    }

    showUpcomingCards() {
        const upcomingDiv = document.getElementById('debugUpcomingCards');
        let html = '';

        // Show bucket contents if using Bucket algorithm
        if (this.algorithm.name === 'Bucket Learning') {
            const bucketCards = this.algorithm.getActiveBucket(this.userProgress);

            html += '<h4 style="margin-bottom: 10px; color: #667eea;">Active Bucket Cards:</h4>';

            if (bucketCards.length === 0) {
                html += '<div style="padding: 10px; color: #999; font-style: italic;">Bucket is empty</div>';
            } else {
                html += bucketCards.map((index, idx) => {
                    const char = this.characters[index];
                    const progress = this.userProgress[index];

                    // Skip if no progress data (shouldn't happen, but safety check)
                    if (!progress) return '';

                    const consecutiveGood = progress.consecutiveGood || 0;
                    let statusBadge = '';
                    if (consecutiveGood > 0) {
                        statusBadge = `<span style="background: #f59e0b; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${consecutiveGood}/${this.algorithm.config.masteryThreshold}</span>`;
                    } else {
                        statusBadge = `<span style="background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">0/${this.algorithm.config.masteryThreshold}</span>`;
                    }

                    return `
                        <div class="debug-upcoming-card" style="background: rgba(102, 126, 234, 0.05); border-left: 3px solid #667eea;">
                            <span class="debug-upcoming-number">${idx + 1}.</span>
                            <span class="debug-char-small">${char.character}</span>
                            <span class="debug-pinyin">${char.pinyin}</span>
                            <span class="debug-stats">
                                ${progress.reviewCount} reviews | ${Math.round(progress.successRate * 100)}% | ${statusBadge}
                            </span>
                        </div>
                    `;
                }).join('');
            }

            html += '<h4 style="margin: 20px 0 10px; color: #667eea;">Upcoming Cards (Next ~20):</h4>';
        }

        const upcoming = [];

        // Temporarily store current state
        const originalSessionCards = this.algorithm.sessionCardsSeen || 0;

        // Simulate next 20 cards
        for (let i = 0; i < 20; i++) {
            const result = this.algorithm.getNextCard(this.characters, this.userProgress, this.algorithmState);
            if (result && result.char) {
                const progress = this.userProgress[result.index];
                upcoming.push({
                    char: result.char.character,
                    pinyin: result.char.pinyin,
                    index: result.index,
                    reviews: progress ? progress.reviewCount : 0,
                    successRate: progress ? Math.round(progress.successRate * 100) : 0,
                    targetPos: progress ? progress.targetReviewPosition : null,
                    cardsUntilDue: progress && progress.targetReviewPosition ?
                        progress.targetReviewPosition - (this.algorithm.sessionCardsSeen || 0) : null,
                    isMasteryCheck: result.isMasteryCheck,
                    isNew: result.isNew
                });
            }
        }

        // Restore state
        if (this.algorithm.sessionCardsSeen !== undefined) {
            this.algorithm.sessionCardsSeen = originalSessionCards;
        }

        html += upcoming.map((card, idx) => {
            let badge = '';
            if (card.isMasteryCheck) {
                badge = '<span style="background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 8px;">MASTERY CHECK</span>';
            } else if (card.isNew) {
                badge = '<span style="background: #9ca3af; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 8px;">NEW</span>';
            }

            return `
                <div class="debug-upcoming-card">
                    <span class="debug-upcoming-number">${idx + 1}.</span>
                    <span class="debug-char-small">${card.char}</span>
                    <span class="debug-pinyin">${card.pinyin}</span>
                    <span class="debug-stats">
                        ${card.reviews > 0 ? `Tried ${card.reviews} times | ${card.successRate}% success` : 'NEW'}
                        ${card.cardsUntilDue !== null ?
                            (card.cardsUntilDue <= 0 ?
                                `<span class="debug-due">DUE</span>` :
                                `<span class="debug-in">in ${card.cardsUntilDue}</span>`)
                            : ''}
                        ${badge}
                    </span>
                </div>
            `;
        }).join('');

        upcomingDiv.innerHTML = html;
    }

    showCardCategories() {
        const categoriesDiv = document.getElementById('debugCardCategories');

        // Categorize all cards
        const categories = {
            dueNow: 0,
            dueSoon: 0,
            dueLater: 0,
            new: 0,
            failed: this.algorithmState.recentFailedCards.size,
            mastered: 0,
            familiar: 0,
            learning: 0
        };

        const sessionCards = this.algorithm.sessionCardsSeen || 0;

        for (let i = 0; i < this.characters.length; i++) {
            const progress = this.userProgress[i];

            if (!progress) {
                categories.new++;
            } else {
                // Check mastery level
                const { reviewCount, successRate } = progress;
                if ((reviewCount >= 5 && successRate >= 0.8) || (reviewCount >= 3 && successRate >= 0.9)) {
                    categories.mastered++;
                } else if (reviewCount >= 3 && successRate >= 0.6) {
                    categories.familiar++;
                } else if (reviewCount > 0) {
                    categories.learning++;
                }

                // Check due status
                if (progress.targetReviewPosition !== undefined) {
                    const cardsUntilDue = progress.targetReviewPosition - sessionCards;
                    if (cardsUntilDue <= 0) {
                        categories.dueNow++;
                    } else if (cardsUntilDue <= 5) {
                        categories.dueSoon++;
                    } else {
                        categories.dueLater++;
                    }
                }
            }
        }

        categoriesDiv.innerHTML = `
            <div class="debug-category-grid">
                <div class="debug-category">
                    <div class="debug-category-count">${categories.failed}</div>
                    <div class="debug-category-label">Failed (Priority)</div>
                </div>
                <div class="debug-category">
                    <div class="debug-category-count">${categories.dueNow}</div>
                    <div class="debug-category-label">Due Now</div>
                </div>
                <div class="debug-category">
                    <div class="debug-category-count">${categories.dueSoon}</div>
                    <div class="debug-category-label">Due Soon (≤5)</div>
                </div>
                <div class="debug-category">
                    <div class="debug-category-count">${categories.dueLater}</div>
                    <div class="debug-category-label">Due Later</div>
                </div>
                <div class="debug-category">
                    <div class="debug-category-count">${categories.new}</div>
                    <div class="debug-category-label">New Cards</div>
                </div>
                <div class="debug-category">
                    <div class="debug-category-count">${categories.learning}</div>
                    <div class="debug-category-label">Learning</div>
                </div>
                <div class="debug-category">
                    <div class="debug-category-count">${categories.familiar}</div>
                    <div class="debug-category-label">Familiar</div>
                </div>
                <div class="debug-category">
                    <div class="debug-category-count">${categories.mastered}</div>
                    <div class="debug-category-label">Mastered</div>
                </div>
            </div>
        `;
    }

}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new ChineseCharacterApp();
});