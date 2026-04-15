# Frontend Modularization Plan

This plan outlines the steps to modularize `app/static/js/app.js` and `app/static/css/style.css` into a modern, maintainable structure using ES6 Modules and CSS Imports.

## 1. CSS Refactoring

### Directory Structure
```
app/static/css/
├── style.css (Main entry)
└── parts/
    ├── base.css (Variables, resets, core layout)
    ├── sidebar.css (Sidebar, tree nodes, tooltips)
    ├── main_panel.css (Toolbar, breadcrumb, search)
    ├── policy.css (Policy rows, condition highlighting, badges)
    ├── detail.css (Detail panel, object views)
    ├── tabs.css (Lists, Stats, Diff tab specifics)
    └── modals.css (Modals, overlays, animations)
```

### Action Items
1. Create `app/static/css/parts/` directory.
2. Extract CSS blocks from `style.css` into respective files in `parts/`.
3. Update `style.css` to use `@import` for each part.

## 2. JS Refactoring (ES6 Modules)

### Directory Structure
```
app/static/js/
├── main.js (Entry point)
└── modules/
    ├── api.js (Backend fetch wrappers)
    ├── state.js (Global state management)
    ├── utils.js (HTML escaping, string formatting, expiry detection)
    ├── ui.js (Resizers, status messages, loading state, tooltips)
    ├── policy.js (Policy tree, main list rendering, searching)
    ├── lists.js (Lists tab logic: name/value search, entries)
    ├── stats.js (Stats tab logic: cards, table, export)
    ├── diff.js (Diff logic: modal, comparison rendering)
    ├── detail.js (Detail panel rendering, raw view toggle)
    └── events.js (Event listener binding)
```

### Key Changes
- **No Inline Events**: Remove `onclick`, `onchange`, `oninput` from `index.html`.
- **Event Delegation**: Use parent-level listeners for dynamic elements like tree nodes and policy rows.
- **State Centralization**: Use a shared `state` object to handle global variables across modules.
- **Explicit Exports**: All functions will be exported from their respective modules and imported where needed.

## 3. Implementation Steps

1. **Phase 1: CSS Splitting**
   - Create directories and move CSS content.
   - Verify layout remains intact.

2. **Phase 2: JS Module Extraction (Read-only setup)**
   - Extract logic into files without breaking the app.
   - Set up `main.js` as the entry point.

3. **Phase 3: Event Refactoring**
   - Systematically remove inline handlers from `index.html`.
   - Implement `events.js` to bind listeners.
   - Implement event delegation for dynamic elements.

4. **Phase 4: Verification**
   - Test every UI feature: Upload, Delete, Search, Tab Switching, Tree Navigation, Diff, Stats, CSV Export.

## 4. Risks & Mitigations
- **Circular Dependencies**: Prevented by moving shared state to `state.js`.
- **Dynamic Element Binding**: Use event delegation on stable parents (like `#sidebar-body`, `#main-body`).
- **Global Scope**: Modules have their own scope; any required global access (if any) will be explicitly attached to `window`.
