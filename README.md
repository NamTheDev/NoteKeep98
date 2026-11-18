# NoteKeep 98

A Windows 95/98-inspired, **local-first Google Keep-style notes app**, written in **TypeScript**, served and bundled using **Bun.js**. No React, Vite, runtime dependencies, backend database or account required.

This is an independent recreation. It is **not** Google Keep and does not synchronize with Google or other devices.

## Run with Bun

Requires [Bun](https://bun.sh/) 1.1+.

```bash
bun install
bun run dev
```

Open **http://localhost:3000** in your browser. The development server recompiles TypeScript on page loads and restarts automatically when `server.ts` changes. Refresh to see CSS or TypeScript edits.

### Build for production

```bash
bun run typecheck
bun run build
NODE_ENV=production bun run start
```

The build generates `dist/index.html`, `dist/app.js` and `dist/style.css`. Bun serves these files on port `3000`. To change the port:

```bash
PORT=4321 bun run dev
```

A **standalone HTML preview** is also provided with the downloadable package for quick viewing without Bun. It is generated from the compiled TypeScript and is not the primary development source.

## Features

- Create, edit, pin, duplicate and search text notes
- Create checklists; check and uncheck individual items from the board
- Assign eight note colors and unlimited custom labels (up to 200 imported labels)
- Rename and delete labels; filter the board by label
- Set or clear reminder dates and browse the Reminders folder
- Archive/unarchive, move to Recycle Bin, restore or permanently delete
- Undo for reversible move/delete actions
- Grid/list layouts, teal/midnight desktop backgrounds, mobile folder pane
- Working menus, Start menu, taskbar, window minimize/maximize controls
- Auto-save local note changes to browser `localStorage`
- Import/export notes as JSON and restore example data
- Automatically imports notes created in the earlier standalone HTML app **when both apps run under the same browser origin**

**Reminders are dates shown inside the app only**, not scheduled notifications. Browser storage is tied to the origin, so different ports or browser profiles have separate data. Export a backup before clearing browser data.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `N` | New note, outside text fields |
| `Ctrl+K` or `Cmd+K` | Focus search |
| `Ctrl+Enter` or `Cmd+Enter` | Save open note |
| `Esc` | Close popup or dialog |

## Project structure

```text
NoteKeep98/
├── .gitignore
├── CREDITS.md           # Design attribution and AI disclosure
├── LICENSE              # MIT license
├── README.md            # Documentation
├── index.html           # Application HTML entry
├── server.ts            # Bun development/production HTTP server
├── src/
│   ├── main.ts          # Typed UI, note actions and DOM rendering
│   ├── data.ts          # Note types, seed data, migration and normalization
│   └── style.css        # Windows 95/98 design system and responsive styles
├── scripts/
│   └── build.ts         # Bun.build production bundling
├── tests/
│   └── browser_test.py  # Optional Playwright Chromium interaction checks
├── standalone-preview.html
├── package.json
└── tsconfig.json
```

## Design credit and attribution

**Windows 95/98 visual design reference by [Chris Lemke](https://github.com/chrislemke).** The look and feel of NoteKeep 98 is inspired by his Windows 95/98 design study:

- [Windows 95/98 Design Reference — live reference](https://chrislemke.github.io/website_designs/designs/Windows_95_98.html)
- [Source project — `chrislemke/website_designs`](https://github.com/chrislemke/website_designs/tree/main)
- [Chris Lemke on GitHub](https://github.com/chrislemke)

The design reference's source repository is [MIT licensed](https://github.com/chrislemke/website_designs/blob/main/LICENSE) (© 2026 Chris Lemke). The NoteKeep 98 interface has been independently implemented with custom CSS and icons, based on its visual styling. This credit recognizes the original reference; it does **not** imply that Chris Lemke created, developed, endorses or maintains this application.

See [CREDITS.md](CREDITS.md) for the attribution. Google Keep is a Google product; this independent notes app is not affiliated with or endorsed by Google.

## AI disclaimer

**NoteKeep 98 was developed with assistance from OpenAI's ChatGPT.** AI was used to generate and refine the application code, Windows 95/98-inspired interface, and project documentation. AI-generated output may contain errors, limitations, or security issues; the project has not undergone an independent security audit. Review and test the code before relying on it in production.

This disclosure acknowledges AI assistance, not authorship or endorsement by Chris Lemke, Google, Microsoft, or OpenAI.

## Testing

From the repository root, install dependencies, type-check the source, and attempt a production build:

```bash
bun install
bun run typecheck
bun run build
```

To check the interface manually, run `bun run dev`, open **http://localhost:3000**, and test creating, editing, searching, archiving, and restoring notes. Reload the page to check browser-local persistence.

The optional `tests/browser_test.py` script is environment-specific: it expects pre-generated `.preview/` JavaScript files and Chromium at `/usr/bin/chromium`. It is **not** configured as a portable test command.

## License

NoteKeep 98 is licensed under the [MIT License](LICENSE).

The Windows 95/98 design reference by [Chris Lemke](https://github.com/chrislemke) is separately licensed under MIT. See [CREDITS.md](CREDITS.md) for attribution.
