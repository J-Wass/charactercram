// Chinese Character Practice App with Spaced Repetition

class ChineseCharacterApp {
    constructor() {
        this.characters = [];
        this.currentLevel = 'level-1';  // Default to first level
        this.isReviewMode = false;
        this.reviewMax = 100;
        this.currentCharIndex = 0;
        this.currentChar = null;
        this.userProgress = this.loadProgress();
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.hasBackground = false;
        
        // Load saved settings
        this.loadSettings();
        
        // Generate level config: 500 levels of 10 chars each
        this.levelConfig = {};
        for (let i = 1; i <= 500; i++) {
            this.levelConfig[`level-${i}`] = {
                start: (i - 1) * 10,
                end: i * 10
            };
        }
        
        this.init();
    }
    
    async init() {
        await this.loadCharacters();
        this.populateLevelDropdown();
        this.restoreUIFromSettings();
        this.setupCanvas();
        this.setupEventListeners();
        this.setupReviewModal();
        this.updateSelectStyling();
        this.updateLevelDropdownMastery();
        this.startNewRound();
    }
    
    restoreUIFromSettings() {
        const levelSelect = document.getElementById('levelSelect');
        const reviewBtn = document.getElementById('reviewBtn');
        
        if (this.isReviewMode) {
            // Hide level selector and show review info
            levelSelect.style.display = 'none';
            this.currentLevel = 'review';
            reviewBtn.textContent = `Exit Review (${this.reviewMax} chars)`;
            reviewBtn.classList.add('review-active');
            
            // Set review input value
            const reviewInput = document.getElementById('reviewInput');
            if (reviewInput) {
                reviewInput.value = this.reviewMax;
            }
        } else {
            // Show level selector and reset review button
            levelSelect.style.display = 'block';
            levelSelect.value = this.currentLevel;
            levelSelect.disabled = false;
            levelSelect.style.opacity = '1';
            reviewBtn.textContent = 'Review Mode';
            reviewBtn.classList.remove('review-active');
        }
    }
    
    populateLevelDropdown() {
        const levelSelect = document.getElementById('levelSelect');
        levelSelect.innerHTML = '';
        
        // Add 500 levels
        for (let i = 1; i <= 500; i++) {
            const option = document.createElement('option');
            option.value = `level-${i}`;
            const start = (i - 1) * 10 + 1;
            const end = i * 10;
            option.textContent = `Level ${i} (${start}-${end})`;
            levelSelect.appendChild(option);
        }
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
    
    setupReviewModal() {
        const reviewBtn = document.getElementById('reviewBtn');
        const reviewModal = document.getElementById('reviewModal');
        const reviewInput = document.getElementById('reviewInput');
        const startReview = document.getElementById('startReview');
        const cancelReview = document.getElementById('cancelReview');

        reviewBtn.addEventListener('click', () => {
            if (this.isReviewMode) {
                // Exit review mode
                this.isReviewMode = false;
                this.currentLevel = 'level-1'; // Return to default level
                this.saveSettings();
                this.restoreUIFromSettings();
                this.updateSelectStyling();
                this.updateLevelDropdownMastery();
                this.startNewRound();
            } else {
                // Enter review mode
                reviewModal.classList.remove('hidden');
                // Focus the input field so user can type immediately
                setTimeout(() => reviewInput.focus(), 100);
            }
        });

        // Add event listeners for preset buttons
        const presetButtons = reviewModal.querySelectorAll('.preset-btn');
        presetButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const value = parseInt(e.target.dataset.value);
                reviewInput.value = value;
            });
        });

        // Validate input on blur (when user finishes typing)
        reviewInput.addEventListener('blur', (e) => {
            let value = parseInt(e.target.value);
            if (isNaN(value) || value < 0) {
                e.target.value = 10;
            } else if (value > 5000) {
                e.target.value = 5000;
            }
        });

        // Allow Enter key to start review
        reviewInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                startReview.click();
            }
        });
        
        startReview.addEventListener('click', () => {
            const value = parseInt(reviewInput.value);
            if (isNaN(value) || value < 0 || value > 5000) {
                reviewInput.value = 100; // Reset to default if invalid
                return;
            }
            this.isReviewMode = true;
            this.reviewMax = value;
            this.currentLevel = 'review';
            reviewModal.classList.add('hidden');

            // Clear review progress to restart fresh
            this.clearReviewProgress();
            
            this.saveSettings(); // Save review mode settings
            
            // Update UI for review mode
            this.restoreUIFromSettings();
            this.updateSelectStyling();
            this.startNewRound();
        });
        
        cancelReview.addEventListener('click', () => {
            reviewModal.classList.add('hidden');
        });
        
        // Click outside modal to close
        reviewModal.addEventListener('click', (e) => {
            if (e.target === reviewModal) {
                reviewModal.classList.add('hidden');
            }
        });
    }
    
    setupEventListeners() {
        // Level selector
        document.getElementById('levelSelect').addEventListener('change', (e) => {
            this.isReviewMode = false;
            this.currentLevel = e.target.value;
            document.getElementById('levelSelect').disabled = false;
            document.getElementById('levelSelect').style.opacity = '1';
            this.saveSettings(); // Save the new level selection
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
            // Don't intercept keyboard shortcuts if user is typing in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

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
        this.updateCardsSeen();
        this.nextCharacter();
    }
    
    getNextCharacter() {
        let levelChars;

        if (this.isReviewMode) {
            // In review mode, use characters from 0 to reviewMax
            levelChars = this.characters.slice(0, Math.min(this.reviewMax, this.characters.length));
        } else {
            // Regular level mode
            const levelInfo = this.levelConfig[this.currentLevel];
            levelChars = this.characters.slice(levelInfo.start, Math.min(levelInfo.end, this.characters.length));
        }

        if (levelChars.length === 0) return null;
        
        // Use spaced repetition algorithm
        const weights = levelChars.map((char, index) => {
            const actualIndex = this.isReviewMode ? index : index;
            const key = this.isReviewMode ? `review_${actualIndex}` : `${this.currentLevel}_${index}`;
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
        
        // Update cards seen and average score
        this.updateCardsSeen();
        this.updateAverageScore();
        this.updateLevelDropdownMastery();

        // Force scroll to the top so we can see the question
        setTimeout(() => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }, 100);
    }
    
    showAnswer() {
        if (!this.currentChar) return;
        
        const answerContainer = document.getElementById('answerContainer');
        const difficultySection = document.getElementById('difficultySection');
        const canvasControls = document.querySelector('.canvas-controls');
        const gif = document.getElementById('strokeGif');
        
        // Set the GIF source
        gif.src = `img/${this.currentChar.character}.gif`;
        
        // Extract first frame and set as canvas background
        this.setCanvasBackground(`img/${this.currentChar.character}.gif`);
        
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
        
        const key = this.isReviewMode ? `review_${this.currentCharIndex}` : `${this.currentLevel}_${this.currentCharIndex}`;
        
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
            const recentHistory = progress.history.slice(-3); // Last 3 attempts
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
    
    updateCardsSeen() {
        let maxChars, startIdx;

        if (this.isReviewMode) {
            maxChars = Math.min(this.reviewMax, this.characters.length);
            startIdx = 0;
        } else if (this.levelConfig[this.currentLevel]) {
            const levelInfo = this.levelConfig[this.currentLevel];
            maxChars = levelInfo.end - levelInfo.start;
            startIdx = levelInfo.start;
        } else {
            return; // Invalid level
        }

        let seenCount = 0;

        for (let i = 0; i < maxChars; i++) {
            const actualIdx = this.isReviewMode ? i : i;
            const key = this.isReviewMode ? `review_${actualIdx}` : `${this.currentLevel}_${i}`;
            const progress = this.userProgress[key];

            // Count character as seen if it has been attempted at least once
            if (progress && progress.count > 0) {
                seenCount++;
            }
        }

        const cardsText = seenCount === 1 && maxChars === 1 ? 'card' : 'cards';
        document.getElementById('cardsSeen').textContent = `${seenCount}/${maxChars} ${cardsText} seen`;
    }
    
    updateAverageScore() {
        let maxChars, startIdx;

        if (this.isReviewMode) {
            maxChars = Math.min(this.reviewMax, this.characters.length);
            startIdx = 0;
        } else if (this.levelConfig[this.currentLevel]) {
            const levelInfo = this.levelConfig[this.currentLevel];
            maxChars = levelInfo.end - levelInfo.start;
            startIdx = levelInfo.start;
        } else {
            return; // Invalid level
        }

        let totalScore = 0;
        let attemptedCount = 0;

        for (let i = 0; i < maxChars; i++) {
            const actualIdx = this.isReviewMode ? i : i;
            const key = this.isReviewMode ? `review_${actualIdx}` : `${this.currentLevel}_${i}`;
            const progress = this.userProgress[key];

            if (progress && progress.count > 0) {
                // For review mode, calculate average of all individual difficulty scores
                if (this.isReviewMode && progress.history && progress.history.length > 0) {
                    // Average all individual attempts (1,2,3,4,5)
                    const individualAvg = progress.history.reduce((sum, score) => sum + score, 0) / progress.history.length;
                    totalScore += individualAvg;
                } else {
                    // Regular mode: use current difficulty rating
                    totalScore += progress.difficulty;
                }
                attemptedCount++;
            }
        }

        if (attemptedCount > 0) {
            const avgScore = totalScore / attemptedCount;
            const grade = this.scoreToGrade(avgScore);
            if (this.isReviewMode) {
                // Show number of characters actually seen, not total possible
                document.getElementById('avgScore').textContent = `Avg: ${avgScore.toFixed(1)}/5 (${grade})`;
            } else {
                // Only show grade if all cards have been seen
                if (attemptedCount === maxChars) {
                    document.getElementById('avgScore').textContent = `Avg: ${avgScore.toFixed(1)}/5 (${grade})`;
                } else {
                    document.getElementById('avgScore').textContent = `Avg: ${avgScore.toFixed(1)}/5`;
                }
            }
        } else {
            if (this.isReviewMode) {
                document.getElementById('avgScore').textContent = `Avg: -`;
            } else {
                document.getElementById('avgScore').textContent = 'Avg: -';
            }
        }
    }
    
    getAverageScoreForLevel(level) {
        if (!this.levelConfig[level]) return { score: 0, seenCount: 0, totalCount: 0 };

        const levelInfo = this.levelConfig[level];
        const maxChars = levelInfo.end - levelInfo.start;
        let totalScore = 0;
        let attemptedCount = 0;

        for (let i = 0; i < maxChars; i++) {
            const key = `${level}_${i}`;
            const progress = this.userProgress[key];

            if (progress && progress.count > 0) {
                // Use difficulty directly as score (1=Very Hard to 5=Very Easy)
                totalScore += progress.difficulty;
                attemptedCount++;
            }
        }

        return {
            score: attemptedCount > 0 ? totalScore / attemptedCount : 0,
            seenCount: attemptedCount,
            totalCount: maxChars
        };
    }
    
    getLevelColors(level) {
        if (this.isReviewMode) {
            // Review mode: rainbow gradient
            return {
                primary: '#667eea',
                secondary: '#764ba2',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)'
            };
        }
        
        // Extract level number for color calculation
        const levelNum = parseInt(level.replace('level-', ''));
        
        // Blend from blue (1) to purple (250) to red (500)
        let hue;
        if (levelNum <= 250) {
            // Blue to purple: 240° to 280°
            hue = 240 + (levelNum / 250) * 40;
        } else {
            // Purple to red: 280° to 0°
            hue = 280 + ((levelNum - 250) / 250) * 80;
            if (hue >= 360) hue -= 360;
        }
        
        const saturation = 60;
        const lightness = 55;
        
        return {
            primary: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
            secondary: `hsl(${hue}, ${saturation}%, ${lightness - 10}%)`,
            background: `linear-gradient(135deg, hsl(${hue}, ${saturation - 20}%, ${lightness + 25}%) 0%, hsl(${hue}, ${saturation - 10}%, ${lightness + 15}%) 100%)`
        };
    }
    
    updateSelectStyling() {
        const levelSelect = document.getElementById('levelSelect');
        const container = document.querySelector('.container');
        const body = document.body;
        const promptInfo = document.querySelector('.prompt-info');
        const buttons = document.querySelectorAll('.btn-primary');
        
        const colors = this.getLevelColors(this.currentLevel);
        
        // Update level select styling
        levelSelect.style.background = `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`;
        levelSelect.style.borderColor = colors.primary;
        
        // Update body background
        body.style.background = colors.background;
        
        // Update prompt info background
        if (promptInfo) {
            promptInfo.style.background = `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`;
        }
        
        // Update primary buttons
        buttons.forEach(button => {
            button.style.background = `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`;
            button.onmouseenter = () => {
                button.style.boxShadow = `0 5px 15px ${colors.primary}40`;
            };
            button.onmouseleave = () => {
                button.style.boxShadow = 'none';
            };
        });
        
        // Update review button if in review mode
        const reviewBtn = document.getElementById('reviewBtn');
        if (this.isReviewMode && reviewBtn) {
            reviewBtn.style.background = colors.background;
            reviewBtn.style.borderColor = colors.primary;
        }
    }
    
    scoreToGrade(score) {
        if (score >= 4.7) return 'A+';
        if (score >= 4.3) return 'A';
        if (score >= 4.0) return 'A-';
        if (score >= 3.7) return 'B+';
        if (score >= 3.3) return 'B';
        if (score >= 3.0) return 'B-';
        if (score >= 2.7) return 'C+';
        if (score >= 2.3) return 'C';
        if (score >= 2.0) return 'C-';
        if (score >= 1.7) return 'D+';
        if (score >= 1.3) return 'D';
        if (score >= 1.0) return 'D-';
        return 'F';
    }
    
    updateLevelDropdownMastery() {
        const levelSelect = document.getElementById('levelSelect');

        // Skip update if in review mode (dropdown is hidden)
        if (this.isReviewMode) return;

        // Update scores for each option
        for (let i = 0; i < levelSelect.options.length; i++) {
            const option = levelSelect.options[i];
            const levelValue = option.value;
            const levelStats = this.getAverageScoreForLevel(levelValue);

            const levelNum = i + 1;
            const start = i * 10 + 1;
            const end = (i + 1) * 10;

            if (levelStats.score > 0) {
                // Only show grade if all cards have been seen
                if (levelStats.seenCount === levelStats.totalCount) {
                    const grade = this.scoreToGrade(levelStats.score);
                    option.textContent = `Level ${levelNum} (${grade})`;

                    // Color based on score
                    const fillPercent = Math.round((levelStats.score / 5) * 100);
                    const hue = fillPercent * 1.2; // 0-120 (red to green)
                    const color = `hsl(${hue}, 50%, 50%)`;
                    option.style.background = `linear-gradient(to right, ${color} ${fillPercent}%, #f3f4f6 ${fillPercent}%)`;
                } else {
                    // Show progress without grade
                    option.textContent = `Level ${levelNum} (${levelStats.seenCount}/${levelStats.totalCount})`;

                    // Color based on progress
                    const progressPercent = Math.round((levelStats.seenCount / levelStats.totalCount) * 100);
                    option.style.background = `linear-gradient(to right, #cbd5e0 ${progressPercent}%, #f3f4f6 ${progressPercent}%)`;
                }
            } else {
                option.textContent = `Level ${levelNum}`;
                option.style.background = '#f3f4f6';
            }
        }
    }
    
    saveProgress() {
        localStorage.setItem('chineseCharProgress', JSON.stringify(this.userProgress));
    }
    
    loadProgress() {
        const saved = localStorage.getItem('chineseCharProgress');
        return saved ? JSON.parse(saved) : {};
    }
    
    saveSettings() {
        const settings = {
            currentLevel: this.currentLevel,
            isReviewMode: this.isReviewMode,
            reviewMax: this.reviewMax
        };
        localStorage.setItem('chineseCharSettings', JSON.stringify(settings));
    }
    
    loadSettings() {
        const saved = localStorage.getItem('chineseCharSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            this.currentLevel = settings.currentLevel || 'level-1';
            this.isReviewMode = settings.isReviewMode || false;
            this.reviewMax = settings.reviewMax || 100;
        }
    }
    
    clearReviewProgress() {
        // Remove all review progress entries
        const keysToDelete = [];
        for (const key in this.userProgress) {
            if (key.startsWith('review_')) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => {
            delete this.userProgress[key];
        });
        
        // Save the updated progress
        this.saveProgress();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new ChineseCharacterApp();
});