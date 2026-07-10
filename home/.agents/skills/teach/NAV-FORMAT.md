# Navigation Format

`nav.js` and `nav.css` live at the workspace root and provide a shared sidebar that links all lessons and reference pages together. The user can open any page and navigate to any other without leaving the browser.

## Scaffolding

When creating the **first** lesson or reference page, copy the templates into the workspace:

- Copy [nav-template.js](./nav-template.js) → `./nav.js`
- Copy [nav-template.css](./nav-template.css) → `./nav.css`
- Set `TEACH_NAV_MANIFEST.topic` to the topic name from `MISSION.md`

## Including in HTML pages

Every lesson and reference HTML file must include these two tags in `<head>`:

```html
<link rel="stylesheet" href="../nav.css">
<script src="../nav.js" defer></script>
```

The `../` prefix works because both `lessons/` and `reference/` are one level deep from the workspace root.

## Updating the manifest

Whenever you create, rename, or delete a page, update the `TEACH_NAV_MANIFEST` object at the top of `nav.js`.

### Adding a lesson

```js
lessons: [
  { id: "0001", title: "Your First Scale", file: "0001-your-first-scale.html" },
  { id: "0002", title: "Minor Pentatonic",  file: "0002-minor-pentatonic.html" },
],
```

### Adding a reference page

```js
reference: [
  { title: "Glossary",       file: "glossary.html" },
  { title: "Chord Reference", file: "chord-reference.html" },
],
```

### Deleting a page

Remove the entry from the manifest **and** delete the file.

## Style consistency

The nav uses a neutral dark palette (`#1a1a2e`) and system fonts so it doesn't clash with lesson content. Do **not** restyle the nav to match individual lessons — the nav is the one constant across all pages.

If you choose a light colour scheme for lessons, the dark sidebar provides clear visual separation. If lessons use a dark scheme, the nav will blend naturally. Do not modify `nav.css` on a per-lesson basis.

## How it works

- `nav.js` contains the manifest (data) and a self-executing renderer (code)
- On page load, the renderer injects a toggle button (top-left ☰) and a slide-out sidebar
- The sidebar highlights the current page automatically using the URL
- The sidebar is hidden in print via `@media print`
- No server, no fetch — works on `file://` because `<script src>` loads cross-origin
