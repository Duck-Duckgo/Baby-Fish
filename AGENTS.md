# AGENTS.md

## Cursor Cloud specific instructions

This is a single-file static HTML project (`index.html`) — a Chinese "Talent Map System" (人才地图系统) front-end prototype.

### Running the app

Serve `index.html` with any static HTTP server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/index.html` in Chrome.

### Key notes

- **No build step, no package manager, no backend.** The entire app is one self-contained HTML file with inline CSS/JS.
- **CDN dependencies** (Tailwind CSS, Font Awesome, Google Fonts) require internet access. Without it, the page renders unstyled.
- **No automated tests exist.** Manual browser testing is the only verification method.
- Form submissions and file uploads are stub implementations (`console.log` only) — nothing is persisted.
