<div align="center">

# 🚇 Mini Metro in JS!

**A minimalist subway layout strategy game.**

[![React](https://img.shields.io/badge/React-19.2.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-Apache%202.0-D22128.svg)](https://opensource.org/licenses/Apache-2.0)

<p align="center">
  <a href="#about">About</a> •
  <a href="#features">Features</a> •
  <a href="#how-to-play">How to Play</a> •
  <a href="#installation">Installation</a> •
  <a href="#roadmap">Roadmap</a>
</p>

</div>

---

## 📖 About

**Metro Mini** is a strategy simulation game where you design the subway map for a rapidly growing city. Draw lines between stations and start your trains running. As new stations open, redraw your lines to keep them efficient. Decide where to use your limited resources. How long can you keep the city moving?

Built entirely with **React** and **HTML5 Canvas**, this project demonstrates a high-performance game loop within a modern web framework, featuring custom pathfinding, procedural generation, and responsive touch controls.

## ✨ Features

### 🎮 Game Modes
| Mode | Description |
| :--- | :--- |
| **Normal** | The classic experience. Redraw lines freely, manage overcrowding, and last as long as possible. |
| **Extreme** | Hardcore challenge. Lines are permanent once drawn. Plan ahead! |
| **Endless** | Zen mode. No overcrowding, just build and optimize your network in peace. |

### 🛠 Mechanics
- **Dynamic Network**: Drag and drop to create lines. Extend them, reroute them, or tear them down (in Normal mode).
- **Procedural Growth**: Stations spawn randomly with increasing frequency. No two games are alike.
- **Passenger Routing**: Autonomous passengers find the best route to their destination shape.
- **Resource Management**: Weekly upgrades grant you new locomotives, lines, tunnels, or carriages.
- **Water Obstacles**: Rivers require tunnels to cross. Manage your tunnel inventory wisely.
- **Visual Feedback**: Real-time overcrowding indicators and animated passenger flows.

### 💻 Tech Stack
- **Core**: React 19 (Hooks for UI, Refs for Game Loop)
- **Language**: TypeScript (Strict typing for game logic)
- **Rendering**: HTML5 Canvas API (Optimized for 60fps)
- **Build**: Vite (Fast HMR and bundling)
- **Styling**: Tailwind CSS (Minimalist UI overlays)

## 🕹 How to Play

1.  **Draw Lines**: Click/Touch and drag from a station to another to create a line.
2.  **Extend**: Drag from the end of a line to a new station to extend it.
3.  **Transport**: Trains will automatically start running. They pick up passengers and drop them off at stations matching their shape.
4.  **Manage**: Keep stations from overcrowding! If a station stays full for too long, the network fails.
5.  **Upgrade**: Every week (in-game time), choose a new asset to help your network grow.

## 🚀 Installation

Clone the repository and install dependencies to run the game locally.

```bash
# Clone the repository
git clone https://github.com/yourusername/metro-mini.git

# Navigate to the project directory
cd metro-mini

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open `http://localhost:3000` in your browser to play.

## 🗺 Roadmap

- [ ] **Creative Mode**: Sandbox environment with unlimited resources.
- [ ] **Interchange Stations**: Large stations with faster loading times.
- [ ] **Sound Effects**: Audio feedback for actions and game events.
- [ ] **Camera Controls**: Zoom and pan support for larger maps.
- [ ] **Local Storage**: Save high scores and ongoing games.

## 📄 License

Distributed under the Apache 2.0 License. See `LICENSE` for more information.

---

<div align="center">

Made with ❤️ and TypeScript

</div>
