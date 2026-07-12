# Private Mode Enhanced
Simple #private mode for [Obsidian](https://obsidian.md/). All files, links and search results tagged with #private will get blurred out in the default mode. You have to either hover over or focus on the element to show it temporarily or use the command "Reveal all" to always show it. 

> **This is a fork** of [markusmo3/obsidian-private-mode](https://github.com/markusmo3/obsidian-private-mode) with extra "hard blur" modes, an on/off toggle and persisted state. See [What's different from the original](#whats-different-from-the-original) below. Installed via [BRAT](https://github.com/TfTHacker/obsidian42-brat).

**This plugin requires the obsidian plugin [Supercharged Links](https://github.com/mdelobelle/obsidian_supercharged_links) to work**

![docs/showcase_1.png](docs/showcase_1.png)

![docs/showcase_2.png](./docs/showcase_2.png)

# What's different from the original
This is a fork of [markusmo3/obsidian-private-mode](https://github.com/markusmo3/obsidian-private-mode). Everything from the original still works; on top of it this fork adds:

* 🕶️ **Hard blur modes** — for when the whole editing line must stay hidden while you type. Instead of revealing the entire active line, only a tiny window around the caret is shown:
  * **Hard blur — word**: reveal only the word under the caret.
  * **Hard blur — char**: reveal only the character to the left of the caret.
  * **Hard blur — N words**: reveal the last N words ending at the caret; `N` is configurable in the settings tab (at `N = 1` this equals *word* mode).
* 🔀 **`Toggle blur on/off (keep mode)`** — a command that switches blurring off and back on **in the same mode**. Unlike *Reveal all* (which is itself a mode), toggling remembers whatever mode you were in and restores it.
* 💾 **Persisted state** — the current mode and the on/off state survive an Obsidian restart. (The original always reset to *Reveal on hover* on every start.)
* ⚙️ **Settings tab** — adds a settings panel (currently: the `N` for *Hard blur — N words*). The original had no settings.
* 🔁 **Cycle covers all modes** — left click / the cycle command now steps through all six modes: `Reveal all → Reveal on hover → Reveal never → Hard word → Hard char → Hard N words → …`

# Features
* 6️⃣ Modes (left click the status bar or use the cycle command to switch)
  * Reveal all: to disable the blurring completely
  * Reveal on hover: only show #private content on hover (default)
  * Reveal never: only show #private content for the currently editing line
  * Hard blur — word / char / N words: keep the editing line hidden, revealing only a small window around the caret (see [What's different from the original](#whats-different-from-the-original))
* 🔗 Blur also all links to #private files, or not, its your choice
* 💻 By default not visible when using screenshare! Keep your secrets :) (desktop-only)
* 📱 Supported on Obsidian Mobile
* 🎀 Commands to set visibility (also usable on mobile)
* ✅ Status bar indicator that shows the current state (desktop-only)
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
1. Install [Supercharged Links](https://github.com/mdelobelle/obsidian_supercharged_links) via the Settings Panel "Community Plugins"
2. Install this fork via [BRAT](https://github.com/TfTHacker/obsidian42-brat): add the beta plugin `kudrmax/obsidian-private-mode-enhanced`. (Or install the original [Private Mode](https://obsidian.md/plugins?id=private-mode) from Community Plugins if you don't need the fork's extras.)
3. Enable both plugins in the Settings panel "Community Plugins"
4. Go into the Settings Panel for "Supercharged Links" and make sure the "Enable in tab headers" is turned on. Otherwise the plugin will not blur your #private files in the editor.
5. (Optional) Adjust the `styles.scss`/`styles.css` to your liking
   * to compile the scss you can use sass `npm install -g sass` and `sass styles.scss styles.css`
6. Enable the two plugins in your Obsidian in the Settings panel "Community Plugins"

# Troubleshooting
* My file content is not hidden!
  * Make sure you have the Supercharged Links setting "Enable in tab headers" turned on. Also try turning that off and on again if it was on already. Sometimes Supercharged Links doesnt correctly tag the tab headers.

# Credits
Huge thanks to [Privacy Glasses](https://github.com/jillalberts/privacy-glasses/tree/master) for the groundwork and being licensed under MIT. Use that plugin if you want a more in depth configuration. I personally didn't need or want that much customization and overhead in my plugin. Also i found the "flickering" when opening any file to be too distracting, so i created a simpler version for myself.
