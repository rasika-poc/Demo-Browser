# Demo Browser

A multi-pane browser (1–6 sites) for live demos. It loads any website (including ones that block iframes), switches between layouts with animation, and steps through saved "scenes".

Built with **Electron** (`<webview>` panes) and plain HTML/CSS/JS. There's no build step, and the animations are CSS transitions.

## Run

```bash
npm install
npm start
```

> If Electron starts as plain Node (`Cannot find module 'electron'`), something exported `ELECTRON_RUN_AS_NODE`. VS Code's terminal often does this. `npm start` already clears it.

## Build a Mac app

```bash
npm run dist       # dist/Demo Browser-<version>-arm64.dmg and .zip
npm run dist:dir   # just dist/mac-arm64/Demo Browser.app (faster)
```

To publish a release, push a version tag. GitHub Actions builds Apple Silicon and Intel versions and attaches them to a GitHub release:

```bash
git tag v1.0.1 && git push origin v1.0.1
```

You can also run **Build & Release** by hand from the Actions tab. That builds the app and uploads it as a workflow artifact without creating a release.

The app is unsigned. The first time you open it on another Mac, right-click it and choose **Open**, or run `xattr -cr "/Applications/Demo Browser.app"`.

## Using it

- **Add / remove sites**: use **+** in the top bar or the control panel (or ⌘T) to add a site, and **×** on a pane (or ⌘W) to remove one. You can have 1 to 6 sites.
- **Picks up where you left off**: on reopen you get the same sites, labels, zoom, layout, focused pane, scroll position in each site, and window size and position.
- **Panes**: each pane has its own URL bar with back, forward and reload. You can type a URL, a host like `localhost:3000`, or search words.
- **Fixed site width**: each site renders at a fixed width (1280px by default) and is scaled to fit its pane. Resizing or animating a pane zooms the page instead of reflowing it, so a site never jumps to its mobile layout.
  - Change the width under **Presentation → Site width** (Auto · 1024 · 1280 · 1440 · 1920). **Auto** makes sites reflow to the pane size, like a normal browser.
  - Use **− / +** on each pane, or ⌘− / ⌘=, to zoom the focused pane. Click the % to reset it. Zoom levels are saved with scenes.
- **Layouts** (top-right switcher): Columns · Grid · Focus (one big pane, the rest stacked beside it) · Stack · Single.
  - Click a dimmed pane, or its title bar, to bring it into focus.
  - Double-click a title bar to toggle that pane fullscreen.
- **Control panel** (⌘K): edit labels and URLs, save, overwrite or delete scenes, export or import scenes as JSON, and tune animation speed, gap and dimming.
- **Scenes**: a scene stores its sites (any number), their labels, the layout and the focused pane. Step through them with ⌘⌥→ / ⌘⌥← during the demo.
- **Clean mode** (⌘⇧H): hides all browser chrome for presenting. Hover the top edge to bring it back.

| Shortcut | Action |
|---|---|
| ⌘1 … ⌘6 | Focus pane |
| ⌘T / ⌘W | Add / remove site |
| ⌘0 | Show all (columns) |
| ⌘⇧L | Next layout |
| ⌘L | Edit focused pane URL |
| ⌘⌥← / ⌘⌥→ | Previous / next scene |
| ⌘= / ⌘− | Zoom focused pane |
| ⌘K | Control panel |
| ⌘⇧H | Hide browser chrome |
| ⌘R / ⌘⇧R | Reload focused / all panes |
| ⌃⌘F | Fullscreen |

Settings are saved automatically to `~/Library/Application Support/demo-browser/config.json`. Logins and cookies persist between runs, so you can sign in to sites before the demo.
