// Simplified Chinese Character Practice App with Anki-like Spaced Repetition

class ChineseCharacterApp {
    constructor(algorithmType = 'score') {  // Using FocusedSetsAlgorithm
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
        this.charCount = 1;  // Track number of characters in current word (1 or 2)

        // Stroke tracking for undo functionality
        this.strokes = [];  // Array of completed strokes
        this.currentStroke = [];  // Current stroke being drawn

        // Speech synthesis
        this.speechSynth = window.speechSynthesis;
        this.chineseVoice = null;

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

    // Load Chinese voice for text-to-speech
    loadChineseVoice() {
        if (!this.speechSynth) return;

        // Wait for voices to be loaded
        const loadVoices = () => {
            const voices = this.speechSynth.getVoices();

            // Try to find a Chinese voice (prioritize zh-CN, then any zh variant)
            this.chineseVoice = voices.find(voice => voice.lang.startsWith('zh-CN')) ||
                                voices.find(voice => voice.lang.startsWith('zh')) ||
                                voices.find(voice => voice.lang.includes('Chinese')) ||
                                voices[0]; // Fallback to first available voice

            console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));
            if (this.chineseVoice) {
                console.log('Selected voice:', this.chineseVoice.name, this.chineseVoice.lang);
            }
        };

        // Load voices (some browsers load asynchronously)
        loadVoices();
        if (this.speechSynth.onvoiceschanged !== undefined) {
            this.speechSynth.onvoiceschanged = loadVoices;
        }
    }

    // Play sound for current character
    playSound() {
        if (!this.speechSynth || !this.currentChar) return;

        // Cancel any ongoing speech
        this.speechSynth.cancel();

        // Create utterance with the Chinese character
        const utterance = new SpeechSynthesisUtterance(this.currentChar.character);

        // Set language to Chinese
        utterance.lang = 'zh-CN';

        // Use Chinese voice if available
        if (this.chineseVoice) {
            utterance.voice = this.chineseVoice;
        }

        // Adjust speech parameters for better clarity
        utterance.rate = 0.8;  // Slightly slower for learning
        utterance.pitch = 1;
        utterance.volume = 1;

        // Speak
        this.speechSynth.speak(utterance);
    }

    async init() {
        await this.loadCharacters();
        this.setupCanvas();
        this.setupEventListeners();
        this.setupDebugModal();
        this.loadChineseVoice();

        // Initialize set for FocusedSetsAlgorithm
        if (this.algorithm.name === 'Focused Sets' && this.algorithm.initializeSet) {
            const initialSetIndices = this.algorithm.initializeSet(this.characters, this.userProgress);

            // Add initial cards to userProgress
            const now = Date.now();
            for (const index of initialSetIndices) {
                if (!this.userProgress[index]) {
                    this.userProgress[index] = {
                        character: this.characters[index].character,
                        firstSeen: now,
                        reviewCount: 0,
                        successCount: 0,
                        successRate: 0,
                        lastDifficulty: null,
                        lastSeen: now,
                        nextReview: now,
                        interval: 1000,
                        history: [],
                        consecutiveGood: 0,
                        wasUnmastered: false,
                        masteredAt: null,
                        inBucket: false,
                        inSet: true,
                        setEntryScore: 0,
                        score: 0
                    };
                }
            }

            if (initialSetIndices.length > 0) {
                this.saveProgress();
                console.log(`Initialized set with ${initialSetIndices.length} cards`);
            }
        }

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

            // Start a new stroke
            this.currentStroke = [{x, y}];

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

            // Add point to current stroke
            this.currentStroke.push({x, y});

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
        // Clear strokes array
        this.strokes = [];
        this.currentStroke = [];
        this.updateUndoButton();

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw guide lines
        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 1;

        if (this.charCount === 2) {
            // For 2 characters: draw guide lines for each half
            const halfWidth = this.canvas.width / 2;

            // Left character guides
            this.ctx.beginPath();
            this.ctx.moveTo(halfWidth / 2, 0);
            this.ctx.lineTo(halfWidth / 2, this.canvas.height);
            this.ctx.moveTo(0, this.canvas.height / 2);
            this.ctx.lineTo(halfWidth, this.canvas.height / 2);
            this.ctx.stroke();

            // Left diagonal guides
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(halfWidth, this.canvas.height);
            this.ctx.moveTo(halfWidth, 0);
            this.ctx.lineTo(0, this.canvas.height);
            this.ctx.stroke();

            // Right character guides
            this.ctx.beginPath();
            this.ctx.moveTo(halfWidth + halfWidth / 2, 0);
            this.ctx.lineTo(halfWidth + halfWidth / 2, this.canvas.height);
            this.ctx.moveTo(halfWidth, this.canvas.height / 2);
            this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
            this.ctx.stroke();

            // Right diagonal guides
            this.ctx.beginPath();
            this.ctx.moveTo(halfWidth, 0);
            this.ctx.lineTo(this.canvas.width, this.canvas.height);
            this.ctx.moveTo(this.canvas.width, 0);
            this.ctx.lineTo(halfWidth, this.canvas.height);
            this.ctx.stroke();

            // Subtle vertical divider
            this.ctx.strokeStyle = '#e5e5e5';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(halfWidth, 0);
            this.ctx.lineTo(halfWidth, this.canvas.height);
            this.ctx.stroke();
            this.ctx.strokeStyle = '#ddd';
            this.ctx.lineWidth = 1;
        } else {
            // For 1 character: draw centered guides (same as before)
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
        }

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

        // Start a new stroke
        this.currentStroke = [{x, y}];

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

        // Add point to current stroke
        this.currentStroke.push({x, y});

        // Use quadratic curves for smoother lines
        const midX = (this.lastX + x) / 2;
        const midY = (this.lastY + y) / 2;

        this.ctx.quadraticCurveTo(this.lastX, this.lastY, midX, midY);
        this.ctx.stroke();

        this.lastX = x;
        this.lastY = y;
    }

    stopDrawing() {
        if (this.isDrawing && this.currentStroke.length > 0) {
            // Save the completed stroke
            this.strokes.push([...this.currentStroke]);
            this.currentStroke = [];
            this.updateUndoButton();
        }
        this.isDrawing = false;
    }

    undo() {
        if (this.strokes.length === 0) return;

        // Remove the last stroke
        this.strokes.pop();

        // Redraw all remaining strokes
        this.redrawStrokes();

        // Update undo button state
        this.updateUndoButton();
    }

    redrawStrokes() {
        // Clear the canvas completely
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Redraw guide lines
        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 1;

        if (this.charCount === 2) {
            // For 2 characters: draw guide lines for each half
            const halfWidth = this.canvas.width / 2;

            // Left character guides
            this.ctx.beginPath();
            this.ctx.moveTo(halfWidth / 2, 0);
            this.ctx.lineTo(halfWidth / 2, this.canvas.height);
            this.ctx.moveTo(0, this.canvas.height / 2);
            this.ctx.lineTo(halfWidth, this.canvas.height / 2);
            this.ctx.stroke();

            // Left diagonal guides
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(halfWidth, this.canvas.height);
            this.ctx.moveTo(halfWidth, 0);
            this.ctx.lineTo(0, this.canvas.height);
            this.ctx.stroke();

            // Right character guides
            this.ctx.beginPath();
            this.ctx.moveTo(halfWidth + halfWidth / 2, 0);
            this.ctx.lineTo(halfWidth + halfWidth / 2, this.canvas.height);
            this.ctx.moveTo(halfWidth, this.canvas.height / 2);
            this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
            this.ctx.stroke();

            // Right diagonal guides
            this.ctx.beginPath();
            this.ctx.moveTo(halfWidth, 0);
            this.ctx.lineTo(this.canvas.width, this.canvas.height);
            this.ctx.moveTo(this.canvas.width, 0);
            this.ctx.lineTo(halfWidth, this.canvas.height);
            this.ctx.stroke();

            // Subtle vertical divider
            this.ctx.strokeStyle = '#e5e5e5';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(halfWidth, 0);
            this.ctx.lineTo(halfWidth, this.canvas.height);
            this.ctx.stroke();
            this.ctx.strokeStyle = '#ddd';
            this.ctx.lineWidth = 1;
        } else {
            // For 1 character: draw centered guides
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
        }

        // Draw border
        this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);

        // Reset drawing style for calligraphy
        this.ctx.strokeStyle = '#2d3748';
        this.ctx.lineWidth = 10;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // Redraw all strokes
        for (const stroke of this.strokes) {
            if (stroke.length === 0) continue;

            this.ctx.beginPath();
            this.ctx.moveTo(stroke[0].x, stroke[0].y);

            for (let i = 1; i < stroke.length; i++) {
                const prevPoint = stroke[i - 1];
                const currPoint = stroke[i];
                const midX = (prevPoint.x + currPoint.x) / 2;
                const midY = (prevPoint.y + currPoint.y) / 2;

                this.ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, midX, midY);
            }

            this.ctx.stroke();
        }
    }

    updateUndoButton() {
        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) {
            undoBtn.disabled = this.strokes.length === 0;
        }
    }

    setupEventListeners() {
        // Clear button
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearCanvas();
        });

        // Undo button
        document.getElementById('undoBtn').addEventListener('click', () => {
            this.undo();
        });

        // Sound button
        document.getElementById('soundBtn').addEventListener('click', () => {
            this.playSound();
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

        // Detect if character field contains 1 or 2 characters
        this.charCount = this.currentChar.character.length;

        // Adjust canvas dimensions based on character count
        if (this.charCount === 1) {
            // Square canvas for 1 character
            this.canvas.width = 300;
            this.canvas.height = 300;
        } else {
            // Rectangular canvas for 2 characters
            this.canvas.width = 600;
            this.canvas.height = 300;
        }

        // Reset drawing style after canvas resize (resizing resets context)
        this.ctx.lineWidth = 10;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = '#2d3748';
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';

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

        // Play sound (autoplay - may fail on iOS/mobile without user interaction)
        setTimeout(() => {
            this.playSound();
        }, 300);

        // Force scroll to the top
        setTimeout(() => {
            this.smoothScrollTo(0);
        }, 100);
    }

    showAnswer() {
        if (!this.currentChar) return;

        const answerContainer = document.getElementById('answerContainer');
        const difficultySection = document.getElementById('difficultySection');
        const gif1 = document.getElementById('strokeGif1');
        const gif2 = document.getElementById('strokeGif2');

        const chars = this.currentChar.character.split('');

        if (chars.length === 1) {
            // Single character: show only first GIF
            gif1.src = `img/${chars[0]}.gif`;
            gif1.classList.remove('hidden');
            gif2.classList.add('hidden');

            // Set single character as canvas background
            this.setCanvasBackground(`img/${chars[0]}.gif`, 0);
        } else if (chars.length === 2) {
            // Two characters: show both GIFs
            gif1.src = `img/${chars[0]}.gif`;
            gif2.src = `img/${chars[1]}.gif`;
            gif1.classList.remove('hidden');
            gif2.classList.remove('hidden');

            // Set both characters as canvas backgrounds
            this.setCanvasBackground(`img/${chars[0]}.gif`, 0);
            this.setCanvasBackground(`img/${chars[1]}.gif`, 1);
        }

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

            // Initialize score for FocusedSetsAlgorithm
            let initialScore = 0;
            if (this.algorithm.name === 'Focused Sets' && this.algorithm.config) {
                initialScore = this.algorithm.config.initialScore;
            }

            const isAddingToSet = this.currentResult && this.currentResult.addToSet;

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
                inBucket: this.currentResult && this.currentResult.addToBucket ? true : false,
                // Set tracking (for FocusedSetsAlgorithm)
                inSet: isAddingToSet,
                setEntryScore: isAddingToSet ? initialScore : undefined,
                // Score tracking (for FocusedSetsAlgorithm)
                score: initialScore
            };

            // Update score for FocusedSetsAlgorithm
            if (this.algorithm.name === 'Focused Sets' && this.algorithm.updateScore) {
                this.userProgress[index].score = this.algorithm.updateScore(initialScore, difficulty);

                if (this.userProgress[index].inSet) {
                    console.log(`Card ${this.currentChar.character} added to set! Entry score: ${this.userProgress[index].setEntryScore}, New score: ${this.userProgress[index].score}`);
                }
            }
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

            // Update score for FocusedSetsAlgorithm
            if (this.algorithm.name === 'Focused Sets' && this.algorithm.updateScore) {
                const currentScore = progress.score !== undefined ? progress.score : this.algorithm.config.initialScore;
                const oldScore = currentScore;
                progress.score = this.algorithm.updateScore(currentScore, difficulty);

                // Check if this card is being added to the set
                if (this.currentResult && this.currentResult.addToSet && !progress.inSet) {
                    progress.inSet = true;
                    progress.setEntryScore = oldScore; // Track score when entering set
                    console.log(`Card ${this.currentChar.character} added to set! Entry score: ${progress.setEntryScore}`);
                }

                // Remove from set if score became lower than entry score (card got easier)
                if (progress.inSet && progress.setEntryScore !== undefined) {
                    if (progress.score < progress.setEntryScore) {
                        progress.inSet = false;
                        console.log(`Card ${this.currentChar.character} graduated from set! Score improved from ${progress.setEntryScore} to ${progress.score}`);

                        // Immediately backfill the set with a new card
                        this.backfillSet();
                    }
                }
            }
        }

        // Update stats
        this.algorithmState.todayReviews++;

        this.saveProgress();
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

    setCanvasBackground(gifSrc, charPosition = 0) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

            this.clearCanvas();

            this.ctx.globalAlpha = 0.3;

            if (this.charCount === 2) {
                // For 2 characters: position in left or right half
                const halfWidth = this.canvas.width / 2;
                const scale = Math.min(
                    halfWidth / img.width,
                    this.canvas.height / img.height
                );
                const width = img.width * scale;
                const height = img.height * scale;

                // Calculate x position based on character position (0 = left, 1 = right)
                const xOffset = charPosition === 0 ? 0 : halfWidth;
                const x = xOffset + (halfWidth - width) / 2;
                const y = (this.canvas.height - height) / 2;

                this.ctx.drawImage(img, x, y, width, height);
            } else {
                // For 1 character: center it
                const scale = Math.min(
                    this.canvas.width / img.width,
                    this.canvas.height / img.height
                );
                const width = img.width * scale;
                const height = img.height * scale;
                const x = (this.canvas.width - width) / 2;
                const y = (this.canvas.height - height) / 2;

                this.ctx.drawImage(img, x, y, width, height);
            }

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

    backfillSet() {
        // Only for Focused Sets algorithm
        if (this.algorithm.name !== 'Focused Sets') return;

        // Find candidates to add to set (cards not currently in set)
        const candidates = [];
        for (let i = 0; i < this.characters.length; i++) {
            const progress = this.userProgress[i];

            // Skip if already in set
            if (progress && progress.inSet === true) continue;

            const score = this.algorithm.getCardScore(progress);
            candidates.push({
                char: this.characters[i],
                index: i,
                score: score
            });
        }

        // Add a new card to set using weighted selection
        if (candidates.length > 0) {
            const selected = this.algorithm.weightedRandomSelect(candidates, item => item.score);
            const now = Date.now();

            // Create or update progress for the new card
            if (!this.userProgress[selected.index]) {
                this.userProgress[selected.index] = {
                    character: this.characters[selected.index].character,
                    firstSeen: now,
                    reviewCount: 0,
                    successCount: 0,
                    successRate: 0,
                    lastDifficulty: null,
                    lastSeen: now,
                    nextReview: now,
                    interval: 1000,
                    history: [],
                    consecutiveGood: 0,
                    wasUnmastered: false,
                    masteredAt: null,
                    inBucket: false,
                    inSet: true,
                    setEntryScore: selected.score,
                    score: selected.score
                };
            } else {
                // Card already exists, just add to set
                this.userProgress[selected.index].inSet = true;
                this.userProgress[selected.index].setEntryScore = selected.score;
            }

            this.saveProgress();
            console.log(`Backfilled set with card: ${this.characters[selected.index].character} (entry score: ${selected.score})`);
        }
    }

    saveProgress() {
        localStorage.setItem('chineseCharProgress', JSON.stringify(this.userProgress));
    }

    loadProgress() {
        const saved = localStorage.getItem('chineseCharProgress');
        return saved ? JSON.parse(saved) : {};
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

        // Get set info for FocusedSetsAlgorithm
        if (this.algorithm.name === 'Focused Sets') {
            const setCards = this.algorithm.getActiveSet(this.userProgress);

            bucketInfo = `
                <div class="debug-info-row">
                    <span>Active Set:</span> <strong>${setCards.length} / ${this.algorithm.config.setSize}</strong>
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

            // Check status for FocusedSetsAlgorithm
            let scoreInfo = '';
            if (this.algorithm.name === 'Focused Sets' && progress) {
                const score = progress.score !== undefined ? progress.score : 0;
                const displayScore = -score; // Flip sign for display
                const inSet = progress.inSet ? 'Yes' : 'No';
                const entryScore = progress.setEntryScore !== undefined ? progress.setEntryScore : 'N/A';
                const displayEntryScore = progress.setEntryScore !== undefined ? -progress.setEntryScore : 'N/A';

                scoreInfo = `
                    <div class="debug-info-row">
                        <span>Score:</span> <strong style="color: ${score > 3 ? '#ef4444' : score > 0 ? '#f59e0b' : '#10b981'};">${displayScore}</strong>
                    </div>
                    <div class="debug-info-row">
                        <span>In Set:</span> <strong>${inSet}</strong>
                    </div>
                    ${progress.setEntryScore !== undefined ? `
                        <div class="debug-info-row">
                            <span>Entry Score:</span> <strong>${displayEntryScore}</strong>
                        </div>
                    ` : ''}
                `;
            }

            currentCard.innerHTML = `
                <div class="debug-card-info">
                    <span class="debug-char">${this.currentChar.character}</span>
                    <span>${this.currentChar.pinyin}</span>
                    <span class="debug-small">${this.currentChar.definition}</span>
                </div>
                ${progress ? `
                    ${masteryStatus ? `<div class="debug-info-row"><span>Status:</span> ${masteryStatus}</div>` : ''}
                    ${scoreInfo}
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

        // Show set contents if using FocusedSetsAlgorithm
        if (this.algorithm.name === 'Focused Sets') {
            const setCards = this.algorithm.getActiveSet(this.userProgress);

            html += '<h4 style="margin-bottom: 10px; color: #667eea;">Active Set Cards:</h4>';

            if (setCards.length === 0) {
                html += '<div style="padding: 10px; color: #999; font-style: italic;">Set is empty</div>';
            } else {
                // Sort by score (highest first - needs most practice)
                setCards.sort((a, b) => b.score - a.score);

                html += setCards.map((item, idx) => {
                    const char = this.characters[item.index];
                    const progress = item.progress;

                    const score = item.score;
                    const displayScore = -score; // Flip sign for display
                    const scoreColor = score > 3 ? '#ef4444' : score > 0 ? '#f59e0b' : '#10b981';
                    const scoreBadge = `<span style="background: ${scoreColor}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">Score: ${displayScore}</span>`;

                    return `
                        <div class="debug-upcoming-card" style="background: rgba(102, 126, 234, 0.05); border-left: 3px solid #667eea;">
                            <span class="debug-upcoming-number">${idx + 1}.</span>
                            <span class="debug-char-small">${char.character}</span>
                            <span class="debug-pinyin">${char.pinyin}</span>
                            <span class="debug-stats">
                                ${progress.reviewCount} reviews | ${scoreBadge}
                            </span>
                        </div>
                    `;
                }).join('');
            }

            html += '<h4 style="margin: 20px 0 10px; color: #667eea;">All Cards (Sorted by Score):</h4>';

            // Show all cards sorted by score
            const allCards = [];
            for (let i = 0; i < this.characters.length; i++) {
                const progress = this.userProgress[i];
                const score = this.algorithm.getCardScore(progress);
                const inSet = progress && progress.inSet;
                allCards.push({
                    char: this.characters[i],
                    index: i,
                    score: score,
                    progress: progress,
                    inSet: inSet
                });
            }

            // Sort by score (highest first)
            allCards.sort((a, b) => b.score - a.score);

            html += '<div style="max-height: 400px; overflow-y: auto;">';
            html += allCards.map((item, idx) => {
                const score = item.score;
                const displayScore = -score; // Flip sign for display
                const scoreColor = score > 3 ? '#ef4444' : score > 0 ? '#f59e0b' : '#10b981';

                let badges = '';
                if (item.inSet) {
                    badges += '<span style="background: #667eea; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 4px;">IN SET</span>';
                }
                if (!item.progress) {
                    badges += '<span style="background: #9ca3af; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 4px;">NEW</span>';
                }

                return `
                    <div class="debug-upcoming-card" style="padding: 4px 8px;">
                        <span class="debug-upcoming-number">${idx + 1}.</span>
                        <span class="debug-char-small">${item.char.character}</span>
                        <span class="debug-pinyin" style="font-size: 12px;">${item.char.pinyin}</span>
                        <span class="debug-stats" style="font-size: 11px;">
                            <span style="background: ${scoreColor}; color: white; padding: 2px 6px; border-radius: 4px;">Score: ${displayScore}</span>
                            ${item.progress ? `${item.progress.reviewCount} reviews` : '0 reviews'}
                            ${badges}
                        </span>
                    </div>
                `;
            }).join('');
            html += '</div>';

            upcomingDiv.innerHTML = html;
            return; // Exit early for Focused Sets
        }

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