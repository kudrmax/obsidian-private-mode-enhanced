# Private-always secondary rendering protection

## Status

The behavior matrix was approved in chat on 2026-09-07. Implementation starts only after the written design is reviewed.

## Goal

Protect `#private-always` note content from accidental visual disclosure outside that note's own open Markdown tab. Protection remains visual blur only: content stays rendered in the DOM, and the plugin does not replace it with a placeholder or prevent copying and inspection.

## Behavioral contract

| Context | Note title | Note content |
| --- | --- | --- |
| The note's own open Markdown tab | Existing leaf-local `#private-always` state | Existing leaf-local `#private-always` state |
| Hover preview, embed, Canvas preview, or another secondary Markdown render | Existing global `#private` behavior | Always blurred |
| Backlink, search, or another indexed result that contains an excerpt | Existing global `#private` behavior | Always blurred |

The permanent secondary-content blur is independent from:

- the global blur on/off state;
- the global blur level;
- the local state of any open `#private-always` leaf;
- hover and focus reveal rules.

Opening the note in a Markdown leaf changes the context from secondary rendering to direct rendering. The existing per-leaf state then applies, including the default hard-character mode and leaf-local shortcuts.

Nested tags such as `#private-always/banking` follow the same policy.

## Architecture

### Central policy

Add a `PrivateAlwaysRenderPolicy` that makes one decision:

```text
protectContent(filePrivacyKind, renderKind) =
    filePrivacyKind is private-always and renderKind is secondary
```

`renderKind` has only two values: `direct-markdown-leaf` and `secondary`. Titles are not content and are never assigned the permanent content-blur role.

The policy reuses the existing tag classifier. It contains no DOM selectors and no Obsidian event handling, so its complete behavior can be covered by unit tests.

### Protection marker

Every classified secondary-render or indexed-result root receives one semantic context class:

```text
private-mode-private-always-secondary-render
```

CSS separates descendants of that context into title and content roles. A final content rule applies the normal blur radius with `!important`, and no reveal selector removes it. Title descendants use the existing global `#private` reveal state instead. Navigation controls are excluded from both roles.

### Renderer adapter

Register one Markdown postprocessor for Markdown-rendered surfaces. It uses the render source path to classify the rendered file and determines whether the render is direct or secondary.

A render is direct only when all of these conditions hold:

- it belongs to a real Markdown workspace leaf;
- that leaf is currently open on the same file path;
- the rendered element is not nested inside an embed or another preview container.

All other Markdown rendering is secondary. This adapter therefore covers Page Preview bodies, internal embeds, Canvas Markdown previews, and future surfaces that use Obsidian's Markdown renderer without adding surface-specific privacy rules.

### Hover preview adapter

Use the common `hover-link` flow as an early classification signal. Resolve the target file from `linktext` and `sourcePath`, then mark the `HoverParent` popover content when it is created. This is independent of whether the hover originated in Linked mentions, the editor, search, Bases, or another registered hover source.

The Markdown postprocessor remains the source-of-truth backstop. The hover adapter exists to guarantee that a private preview is blurred before its first visible frame rather than briefly appearing unblurred while Markdown processing completes.

### Indexed-result adapter

Backlink and search excerpts are raw result DOM rather than Markdown-renderer output. A single indexed-result adapter classifies each result by its source file and marks the result root with the same secondary-render context class. CSS treats its title and excerpt as separate roles: the title uses existing global `#private` behavior, while the excerpt is permanently blurred.

The adapter first uses an explicit file path exposed by the result. If unavailable, it reconstructs the path from the core result title and parent-path elements, then resolves it through the vault. An unresolved result is left unchanged and rechecked on the next layout or metadata update.

This is the only DOM-family adapter required by the design. New Markdown-rendered entry points are covered automatically; only a future Obsidian component that exposes note content as unrelated raw DOM would require another adapter, while still reusing the same central policy and marker.

## Lifecycle and updates

- Register adapters during plugin load and release all events and observers through the plugin lifecycle.
- Reclassify relevant rendered roots on layout changes and metadata-cache changes.
- When a note gains or loses `#private-always`, update already-visible previews and result excerpts without requiring a restart.
- When a popover or result is removed, retain no strong reference to its DOM node.
- Plugin unload removes added marker classes from surviving DOM roots.

## Compatibility

- Existing `#private` behavior is unchanged.
- Existing `Blur links too` and global blur behavior continue to control titles and links.
- Existing local commands for an open `#private-always` leaf are unchanged.
- The current protection of the Linked mentions section inside an open `#private-always` leaf remains in place.
- The implementation uses visual CSS blur only and does not introduce content placeholders, access control, encryption, DOM removal, or clipboard restrictions.

## Verification

### Unit tests

- Direct `#private-always` render is not permanently protected.
- Secondary `#private-always` render is permanently protected.
- Public and ordinary `#private` secondary renders are not permanently protected.
- Nested `#private-always/...` tags are protected.
- Direct-render detection rejects embeds nested in the note's own leaf.

### Live Obsidian regression tests

- Open `tmp private`, Cmd-hover the `tmp private always` backlink result, and verify the preview body is blurred.
- Reveal the open `tmp private always` tab locally and verify the same external preview remains blurred.
- Disable global blur and verify the secondary title becomes visible while the preview body remains blurred.
- Cycle every local and global blur level and verify secondary content never becomes visible.
- Embed `tmp private always` in a public note and verify its body remains blurred while the open-link control works.
- Verify a backlink or search excerpt sourced from `tmp private always` is blurred while its title follows global behavior.
- Verify the first frame of a private hover preview is already blurred.
- Verify ordinary `#private` notes and public notes retain their current behavior.

### Standard checks

- TypeScript strict compilation
- Existing and new automated tests
- ESLint
- Production build
- Obsidian runtime console check
