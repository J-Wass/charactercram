# Character Cram - Chinese Character Learning App

A modern, interactive web application for learning Chinese character stroke order and writing practice with spaced repetition.

## Features

### 🖋️ **Character Writing Practice**
- **Interactive Canvas**: Draw Chinese characters with calligraphy-style brush (thick, smooth strokes)
- **Touch Support**: Works on both desktop (mouse) and mobile (touch) devices
- **Stroke Order GIFs**: Animated demonstrations showing correct character formation
- **Background Reference**: First frame of stroke order appears as background guide after showing answer

### 🧠 **Spaced Repetition Learning**
- **Intelligent Algorithm**: Characters you struggle with appear more frequently
- **5-Level Difficulty Rating**: Rate each character from Very Hard (1) to Very Easy (5)
- **Progress Tracking**: Track mastery levels and average scores across difficulty tiers
- **Smart Weighting**: Recently mastered characters appear less frequently

### 📊 **Progress Analytics**
- **5 Difficulty Levels**: Novice (10), Beginner (25), Intermediate (100), Advanced (1000), Master (9900+ chars)
- **Visual Progress**: Color-coded level indicators show completion status
- **Average Scoring**: See your performance across each difficulty tier
- **Persistent Storage**: Progress saved locally in browser

### ⌨️ **Desktop Keyboard Shortcuts**
- **Spacebar**: Show answer (stroke order animation)
- **1-5 Keys**: Rate difficulty (1=Very Hard, 5=Very Easy)
- **Visual Hints**: Tooltips and hotkey indicators on buttons

### 🎨 **Modern UI/UX**
- **Responsive Design**: Adapts to desktop and mobile screens
- **Level-Specific Themes**: Each difficulty level has unique color scheme
- **Toast Notifications**: Colored confirmation when rating characters
- **Smooth Animations**: Polished interactions throughout

### 📱 **Mobile Optimized**
- **Touch Drawing**: Natural finger/stylus input on canvas
- **Responsive Layout**: Optimized button sizes and layout for mobile
- **PWA Ready**: Can be added to home screen for app-like experience

## Quick Start

### Online Demo
Visit: [Character Cram](https://j-wass.github.io/charactercram/)

### Local Development
1. Clone the repository:
   ```bash
   git clone https://github.com/J-Wass/charactercram.git
   cd charactercram
   ```

2. Start a local server:
   ```bash
   python -m http.server 3000
   ```

3. Open http://localhost:3000 in your browser

## How to Use

1. **Select Difficulty Level**: Choose from Novice to Master based on your Chinese proficiency
2. **Read the Prompt**: Study the pinyin pronunciation and English definition
3. **Draw the Character**: Use mouse or finger to write the character on the canvas
4. **Show Answer**: Press spacebar or click "Show Answer" to see the correct stroke order
5. **Rate Difficulty**: Use keys 1-5 or click buttons to rate how difficult the character was
6. **Repeat**: Continue practicing with the spaced repetition algorithm

## Technology Stack

- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+)
- **Canvas API**: For character drawing and stroke order display
- **Local Storage**: For progress persistence
- **Responsive Design**: CSS Grid and Flexbox
- **Touch Events**: Full mobile device support

## File Structure

```
charactercram/
├── index.html          # Main application
├── app.js             # Core application logic
├── style.css          # Styles and responsive design
├── chars_data.js      # Embedded character data (9900+ characters)
├── chars.json         # Raw character data
├── stroke_gifs/       # Stroke order animations (1000+ files)
└── README.md          # This file
```

## Character Data

The app includes 9900+ Chinese characters with:
- **Character**: The Chinese character
- **Pinyin**: Romanized pronunciation
- **Definition**: English meaning
- **Frequency Rank**: Usage frequency in modern Chinese
- **HSK Level**: Chinese proficiency test classification

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Stroke order GIFs sourced from stroke order databases
- Character frequency data from modern Chinese text corpora
- HSK level classifications from official Chinese proficiency standards

---

**Happy Learning! 加油! 🀄**