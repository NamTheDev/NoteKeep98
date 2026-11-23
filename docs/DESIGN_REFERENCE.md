# Shared Windows 95/98 Design Contract

Primary reference: https://chrislemke.github.io/website_designs/designs/Windows_95_98.html

This design contract is shared by [clipboard](https://github.com/NamTheDev/clipboard) and [keep](https://github.com/NamTheDev/keep). Both have **GitHub Pages frontends**.

| Element | Classic Windows 95/98 | Optional dark adaptation |
|---|---|---|
| Desktop | `#008080` teal | `#181818` neutral black |
| Raised panels | `#c0c0c0` silver | `#303030` charcoal |
| Outer raised highlight | `#ffffff` | `#707070` |
| Inner raised highlight | `#dfdfdf` | `#505050` |
| Inner raised shadow | `#808080` | `#202020` |
| Outer raised shadow | `#000000` | `#090909` |
| Title bar | `#000080` → `#1084d0` | `#163c70` → `#225a86` |
| Recessed content | white | `#1b1b1b` |
| Selected rows | `#000080` | `#174778` |

Geometry: square corners, Tahoma/system sans, compact toolbars/menus, four-tone raised/recessed bevels, 29px title bars, Windows Explorer layout, taskbar, monochrome system pictograms. Responsive/mobile adaptations, dark mode and accessibility improvements remain deliberate application-level variations and do **not** imply they exist in the original reference.

Preserve app-specific features: clipboard room IDs, sharing, paste and settings; keep note editor, quick composer, folders, note colors, search, local data, backups and archive. Note-card colors represent user content and should not be monochromatized.
