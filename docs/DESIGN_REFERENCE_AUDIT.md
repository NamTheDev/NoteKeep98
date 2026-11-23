# Windows 95/98 design-reference audit

Reference: Chris Lemke, [Windows 95/98 — Design Reference](https://chrislemke.github.io/website_designs/designs/Windows_95_98.html) and the [interactive example](https://chrislemke.github.io/website_designs/examples/Windows_95_98.html).

Updated: 23 November 2026. The reference specifies **a light Windows 95/98 system palette**, not a canonical dark theme. NoteKeep98 is an independent notes app, not a reproduction or endorsement.

## Design contract

| Feature | Reference | NoteKeep98 implementation |
| --- | --- | --- |
| Desktop | Flat teal `#008080` | Plain teal desktop, no dot texture |
| Face | `#C0C0C0` | Shared panel, menu, toolbar, window and taskbar surface |
| Highlight/light | `#FFFFFF` / `#DFDFDF` | Shared top/left raised borders and inner highlights |
| Shadow/dark | `#808080` / `#000000` | Shared inner and outer bottom/right bevels |
| Active title | `#000080` → `#1084D0` gradient | Title-bar gradient only |
| Content/input | White fields with **sunken** bevels | White content region; inset fields, note paper, clock and status cells |
| Selection | `#000080`, white foreground | Menu and navigation highlight |
| Typography | Small system fonts; compact whole-pixel spacing | Tahoma-first, 12px UI baseline, restrained 18px page heading |
| Windows and dialogs | Rectangular, raised chrome | Rectangular frames with 2px outer bevel and 1px inner bevel |
| Toolbar/menu | Compact functional controls, no decorative shadows | Reduced padding, fixed-size controls, binary hover/press states |
| Taskbar | ~32px anchored; Start and recessed clock | 34px on desktop; 40px touch target on mobile |
| Mobile | Adapt without scaling bevels | Main window remains maximized at <=750px; workspace-relative folder overlay |

## Dark Mode

The reference provides **no official dark color scheme**. NoteKeep98 keeps the same semantic relationships between four tonal border colors and reuses the window, title, input, selection and menu patterns with a neutral charcoal palette. The existing browser-stored `dark` setting and saved notes are untouched.

## Deliberate differences and remaining opportunities

1. **Cards:** The note grid is essential to this Keep-like application. Notes retain custom colored paper in Light Mode and colored indicators in Dark Mode. Converting every card to a separate draggable OS window would compromise the task.
2. **Icons:** Existing SVG symbols remain for clarity, accessibility and small asset size. A faithful replacement would be original 16×16/32×32 pixel-sprite assets, requiring a complete audited sprite set—not simply applying `image-rendering:pixelated` to vectors.
3. **Scrollbars:** Existing 17px arrowless scrollbars remain. The reference favors beveled arrows; modern browser scrollbar support varies. Any arrow replacement should be tested on Chromium/Firefox and on touch rather than injecting nonfunctional ornament.
4. **Mobile:** The collapsed folder panel and full-size touch controls deliberately depart from a 1990s desktop-only design.
5. **Dialog overlay:** A dim backdrop remains for focus/legibility; older Windows used active/inactive window state rather than the modern modal scrim.
6. **Typography:** Available system font fallbacks vary across Linux, Windows and Android; rendering cannot be pixel-identical across platforms without bundling licensed bitmap assets.

## Regression checklist

- Light: flat teal desktop, silver chrome, white content field, title gradient, four-tone bevels, 34px taskbar.
- Dark: neutral charcoal system palette, light control labels, black/white title glyphs by theme, mirrored raised and recessed semantics.
- Mobile: maximize button disabled, full-width window, correctly aligned folder overlay/backdrop, no horizontal overflow.
- Browser: note CRUD, checklists, theme persistence, menus/dialogs, backup and storage failure behavior remain functional.
- GitHub Pages: static production build with fingerprinted CSS/JS URLs.

Do not substitute arbitrary blue-gray or warm off-white panel colors, rounded corners, blurred shadows, or animated transitions without an explicit design decision.
