# Contributing to Virtual Office 3D

Thanks for your interest in contributing! This project is open to everyone — whether you're fixing a typo, adding a feature, or just sharing an idea.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/virtual-office-xyz.git
   cd virtual-office-xyz
   ```
3. **Run** locally:
   ```bash
   npx serve .
   ```
4. Open `http://localhost:3000` in your browser

No build tools, no bundler, no package installation required. The project uses ES modules and loads Three.js from CDN.

## Making Changes

1. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Test in the browser — walk around, interact with objects, check the console for errors
4. Commit with a clear message:
   ```bash
   git commit -m "feat: add new furniture type"
   ```

## Commit Message Convention

We use simple prefixes:

| Prefix | When to use |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `style:` | Visual/CSS changes |
| `refactor:` | Code change that doesn't fix a bug or add a feature |
| `chore:` | Maintenance tasks |

## Project Structure

```
src/
├── engine.js       # Game loop, input, camera, UI — the orchestrator
├── world.js        # Room geometry, furniture, lighting, sky
├── characters.js   # Character models, animation, NPC manager
├── navigation.js   # A* pathfinding, collision detection
├── audio.js        # WebAudio synthesis, beat detection
└── utils.js        # Shared helpers (materials, meshes, sprites)
```

- `index.html` — Entry point with all CSS and HTML structure
- `office.config.js` — User-facing configuration (don't put code logic here)

## What to Contribute

### Good first issues
- Add new furniture types (plants, monitors, lamps)
- Add new character customization options (hair styles, accessories)
- Improve mobile touch controls
- Add new panel content templates
- Translate UI strings

### Bigger features
- Multi-floor support
- Multiplayer via WebRTC
- Custom character upload (GLB/GLTF)
- Theme presets (dark office, bright startup, coworking)
- Sound effects for interactions

## Guidelines

- **No build step** — Keep the project zero-config. Don't add webpack, vite, or any bundler.
- **CDN only** — External dependencies load from CDN (jsdelivr or cdnjs). Don't add `node_modules` dependencies for the app itself.
- **Config-driven** — New features should be controllable from `office.config.js` when possible.
- **Performance** — Keep it running at 60fps. Use instanced meshes for repeated objects. Test on low-end hardware.
- **Vanilla JS** — No frameworks. Plain ES modules.

## Submitting a Pull Request

1. Push your branch to your fork
2. Open a PR against `main`
3. Describe what you changed and why
4. Include a screenshot or screen recording if it's a visual change
5. Make sure the game loads without console errors

## Questions?

Open an [issue](https://github.com/anditorx/virtual-office-xyz/issues) — we're happy to help!

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
