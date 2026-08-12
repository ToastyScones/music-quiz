# Playlist Builder — Progress Log

This document records the work done to add a Playlist Builder UI and the follow-up fixes applied during testing.

## Overview

Added an inline, collapsible **Playlist Builder** section to the music quiz site. Users can set per-video start times, reorder videos without editing the YouTube playlist, preview start times, and export/share an extended playlist URL format.

---

## New Files

| File | Purpose |
|------|---------|
| `music-quiz/scripts/playlist-url.js` | Parse/serialize playlist URLs, `mm:ss` time helpers, `t[N]` and `order` param handling |
| `music-quiz/scripts/playlist-builder.js` | Builder UI, drag reorder, preview, apply/copy URL, reset actions |

---

## Modified Files

| File | Changes |
|------|---------|
| `music-quiz/index.html` | Playlist Builder `<details>` section, script tags, chevron in summary, centered title/emote, **Randomize Order** button |
| `music-quiz/scripts/context.js` | `videoOrder`, `youtubePlaylistOrder`, `sourcePlaylistId`, builder/preview state, `isWaitingForQuizStart` |
| `music-quiz/scripts/index.js` | Custom-order player loading, quiz timer fixes, load/init flow for `order` URLs, `cuePlaylist` on load (no autoplay), builder highlight hook |
| `music-quiz/scripts/messages.js` | `isWaitingForQuizStart` flag set in `setQuizReadyDisplay()` |
| `music-quiz/styles/styles.css` | Builder list, drag handle, gap drop zones, drag ghost, now-playing row highlight, summary layout |
| `README.md` | Playlist Builder usage, extended URL format (`order=`) |

---

## Features Implemented

### Playlist Builder UI
- Collapsible section below **Load Playlist** (collapsed by default).
- Summary title and emote are **center-aligned**; chevron remains **left-aligned**.
- Per-video row: position, thumbnail, title (oEmbed), start time (`mm:ss` or seconds), Preview, ↑/↓, six-dot drag handle.
- **Apply to Quiz** — reloads player with current order and start times.
- **Copy URL** — copies generated shareable URL.
- **Reset Order** — restores YouTube playlist order (start times stay on correct videos by ID).
- **Randomize Order** — shuffles video order (start times stay on correct videos by ID); retries once if shuffle is unchanged.
- **Reset Start Times** — clears all start times.
- Read-only generated URL field.
- Chevron indicator: ▼ collapsed, ▲ expanded.
- **Now playing highlight** — while playback is active (not merely cued), the matching builder row gets a blue border/background. Matched by **video ID** so the correct row stays highlighted after reordering in the builder before Apply.

### Extended URL Format
- Base: `https://www.youtube.com/playlist?list=PLAYLIST_ID`
- Optional `order=vid1,vid2,vid3` — custom play order (comma-separated video IDs).
- Optional `t[N]=seconds` — start time for position N (1-based). When `order` is present, N refers to custom order; otherwise legacy YouTube playlist order.
- `order=` is included only when custom order differs from the original YouTube order.
- Legacy `watch?v=...&list=...&t1=...` URLs still load correctly.

### Custom Order Playback
- YouTube IFrame API loads a video-ID array via `cuePlaylist` / `loadPlaylist` so `nextVideo` / `previousVideo` follow custom order without changing the YouTube playlist.
- Initial **Load Playlist** uses `cuePlaylist` (not `loadPlaylist`) so the first video is cued but does not autoplay — user must press the green play button.

### Preview
- Available during an active quiz; acts like **Reveal Answer/Pause Quiz** (stops timers, shows current answer) then starts the selected video.
- Resets guess timer to configured settings (e.g. 20s), not leftover countdown values.
- Starts quiz from the guess phase with autoplay, blur, and seek to configured start time.

### Drag-and-Drop Reorder
- Draggable only from the six-dot handle (not the full row).
- Drop targets are the **gaps between rows** (`.playlist-builder-drop-zone`), not the rows themselves.
- A blue **line in the gap** indicates the insertion point (replaces prior row top/bottom inset highlights).
- List-level `dragover`/`drop` resolves the nearest gap from pointer position, so dragging over a row still targets the correct slot.
- Adjacent no-op positions (dropping a row in its current spot) show no indicator.
- Timestamps remap correctly when reordering.
- **Drag ghost** — full-row clone via `setDragImage()` (not just the handle). Source row fades to 50% opacity while dragging. Ghost uses high-contrast title styling (`.playlist-builder-drag-image .builder-title`) for readability under browser drag-preview fading.

### Live URL Updates
- Generated URL field updates when start times are edited (`input` / `change` on time fields).

---

## Quiz / Player Fixes

### Volume fade-out during early countdown
- **Cause:** Duplicate quiz timers after `seekTo` (no early return) and stale `lastGuessTimeLimitSeconds` (0) scheduling immediate fade.
- **Fix:** `clearQuizFutures()` before scheduling; `startQuizTimersIfPlaying()`; seek defers timer start by 300ms; `setNextVideoState()` clears `lastGuessTimeLimitSeconds`.

### Generated URL missing `order` after Apply
- **Cause:** `tryCompletePlaylistInit` overwrote `youtubePlaylistOrder` with the custom-order playlist after reload.
- **Fix:** Set `youtubePlaylistOrder` only on first capture (original YouTube order); never overwrite on custom reload.

### Load Playlist with `order` param — builder empty / wrong play order
- **Cause:** `isReloadingForCustomOrder` blocked init from completing; player could finish init while still on YouTube order.
- **Fix:** `pendingYoutubeOrderDiscovery` flow — capture YouTube order, then load custom order; set `videoOrder` immediately and render builder; init completes only when `getPlaylist()` matches `context.videoOrder`.

### First video error (code 2) on Load with custom order
- **Cause:** `cuePlaylist` on custom IDs while the YouTube playlist was still loading on the same player instance.
- **Fix:** After YouTube order discovery, **recreate the player** via `setNewYtPlayerFromOrder()` (clean load of custom IDs only). Suppress errors during transition with `isTransitioningToCustomOrder`.

### Load Playlist status message overwritten
- **Cause:** YouTube player `UNSTARTED` state called `setVideoUnstartedState()`, replacing `[Waiting for quiz to start]` with `(Starting next video)` after load.
- **Fix:** `isWaitingForQuizStart` flag — set in `setQuizReadyDisplay()`, cleared on first play; `setVideoUnstartedState()` preserves the waiting message while the flag is set.

---

## Load Flow (URL with `order` param)

1. Parse URL → set `context.videoOrder`, timestamps, `sourcePlaylistId`.
2. Render builder immediately with custom order.
3. Load YouTube playlist once to record `youtubePlaylistOrder` (`pendingYoutubeOrderDiscovery`).
4. Destroy/recreate player and cue only the custom video-ID list.
5. Complete init when player playlist matches `context.videoOrder`.

**Apply to Quiz** uses `reloadPlayerWithCurrentOrder()` on an already-initialized player (no destroy/recreate).

---

## Key Functions / State

| Symbol | Role |
|--------|------|
| `parsePlaylistInput()` / `buildPlaylistUrl()` | URL parse/serialize |
| `tryCompletePlaylistInit()` | Playlist ready handshake |
| `reloadPlayerWithCurrentOrder()` | Apply custom order to existing player |
| `setNewYtPlayerFromOrder()` | New player with video-ID array |
| `startQuizTimersIfPlaying()` | Start guess/post-quiz timers |
| `resetQuizCountdownToSettings()` | Full timer reset (preview, etc.) |
| `stopQuizLikeManualReveal()` | Shared manual-stop behavior |
| `randomizeBuilderOrder()` / `shuffleVideoOrder()` | Shuffle builder order, preserve per-video timestamps |
| `getCurrentPlayerVideoId()` / `updateBuilderPlayingHighlight()` | Highlight active row in builder by video ID |
| `createBuilderRowDragImage()` | Full-row drag ghost clone for `setDragImage()` |
| `createBuilderDropZone()` / `getBuilderInsertIndexFromPointer()` | Gap-based drop targeting |
| `isWaitingForQuizStart` | Suppresses next-video status text until quiz starts |

---

## Testing Notes

Manual verification targets:
- Load by playlist ID → builder populates; status shows `[Waiting for quiz to start]`; video does not autoplay.
- Load URL with `order` + `tN` → builder shows, plays custom order, counter starts at `1/N`.
- Apply / Copy URL after reorder → `order=` present when order differs from YouTube.
- Legacy URL with `t1`/`t3` only → YouTube order preserved.
- Preview during quiz → manual stop + full guess timer on play.
- No immediate audio fade in first seconds of countdown.
- Randomize Order → new order in builder; timestamps follow videos; Apply loads shuffled order.
- Reorder while playing → now-playing highlight tracks correct video by ID, not row index.
- Drag reorder → blue line appears between rows; ghost shows full row with readable title.

---

## Not Changed

- Plan file (`playlist_builder_ui_*.plan.md`) — reference only, not edited.
- Core quiz blur/fade/countdown logic structure (only timing/scheduling fixes).
- YouTube Data API — not used; titles via oEmbed, thumbnails via `img.youtube.com`.
