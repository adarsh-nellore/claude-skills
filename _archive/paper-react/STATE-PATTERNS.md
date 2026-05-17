# State Patterns Reference

HTML structure idioms per archetype, for the Paper design phase of the `paper-react` skill.

**How to use:** when designing a state card in Paper for any archetype below, copy the snippet, then swap example values for your design system's tokens. The structure is what this file teaches; the values come from the system.

**Example values used throughout** (from the editorial archive system — replace with your own):
- `#FFFFFF` ground · `#171717` ink · `#737373` mute · `#E5E5E5` edge · `#FAFAFA` wash · `#404040` hover-label
- Inter font · body 14/20 · caption 12/16
- 8px radius · 1px borders · 44px input height · 36px item row · 480 standard input width
- Shadow: `0 12px 32px -4px rgba(0,0,0,0.08), 0 4px 8px -2px rgba(0,0,0,0.08)`

## Spec card scaffold (universal)

Every state card uses this wrapper. Caption above, rendered variant below.

```html
<div layer-name="<Archetype> / <State>" style="display:flex; flex-direction:column; gap:12px;">
  <div style="font-family:Inter; font-weight:400; font-size:12px; line-height:16px; color:#737373;"><State name></div>
  <!-- rendered variant goes here -->
</div>
```

Group multiple state cards inside a section:

```html
<div layer-name="Section / <Archetype>" style="display:flex; flex-direction:row; gap:32px; align-items:flex-start;">
  <div layer-name="Section heading" style="display:flex; flex-direction:column; gap:8px; width:160px; flex-shrink:0;">
    <div style="font-family:Inter; font-weight:500; font-size:14px; line-height:20px; color:#171717;"><Archetype name></div>
    <div style="font-family:Inter; font-weight:400; font-size:12px; line-height:16px; color:#737373;">1-line description.</div>
  </div>
  <div layer-name="States" style="display:flex; flex-direction:<row|column>; gap:<32 if row, 40 if column>;">
    <!-- state cards go here -->
  </div>
</div>
```

Use row layout for small components (chips, toggles). Use column layout for tall components (search input cluster, panel, full result row).

## Button

### Default
```html
<button layer-name="Button / Default" style="align-self:flex-start; display:inline-flex; align-items:center; height:40px; padding:0 16px; border:1px solid #171717; border-radius:8px; background:#171717; cursor:pointer; font-family:Inter; font-weight:500; font-size:14px; line-height:20px; color:#FFFFFF;">Action</button>
```

### Hovered
```html
<!-- same as default but background:#404040 -->
```

### Pressed
```html
<!-- background:#0A0A0A (slightly darker than ink) -->
```

### Focused
```html
<div layer-name="Focus wrapper" style="align-self:flex-start; padding:2px; border:1px solid #171717; border-radius:10px;">
  <!-- default button inside -->
</div>
```

### Disabled
```html
<!-- background:#E5E5E5, color:#737373, cursor:not-allowed -->
```

### Loading
```html
<button layer-name="Button / Loading" style="...same chrome..."><div style="width:14px; height:14px; border:2px solid #737373; border-top-color:#FFFFFF; border-radius:50%; margin-right:8px;"></div>Loading</button>
```

## Text input

### Default
```html
<div layer-name="Input" style="display:flex; align-items:center; width:480px; height:44px; padding:0 16px; border:1px solid #E5E5E5; border-radius:8px; background:#FFFFFF; box-sizing:border-box;">
  <div style="font-family:Inter; font-weight:400; font-size:14px; line-height:20px; color:#737373;">Placeholder text</div>
</div>
```

### Focused
```html
<div layer-name="Input" style="...same wrapper but border:1px solid #171717...">
  <div layer-name="Caret" style="width:2px; height:16px; background:#171717; margin-right:6px; flex-shrink:0;"></div>
  <div style="font-family:Inter; font-weight:400; font-size:14px; line-height:20px; color:#737373;">Placeholder text</div>
</div>
```

### Filled
```html
<div layer-name="Input" style="...ink border (focused)...">
  <div style="font-family:Inter; font-weight:400; font-size:14px; line-height:20px; color:#171717;">User value</div>
  <div layer-name="Caret" style="width:2px; height:16px; background:#171717; margin-left:2px; flex-shrink:0;"></div>
</div>
```

### Error
Without a validated error color, use desaturated treatment: ink border + mute caption below.

```html
<div layer-name="Cluster" style="display:flex; flex-direction:column; gap:6px; width:480px;">
  <div layer-name="Input" style="...ink border, value inside...">Bad value</div>
  <div layer-name="Error caption" style="font-family:Inter; font-weight:400; font-size:12px; line-height:16px; color:#737373;">Error explanation here.</div>
</div>
```

If your system has an error token, swap mute caption color + border to the error hue. Don't invent a token if it's missing — desaturate, document, and add the token later.

### Disabled
```html
<div layer-name="Input" style="...edge border but background:#FAFAFA...">
  <div style="font-family:Inter; font-weight:400; font-size:14px; line-height:20px; color:#737373;">Disabled placeholder</div>
</div>
```

## Search input w/ autocomplete

### Default
Same as Text input / Default. The autocomplete only appears when there's a query.

### Focused empty
Same as Text input / Focused. Caret + placeholder, no panel.

### Focused filled + matches
```html
<div layer-name="Cluster" style="display:flex; flex-direction:column; gap:8px; width:480px;">
  <div layer-name="Input" style="...ink border... value + caret...">
    <div style="...ink color...">query text</div>
    <div layer-name="Caret" style="width:2px; height:16px; background:#171717; margin-left:2px; flex-shrink:0;"></div>
  </div>
  <div layer-name="Suggestion list" style="display:flex; flex-direction:column; padding:4px 0; border:1px solid #E5E5E5; border-radius:8px; background:#FFFFFF; box-shadow:0 12px 32px -4px rgba(0,0,0,0.08), 0 4px 8px -2px rgba(0,0,0,0.08);">
    <div layer-name="Suggestion / Default" style="display:flex; align-items:center; height:36px; padding:0 16px; font-family:Inter; font-weight:400; font-size:14px; line-height:20px; color:#171717;">first match</div>
    <div layer-name="Suggestion / Highlighted" style="display:flex; align-items:center; height:36px; padding:0 16px; background:#FAFAFA; font-family:Inter; font-weight:400; font-size:14px; line-height:20px; color:#171717;">second match</div>
    <div layer-name="Suggestion / Default" style="...">third match</div>
  </div>
</div>
```

### Focused filled + no matches
Just the filled input, no panel.

### Error desaturated / Disabled
Same as Text input — error caption below, or tinted ground.

## Dropdown trigger

### Default (flat editorial style — no chrome)
```html
<div layer-name="Trigger" style="display:inline-flex; align-items:center; gap:8px; padding:6px 0; align-self:flex-start;">
  <div style="font-family:Inter; font-weight:400; font-size:14px; line-height:20px; color:#171717;">Sort by</div>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#737373" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
</div>
```

### Hovered
Label color shifts to `#404040`. Chevron stays mute.

### Open
Chevron rotated 180°:
```html
<svg ... style="transform:rotate(180deg);"><polyline points="6 9 12 15 18 9"/></svg>
```

### Focused
Wrap trigger in a 2px-padding wrapper with a 1px ink border around it.

### Disabled
Label and chevron both mute. Cursor not-allowed.

## Dropdown item

### Default
```html
<div layer-name="Item / Default" style="display:flex; align-items:center; height:36px; padding:0 12px; font-family:Inter; font-weight:400; font-size:14px; line-height:20px; color:#171717;">Option label</div>
```

### Hovered
```html
<div layer-name="Item / Hovered" style="...same chrome but background:#FAFAFA...">Option label</div>
```

### Selected (with leading check)
```html
<div layer-name="Item / Selected" style="display:flex; align-items:center; gap:8px; height:36px; padding:0 12px;">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#737373" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>
  <div style="font-family:Inter; font-weight:400; font-size:14px; line-height:20px; color:#171717;">Option label</div>
</div>
```

### Focused
```html
<div layer-name="Item / Focused" style="...same chrome but border:1px solid #171717 inside...">Option label</div>
```

### Disabled
Label color `#737373`, no hover possible.

## Chip (toggleable)

### Default
```html
<div layer-name="Chip / Default" style="display:inline-flex; align-items:center; height:32px; padding:0 12px; border:1px solid #E5E5E5; border-radius:8px; background:#FFFFFF; font-family:Inter; font-weight:400; font-size:14px; line-height:20px; color:#171717;">Label</div>
```

### Hovered
Same chrome, label color shifts to `#404040`.

### Selected (inverted)
```html
<div layer-name="Chip / Selected" style="...same shape but background:#171717, border:1px solid #171717, color:#FFFFFF...">Label</div>
```

### Focused
Wrap in a 2px-padded outer with a 1px ink border for the keyboard focus ring.

### Disabled
Background `#FAFAFA`, label `#737373`, border `#E5E5E5`.

## Segmented control

```html
<div layer-name="Segmented" style="display:inline-flex; border:1px solid #E5E5E5; border-radius:8px; background:#FFFFFF; height:32px;">
  <div layer-name="Button / Active" style="display:flex; align-items:center; justify-content:center; width:32px; height:30px; background:#FAFAFA;">
    <svg ... stroke="#171717">...</svg>
  </div>
  <div layer-name="Divider" style="width:1px; height:30px; background:#E5E5E5;"></div>
  <div layer-name="Button / Inactive" style="display:flex; align-items:center; justify-content:center; width:32px; height:30px; background:#FFFFFF;">
    <svg ... stroke="#737373">...</svg>
  </div>
</div>
```

For "Selected per segment" state map, render the same segmented control twice — once with the left segment active, once with the right segment active.

## Row / Card

### Default
```html
<div layer-name="Row / Default" style="display:flex; flex-direction:row; align-items:center; justify-content:space-between; gap:24px; width:720px; padding:16px 20px; background:#FFFFFF; border-top:1px solid #E5E5E5; border-bottom:1px solid #E5E5E5; box-sizing:border-box;">
  <div style="display:flex; flex-direction:column; gap:4px;">
    <div style="font-family:Inter; font-weight:500; font-size:14px; line-height:20px; color:#171717;">Title</div>
    <div style="font-family:Inter; font-weight:400; font-size:12px; line-height:16px; color:#737373;">Category</div>
    <div style="font-family:Inter; font-weight:400; font-size:14px; line-height:20px; color:#171717;">Summary text.</div>
  </div>
  <div style="display:flex; gap:6px; flex-shrink:0;">
    <!-- tag pills go here, see Common sub-elements -->
  </div>
</div>
```

### Hovered
Same row, `background:#FAFAFA`.

### Selected (multi-select context)
Add a leading check icon as the first child of the row, same pattern as Dropdown item / Selected.

### Focused
Add a 1px ink outline inset 2px around the row.

### Loading skeleton
Replace text content with shimmer placeholders: `background:#F5F5F5; border-radius:4px; height:<line-height>; width:<60-80% of typical content>`.

## Toggle / Switch

### Off
```html
<div layer-name="Toggle / Off" style="display:inline-flex; align-items:center; width:36px; height:20px; padding:2px; border:1px solid #E5E5E5; border-radius:9999px; background:#FFFFFF;">
  <div layer-name="Thumb" style="width:14px; height:14px; border-radius:9999px; background:#737373;"></div>
</div>
```

### On
```html
<div layer-name="Toggle / On" style="display:inline-flex; align-items:center; justify-content:flex-end; width:36px; height:20px; padding:2px; border:1px solid #171717; border-radius:9999px; background:#171717;">
  <div layer-name="Thumb" style="width:14px; height:14px; border-radius:9999px; background:#FFFFFF;"></div>
</div>
```

### Focused
Wrap in 2px padding outer with 1px ink border for ring.

### Disabled
Track `#FAFAFA` + edge border, thumb `#E5E5E5`.

## Modal / Drawer

### Closed
Not rendered. Document that the trigger is what's visible.

### Open
```html
<div layer-name="Backdrop" style="position:absolute; inset:0; background:rgba(0,0,0,0.32);">
  <div layer-name="Modal / Surface" style="display:flex; flex-direction:column; gap:24px; width:560px; padding:32px; background:#FFFFFF; border-radius:8px; box-shadow:0 12px 32px -4px rgba(0,0,0,0.08), 0 4px 8px -2px rgba(0,0,0,0.08); margin:auto; margin-top:120px;">
    <div style="font-family:Inter; font-weight:500; font-size:20px; line-height:24px; color:#171717;">Heading</div>
    <div style="font-family:Inter; font-weight:400; font-size:14px; line-height:20px; color:#404040;">Body copy.</div>
    <!-- footer with buttons -->
  </div>
</div>
```

Drawer is the same but with `position:absolute; right:0; height:100%; width:480px;` instead of centered modal.

## Tooltip / Popover

### Visible
```html
<div layer-name="Tooltip" style="display:inline-flex; padding:6px 10px; background:#171717; border-radius:6px; font-family:Inter; font-weight:400; font-size:12px; line-height:16px; color:#FFFFFF;">Tooltip text</div>
```

### With arrow
Add a triangle sub-element using a CSS border trick or an inline SVG path.

## Tabs

### Default per tab
```html
<div layer-name="Tab / Default" style="display:inline-flex; align-items:center; padding:8px 4px; border-bottom:2px solid transparent; font-family:Inter; font-weight:400; font-size:14px; line-height:20px; color:#737373;">Tab label</div>
```

### Active
```html
<div layer-name="Tab / Active" style="...same as default but border-bottom:2px solid #171717, color:#171717, font-weight:500...">Tab label</div>
```

### Hovered
`color:#404040`.

### Focused
Outline ring around the tab label area.

### Disabled
`color:#E5E5E5`, no underline.

Wrap multiple tabs in a row container:
```html
<div layer-name="Tabs" style="display:flex; gap:24px; border-bottom:1px solid #E5E5E5;">
  <!-- tabs go here -->
</div>
```

## Common sub-elements

### Caret marker (for focused inputs)
```html
<div layer-name="Caret" style="width:2px; height:16px; background:#171717; margin-right:6px; flex-shrink:0;"></div>
```
Adjust `margin-right` to `margin-left:2px` if it sits after a value instead of before a placeholder.

### Chevron-down (16×16)
```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#737373" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
```
Rotate 180° (chevron-up) via `style="transform:rotate(180deg);"` or `style="rotate:180deg; transform-origin:50% 50%;"`.

### Check (16×16)
```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#737373" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
```

### Search magnifier (16×16)
```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#737373" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>
```

### Divider (horizontal hairline)
```html
<div layer-name="Divider" style="display:flex; height:1px; width:100%; background:#E5E5E5; margin:4px 0;"></div>
```

### Tag pill (read-only label inside a row)
```html
<div layer-name="Tag" style="display:inline-flex; align-items:center; height:20px; padding:0 8px; border:1px solid #E5E5E5; border-radius:9999px; font-family:Inter; font-weight:400; font-size:12px; line-height:16px; color:#737373;">tag-label</div>
```

### Focus ring wrapper
For any component that needs an outer focus indicator:
```html
<div layer-name="Focus wrapper" style="align-self:flex-start; padding:2px; border:1px solid #171717; border-radius:10px;">
  <!-- focused component sits inside -->
</div>
```
Bump the wrapper's `border-radius` to `inner-radius + 2` so the ring sits flush.

## Notes

- These snippets default to the editorial archive palette. Replace hex values with your design system's tokens before pasting into `write_html`.
- Geometry (heights, padding, gaps) follows the editorial archive defaults. If your system has different conventions, change the values but keep the structural shape.
- Layer names always follow `<Component> / <State>` or generic sub-element names (`Surface`, `Label`, `Caret`, `Chevron`, `Tag`). Never name layers after copy.
- If an archetype you need isn't here, ask the user what states matter and either propose a structure or wait for them to describe it. Don't guess silently.
