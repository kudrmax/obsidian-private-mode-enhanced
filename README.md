# Private Mode Enhanced
Simple #private mode for [Obsidian](https://obsidian.md/). Notes tagged with `#private` follow the global blur mode. Notes tagged with `#private-always` always open blurred at level 4 and can only be revealed temporarily in their active tab.

> **This is a fork** of [markusmo3/obsidian-private-mode](https://github.com/markusmo3/obsidian-private-mode) with extra "hard blur" modes, an on/off toggle and persisted state. See [What's different from the original](#whats-different-from-the-original) below. Installed via [BRAT](https://github.com/TfTHacker/obsidian42-brat).

The optional [Supercharged Links](https://github.com/mdelobelle/obsidian_supercharged_links) plugin is only needed for **Blur Links Too** in sidebars. Blurring note content works without it.

![docs/showcase_1.png](docs/showcase_1.png)

![docs/showcase_2.png](./docs/showcase_2.png)

# What's different from the original
This is a fork of [markusmo3/obsidian-private-mode](https://github.com/markusmo3/obsidian-private-mode). Everything from the original still works; on top of it this fork adds:

* 🕶️ **Hard blur modes** — for when the whole editing line must stay hidden while you type. Instead of revealing the entire active line, only a tiny window around the caret is shown:
  * **Blur level 3 · show N words**: reveal the last N words ending at the caret; `N` is configurable in the settings tab (default `1` → just the current word).
  * **Blur level 4 · show one character**: reveal only the character to the left of the caret.
* 🔀 **`Blur on/off`** — a command that switches blurring off and back on **in the same mode**. Unlike *level 1 · show all* (which is itself a mode), toggling remembers whatever mode you were in and restores it.
* 🔒 **`#private-always`** — every tab starts at *Blur level 4 · show one character*, regardless of the global `#private` state. Blur toggles and level commands affect only the active `#private-always` tab; closing it forgets those temporary changes.
* 💾 **Persisted state** — the current mode and the on/off state survive an Obsidian restart. (The original always reset to *Reveal on hover* on every start.)
* ⚙️ **Settings tab** — adds a settings panel (currently: the `N` for *blur level 3*). The original had no settings.
* 🏷️ **Clear command names** — all commands renamed to a single readable `Blur level N` ladder (1 shows all → 4 shows one character), so the command palette reads as a gradient at a glance.

# Features
* 🪜 Modes as a `Blur level` ladder (left click the status bar or use `Cycle blur level` to step through levels 1–4)
  * **Blur level 1 · show all**: disable the blurring completely
  * **Blur level 2 · show one line**: show only the currently editing line
  * **Blur level 3 · show N words**: keep the line hidden, reveal only the last N words at the caret (`N` in settings, default 1)
  * **Blur level 4 · show one character**: keep the line hidden, reveal only the character left of the caret
  * **Blur level · show on hover**: show #private content on hover / selection (outside the cycle)
* 🔗 Blur also all links to #private files, or not, its your choice
* 🧩 Nested tags are supported: `#private/...` and `#private-always/...`
* 💻 By default not visible when using screenshare! Keep your secrets :) (desktop-only)
* 📱 Supported on Obsidian Mobile
* 🎀 Commands to set visibility (also usable on mobile)
* ✅ Status bar indicator that shows the current state (desktop-only)
  * while a `#private-always` tab is active, the indicator and its menu reflect that tab's temporary state
  * left click to cycle visibility
  * right click to open the menu
  * red means recording and obsidian will be visible in screensharing
* ⌨️ Recommended keyboard shortcuts (not set by default)
  * ALT-L to cycle visibility
  * ALT-SHIFT-L to cycle screen share protection
* 💬 Callout `private`, which is also blurred and can be collapsed via default Obsidian behaviour for even more "hidden-ness"
  ```markdown
  > [!private]- Optional Title
  > some text here:
  > - list
  ```

# Installing
This fork is **not** in the Community Plugins store — install it as a beta plugin via BRAT.

1. Optionally install [Supercharged Links](https://github.com/mdelobelle/obsidian_supercharged_links) if you want **Blur Links Too** for file trees, search results and Dataview links.
2. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from "Community Plugins" if you don't have it yet.
3. In BRAT, run "Add beta plugin" and enter `kudrmax/obsidian-private-mode-enhanced`. BRAT installs the plugin and keeps it updated ("Check for updates").
4. Enable **Private Mode Enhanced** in "Community Plugins" and, if installed, enable **Supercharged Links**.
5. For **Blur Links Too**, configure Supercharged Links to add tag metadata to links in the sidebars you want protected.

> Prefer the original without the fork's extras? Install [Private Mode](https://obsidian.md/plugins?id=private-mode) straight from Community Plugins.

# Troubleshooting
* My file content is not hidden!
  * Make sure the note has `#private` or `#private-always` in frontmatter or inline tags, then reload the plugin and inspect the Obsidian developer console for errors.
* Blur Links Too does not hide links in sidebars!
  * Install Supercharged Links and enable tag metadata for the affected sidebar elements.

# Credits
Huge thanks to [Privacy Glasses](https://github.com/jillalberts/privacy-glasses/tree/master) for the groundwork and being licensed under MIT. Use that plugin if you want a more in depth configuration. I personally didn't need or want that much customization and overhead in my plugin. Also i found the "flickering" when opening any file to be too distracting, so i created a simpler version for myself.
