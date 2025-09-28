// Spaced Repetition Algorithm Module
// This file contains different SSR algorithms that can be swapped easily

// Base Algorithm Interface
class BaseAlgorithm {
    constructor() {
        this.name = 'Base Algorithm';
        this.config = this.getDefaultConfig();
    }

    getDefaultConfig() {
        return {
            maxNewCardsPerDay: 5,
            maxFailedCardsBeforeNew: 3,
            minCorrectStreakForNew: 2,
            failedCardTimeout: 10 * 60 * 1000, // 10 minutes
            maxInterval: 7 * 24 * 60 * 60 * 1000 // 7 days
        };
    }

    // Must be implemented by subclasses
    getNextCard(characters, userProgress, state) {
        throw new Error('getNextCard must be implemented');
    }

    // Must be implemented by subclasses
    calculateInitialInterval(difficulty) {
        throw new Error('calculateInitialInterval must be implemented');
    }

    // Must be implemented by subclasses
    calculateNextInterval(difficulty, currentInterval, successRate) {
        throw new Error('calculateNextInterval must be implemented');
    }

    // Common helper methods
    isCardFailed(difficulty) {
        return difficulty <= 2;
    }

    isCardCorrect(difficulty) {
        return difficulty >= 3;
    }

    getNewCardsSeenToday(userProgress) {
        const todayStart = new Date().setHours(0, 0, 0, 0);
        let count = 0;

        for (const progress of Object.values(userProgress)) {
            if (progress.firstSeen >= todayStart) {
                count++;
            }
        }

        return count;
    }
}

// Improved SSR Algorithm (Current Implementation)
class ImprovedSSRAlgorithm extends BaseAlgorithm {
    constructor() {
        super();
        this.name = 'Improved SSR';
    }

    getNextCard(characters, userProgress, state) {
        const now = Date.now();

        // Categorize cards
        const failedCards = [];
        const dueCards = [];
        const newCards = [];

        for (let i = 0; i < characters.length; i++) {
            const char = characters[i];
            const progress = userProgress[i];

            if (!progress) {
                newCards.push({ char, index: i, priority: i });
            } else {
                if (state.recentFailedCards.has(i)) {
                    const priority = this.calculateFailedCardPriority(progress, now);
                    failedCards.push({ char, index: i, priority });
                } else if (now >= progress.nextReview) {
                    const priority = this.calculateReviewPriority(progress, now);
                    dueCards.push({ char, index: i, priority });
                }
            }
        }

        // Sort by priority
        failedCards.sort((a, b) => b.priority - a.priority);
        dueCards.sort((a, b) => b.priority - a.priority);

        // Prioritize failed cards
        if (failedCards.length > 0) {
            return failedCards[0];
        }

        // Then due cards
        if (dueCards.length > 0) {
            return dueCards[0];
        }

        // Only introduce new cards if doing well
        const shouldIntroduceNew =
            state.recentFailedCards.size < this.config.maxFailedCardsBeforeNew &&
            state.sessionCorrectStreak >= this.config.minCorrectStreakForNew;

        const newCardsToday = this.getNewCardsSeenToday(userProgress);

        if (newCards.length > 0 &&
            newCardsToday < this.config.maxNewCardsPerDay &&
            shouldIntroduceNew) {
            return newCards[0];
        }

        // Find oldest reviewed card
        let oldestCard = null;
        let oldestTime = now;

        for (let i = 0; i < characters.length; i++) {
            const progress = userProgress[i];
            if (progress && progress.lastSeen < oldestTime) {
                oldestTime = progress.lastSeen;
                oldestCard = { char: characters[i], index: i, priority: 0 };
            }
        }

        return oldestCard || { char: characters[0], index: 0, priority: 0 };
    }

    calculateFailedCardPriority(progress, now) {
        const timeSinceSeen = now - progress.lastSeen;
        let priority = 1000 - (timeSinceSeen / (1000 * 60));

        if (progress.lastDifficulty === 1) {
            priority += 100;
        }

        return Math.max(priority, 0);
    }

    calculateReviewPriority(progress, now) {
        const overdue = now - progress.nextReview;
        const difficulty = progress.lastDifficulty || 3;

        let priority = overdue / (1000 * 60 * 60); // Hours overdue
        priority += (6 - difficulty) * 10;
        priority += (1 - progress.successRate) * 20;

        return priority;
    }

    calculateInitialInterval(difficulty) {
        switch (difficulty) {
            case 1: return 30 * 1000;               // 30 seconds
            case 2: return 2 * 60 * 1000;            // 2 minutes
            case 3: return 15 * 60 * 1000;           // 15 minutes
            case 4: return 4 * 60 * 60 * 1000;       // 4 hours
            case 5: return 24 * 60 * 60 * 1000;      // 1 day
            default: return 15 * 60 * 1000;          // 15 minutes
        }
    }

    calculateNextInterval(difficulty, currentInterval, successRate) {
        let factor;

        switch (difficulty) {
            case 1: return 30 * 1000; // Reset to 30 seconds
            case 2: factor = 1.1; break;
            case 3: factor = 1.3; break;
            case 4: factor = 2.0; break;
            case 5: factor = 3.0; break;
            default: factor = 1.5;
        }

        if (successRate < 0.5) {
            factor *= 0.6;
        } else if (successRate > 0.9) {
            factor *= 1.3;
        }

        const newInterval = Math.min(currentInterval * factor, this.config.maxInterval);
        return Math.max(newInterval, 30 * 1000);
    }
}

// Classic Anki Algorithm
class AnkiAlgorithm extends BaseAlgorithm {
    constructor() {
        super();
        this.name = 'Classic Anki';
        this.config = {
            ...this.getDefaultConfig(),
            maxNewCardsPerDay: 10,
            startingEase: 2.5,
            easyBonus: 1.3,
            intervalModifier: 1.0
        };
    }

    getNextCard(characters, userProgress, state) {
        const now = Date.now();
        const dueCards = [];
        const newCards = [];

        for (let i = 0; i < characters.length; i++) {
            const char = characters[i];
            const progress = userProgress[i];

            if (!progress) {
                newCards.push({ char, index: i, priority: i });
            } else if (now >= progress.nextReview) {
                const overdue = now - progress.nextReview;
                dueCards.push({ char, index: i, priority: overdue });
            }
        }

        // Sort due cards by how overdue they are
        dueCards.sort((a, b) => b.priority - a.priority);

        if (dueCards.length > 0) {
            return dueCards[0];
        }

        const newCardsToday = this.getNewCardsSeenToday(userProgress);
        if (newCards.length > 0 && newCardsToday < this.config.maxNewCardsPerDay) {
            return newCards[0];
        }

        return newCards[0] || { char: characters[0], index: 0, priority: 0 };
    }

    calculateInitialInterval(difficulty) {
        switch (difficulty) {
            case 1: return 1 * 60 * 1000;            // 1 minute
            case 2: return 10 * 60 * 1000;           // 10 minutes
            case 3: return 1 * 24 * 60 * 60 * 1000;  // 1 day
            case 4: return 4 * 24 * 60 * 60 * 1000;  // 4 days
            case 5: return 7 * 24 * 60 * 60 * 1000;  // 7 days
            default: return 1 * 24 * 60 * 60 * 1000;
        }
    }

    calculateNextInterval(difficulty, currentInterval, successRate) {
        if (difficulty === 1) {
            return 1 * 60 * 1000; // Reset to 1 minute
        }

        const ease = this.config.startingEase;
        let factor;

        switch (difficulty) {
            case 2: factor = ease * 0.6; break;
            case 3: factor = ease * 0.8; break;
            case 4: factor = ease; break;
            case 5: factor = ease * this.config.easyBonus; break;
            default: factor = ease;
        }

        return Math.min(currentInterval * factor * this.config.intervalModifier, 365 * 24 * 60 * 60 * 1000);
    }
}

// Aggressive Learning Algorithm (More frequent reviews)
class AggressiveAlgorithm extends BaseAlgorithm {
    constructor() {
        super();
        this.name = 'Aggressive Learning';
        this.config = {
            ...this.getDefaultConfig(),
            maxNewCardsPerDay: 15,
            maxFailedCardsBeforeNew: 5,
            minCorrectStreakForNew: 1
        };
    }

    getNextCard(characters, userProgress, state) {
        // Similar to ImprovedSSR but with more aggressive settings
        return new ImprovedSSRAlgorithm().getNextCard(characters, userProgress, state);
    }

    calculateInitialInterval(difficulty) {
        // Much shorter intervals for aggressive learning
        switch (difficulty) {
            case 1: return 15 * 1000;               // 15 seconds
            case 2: return 1 * 60 * 1000;           // 1 minute
            case 3: return 5 * 60 * 1000;           // 5 minutes
            case 4: return 30 * 60 * 1000;          // 30 minutes
            case 5: return 2 * 60 * 60 * 1000;      // 2 hours
            default: return 5 * 60 * 1000;
        }
    }

    calculateNextInterval(difficulty, currentInterval, successRate) {
        if (difficulty === 1) {
            return 15 * 1000; // Reset to 15 seconds
        }

        // Smaller multiplication factors for more frequent reviews
        const factor = 1 + (difficulty - 1) * 0.25;
        const adjustedFactor = successRate > 0.8 ? factor * 1.2 : factor * 0.8;

        const newInterval = currentInterval * adjustedFactor;
        return Math.min(newInterval, 3 * 24 * 60 * 60 * 1000); // Cap at 3 days
    }
}

// Mastery-Based Algorithm (Session-focused, difficulty-based scheduling)
class MasteryBasedAlgorithm extends BaseAlgorithm {
    constructor() {
        super();
        this.name = 'Mastery Based';
        this.sessionCardsSeen = 0; // Track cards seen in this session
        this.config = {
            failedCardTimeout: 5 * 60 * 1000, // 5 minutes before failed card can be removed from priority
            maxFailedCards: 10, // Maximum failed cards to keep in rotation
            // Difficulty-based scheduling (in number of cards)
            difficultyIntervals: {
                1: { min: 1, max: 3 },    // No Idea: next 1-3 cards
                2: { min: 4, max: 8 },    // Hard: next 4-8 cards
                3: { min: 9, max: 20 },   // Almost: next 9-20 cards
                4: { min: 21, max: 50 },  // Easy: after 21-50 cards
                5: { min: 51, max: 100 }  // Instant: after 51-100 cards
            }
        };
    }

    getMasteryLevel(progress) {
        if (!progress) return 'new';

        const { reviewCount, successRate } = progress;

        // Mastered: 5+ reviews with 80%+ success, or 3+ reviews with 90%+ success
        if ((reviewCount >= 5 && successRate >= 0.8) ||
            (reviewCount >= 3 && successRate >= 0.9)) {
            return 'mastered';
        }

        // Familiar: 3+ reviews with 60%+ success
        if (reviewCount >= 3 && successRate >= 0.6) {
            return 'familiar';
        }

        // Learning: Everything else that's been seen
        if (reviewCount > 0) {
            return 'learning';
        }

        return 'new';
    }

    getNextCard(characters, userProgress, state) {
        // Increment session counter
        this.sessionCardsSeen++;

        // Categorize cards based on when they should be reviewed
        const dueNow = [];      // Cards due at current position
        const dueSoon = [];     // Cards due within next 5 positions
        const dueLater = [];    // Cards due later
        const newCards = [];    // Never seen cards

        for (let i = 0; i < characters.length; i++) {
            const char = characters[i];
            const progress = userProgress[i];

            if (!progress) {
                // New card
                newCards.push({ char, index: i });
                continue;
            }

            // Check if card has a target review position
            if (progress.targetReviewPosition !== undefined) {
                const cardsUntilDue = progress.targetReviewPosition - this.sessionCardsSeen;

                if (cardsUntilDue <= 0) {
                    // Card is due now or overdue
                    dueNow.push({
                        char,
                        index: i,
                        progress,
                        overdue: Math.abs(cardsUntilDue)
                    });
                } else if (cardsUntilDue <= 5) {
                    // Card is due soon
                    dueSoon.push({
                        char,
                        index: i,
                        progress,
                        cardsUntilDue
                    });
                } else {
                    // Card is due later
                    dueLater.push({
                        char,
                        index: i,
                        progress,
                        cardsUntilDue
                    });
                }
            } else {
                // Old data without target position, treat as due
                dueNow.push({
                    char,
                    index: i,
                    progress,
                    overdue: 0
                });
            }
        }

        // Priority 1: Cards that are due now (or overdue)
        if (dueNow.length > 0) {
            // Sort by how overdue they are (most overdue first)
            dueNow.sort((a, b) => b.overdue - a.overdue);

            // For variety, pick from top 3 most overdue
            const topCandidates = dueNow.slice(0, Math.min(3, dueNow.length));
            const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];

            return selected;
        }

        // Priority 2: If no cards are due, introduce a new card
        if (newCards.length > 0 && state.sessionCorrectStreak >= 1) {
            // Pick the first new card (they're already in frequency order)
            return newCards[0];
        }

        // Priority 3: Cards due soon (within 5 reviews)
        if (dueSoon.length > 0) {
            // Pick the one due soonest
            dueSoon.sort((a, b) => a.cardsUntilDue - b.cardsUntilDue);
            return dueSoon[0];
        }

        // Priority 4: If nothing else, pick from cards due later
        if (dueLater.length > 0) {
            // Pick the one due soonest
            dueLater.sort((a, b) => a.cardsUntilDue - b.cardsUntilDue);
            return dueLater[0];
        }

        // Priority 5: New cards even without good streak
        if (newCards.length > 0) {
            return newCards[0];
        }

        // Fallback: return first character
        return { char: characters[0], index: 0 };
    }

    // Calculate when a card should be reviewed based on difficulty
    calculateTargetReviewPosition(difficulty) {
        const interval = this.config.difficultyIntervals[difficulty];
        if (!interval) return this.sessionCardsSeen + 10; // Default fallback

        // Add some randomness within the range
        const range = interval.max - interval.min;
        const offset = interval.min + Math.floor(Math.random() * range);

        return this.sessionCardsSeen + offset;
    }

    // Simplified intervals - not really used for scheduling, just for tracking
    calculateInitialInterval(difficulty) {
        // These are just for record-keeping, not actual scheduling
        return 1000; // 1 second placeholder
    }

    calculateNextInterval(difficulty, currentInterval, successRate) {
        // Not used for scheduling in this algorithm
        return 1000; // 1 second placeholder
    }
}

// Export the algorithms
const ALGORITHMS = {
    improved: ImprovedSSRAlgorithm,
    anki: AnkiAlgorithm,
    aggressive: AggressiveAlgorithm,
    mastery: MasteryBasedAlgorithm
};

// Factory function to create algorithm instances
function createAlgorithm(type = 'mastery') {
    const AlgorithmClass = ALGORITHMS[type] || MasteryBasedAlgorithm;
    return new AlgorithmClass();
}