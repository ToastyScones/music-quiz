// Playlist queue: lets the user queue multiple YouTube playlists from the
// "YT Playlist URL or ID:" input and auto-advance to the next queued playlist
// (after a short countdown) when the current one finishes.
//
// UI: "Add to Queue" / "Play Queue" buttons in index.html (controls section).
// All functions here are global and cooperate with scripts/index.js:
//   - loadPlaylistFromParsed(parsed, autoPlay) is the shared load path used by
//     both a manual "Load Playlist" and an auto-advance.
//   - maybeAutoAdvanceToNextPlaylist() is called when "End of playlist" is
//     displayed (setGuessAsFinished in index.js), not when the video ends.

var playlistQueue = [];
var queueIndex = -1;
var autoAdvanceTimerId = null;
var autoAdvanceSecondsLeft = 0;
var autoAdvancePaused = false;
var autoAdvancePausedSeconds = 0;

// Whether the queue thumbnails are blurred. The checkbox in index.html
// tracks this across re-renders.
var queueThumbsBlurred = true;

// Blur every queue thumbnail in the list. Called whenever the queue
// re-renders and when the user toggles the checkbox.
function applyQueueThumbBlur() {
  var thumbs = document.querySelectorAll('.queue-thumb');
  for (var i = 0; i < thumbs.length; i++) {
    thumbs[i].style.filter = queueThumbsBlurred ? 'blur(3px)' : 'blur(0px)';
  }
}

// Tied to the "Blur queue thumbnails" checkbox in index.html.
function toggleQueueThumbBlur(checkbox) {
  queueThumbsBlurred = !!checkbox.checked;
  applyQueueThumbBlur();
}

function makeQueueLabel(title, parsed) {
  var label = title || 'playlist';
  if (parsed.videoOrder) {
    label += ' (custom order)';
  }
  if (parsed.timestamps && Object.keys(parsed.timestamps).length > 0) {
    label += ' (start times)';
  }
  return label;
}

async function addPlaylistToQueue() {
  clearError();
  var ytPlaylistIdOrUrl = document.getElementById('playlistIdText').value;
  var parsed = parsePlaylistInput(ytPlaylistIdOrUrl);

  if (parsed.error) {
    setLoadPlaylistError(parsed.error);
    return;
  }

  var item = {
    parsed: parsed,
    title: 'Adding playlist...',
    author: null,
    thumbnail: null,
    metaLoaded: false,
    pending: true
  };

  // The Add to Queue button is disabled and a temporary queue item is shown
  // for the duration of the add. The button is re-enabled at the end of this
  // function, whether the add succeeds or errors out.
  var addQueueButton = document.getElementById('addQueueButton');
  addQueueButton.disabled = true;
  // Capture the final-finished state before pushing the temp item, because
  // adding an item to the queue changes playlistQueue.length and would make
  // isFinalFinishedState() report false.
  var wasInFinalFinishedState = isFinalFinishedState();
  playlistQueue.push(item);
  renderQueueList();

  // The playlist is only added to the queue if its metadata can be fetched
  // via the oEmbed REST request. On failure the temporary queue item is
  // removed and the input is left intact so the user can retry, and an error
  // is displayed instead of queuing the item.
  var metaLoaded = await fetchPlaylistMetadata(parsed.playlistId, item);

  if (metaLoaded) {
    item.pending = false;
    document.getElementById('playlistIdText').value = '';

    if (wasInFinalFinishedState) {
      // The quiz was in the final finished state (last playlist, last video,
      // and the end-of-playlist message displayed with no upcoming playlists).
      // Now that a new playlist has been added, automatically start the
      // countdown to load it.
      maybeAutoAdvanceToNextPlaylist();
    }
  } else {
    // Error out: remove the temporary queue item so the queue only reflects
    // playlists that were actually added.
    var tempIndex = playlistQueue.indexOf(item);
    if (tempIndex !== -1) {
      playlistQueue.splice(tempIndex, 1);
    }
  }

  // Re-enable the Add to Queue button and refresh the queue display.
  addQueueButton.disabled = false;
  renderQueueList();
}

function isFinalFinishedState() {
  // The quiz is "final finished" when it is on its last playlist (no
  // upcoming queued playlists), on its last video, and the end-of-playlist
  // message is displayed. In that state a countdown to the next playlist
  // cannot start until another playlist is added.
  return context.isQuizForPlaylistDone &&
    isEndOfPlaylist() &&
    queueIndex >= 0 &&
    queueIndex + 1 >= playlistQueue.length;
}

async function fetchPlaylistMetadata(playlistId, item) {
  var url = 'https://www.youtube.com/oembed?url=https://www.youtube.com/playlist?list=' +
    encodeURIComponent(playlistId) + '&format=json';

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('oEmbed failed');
    }
    const data = await response.json();
    item.title = data.title;
    item.author = data.author_name;
    item.thumbnail = data.thumbnail_url;
    item.metaLoaded = true;
    const result = await validateYouTubePlaylist(playlistId);
    // For some reason, loadPlaylist and cuePlaylist won't return an error if embed is disabled
    //  in the first video or the playlist as a whole. We need to do one last check and validate
    //  here before inserting into the queue. 
    if (!result.isValid) {
      setLoadPlaylistError('Could not add YouTube playlist. ' +
        'The video owner does not allow it to be embedded.');
      return false;
    }
    return true;
  } catch {
    setLoadPlaylistError('Could not add YouTube playlist. ' +
      'Make sure the playlist ID/URL is correct and the playlist is public.');
    return false;
  }
}

function validateYouTubePlaylist(playlistId) {
  return new Promise((resolve) => {
    const containerId = `yt-val-${Math.random().toString(36).substr(2, 9)}`;
    const div = document.createElement('div');
    div.id = containerId;
    div.style.cssText = "width:1px;height:1px;opacity:0;position:absolute;pointer-events:none;";
    document.body.appendChild(div);

    let player = null;
    let isResolved = false;
    let errorTimeout = null;

    // The single exit point ensuring proper cleanup
    const finalize = (isValid, message) => {
      if (isResolved) return; // Prevent double execution
      isResolved = true;

      if (errorTimeout) clearTimeout(errorTimeout);

      try {
        if (player && typeof player.destroy === 'function') {
          player.destroy();
        }
      } catch (err) {
        console.error("Error during player destruction:", err);
      } finally {
        player = null;
        const el = document.getElementById(containerId);
        if (el) el.remove();
        resolve({ isValid, message });
      }
    };

    const playerConfig = {
      height: '1',
      width: '1',
      playerVars: {
        listType: 'playlist',
        list: playlistId,
        autoplay: 0,
        mute: 1,
        controls: 0,
        showinfo: 0,
        rel: 0
      },
      events: {
        'onReady': (event) => {
          try {
            if (typeof event.target.setPlaybackQuality === 'function') {
              event.target.setPlaybackQuality('small'); 
            }

            const playlistData = event.target.getPlaylist();
            
            // Check structural layout arrays
            if (!playlistData || playlistData.length === 0) {
              finalize(false, "Playlist is empty or private.");
              return;
            }

            // DELAY RESOLUTION: Give onError a brief window (250ms) to intercept
            errorTimeout = setTimeout(() => {
              finalize(true, "Playlist is valid.");
            }, 250);

          } catch (err) {
            finalize(false, `Processing error: ${err.message}`);
          }
        },
        'onError': (event) => {
          finalize(false, `YouTube API Error Code: ${event.data}`);
        }
      }
    };

    try {
      if (typeof YT !== 'undefined' && YT.Player) {
        player = new YT.Player(containerId, playerConfig);
      } else {
        finalize(false, "YouTube API script not loaded yet.");
      }
    } catch (err) {
      finalize(false, `Initialization failed: ${err.message}`);
    }
  });
}


function renderQueueList() {
  var container = document.getElementById('playlistQueueList');
  if (!container) {
    return;
  }
  container.innerHTML = '';

  if (playlistQueue.length === 0) {
    return;
  }

  for (var i = 0; i < playlistQueue.length; i++) {
    (function (i) {
      var item = playlistQueue[i];

      var row = document.createElement('div');
      row.className = 'queue-item';
      if (i === queueIndex) {
        row.classList.add('now-playing');
      }

      var number = document.createElement('span');
      number.className = 'queue-number';
      number.textContent = String(i + 1);

      var thumb = document.createElement('img');
      thumb.className = 'queue-thumb';
      thumb.alt = '';
      if (item.thumbnail) {
        thumb.src = item.thumbnail;
      }
      // The wrapper clips the blurred image so the blur does not bleed
      // past the thumbnail's boundary.
      var thumbWrap = document.createElement('div');
      thumbWrap.className = 'queue-thumb-wrap';
      thumbWrap.appendChild(thumb);

      var info = document.createElement('div');
      info.className = 'queue-info';

      var title = document.createElement('div');
      title.className = 'queue-title';
      title.textContent = item.title;
      title.title = item.title;

      var author = document.createElement('div');
      author.className = 'queue-author';
      if (item.author) {
        author.textContent = item.author;
        author.title = item.author;
      } else {
        author.style.display = 'none';
      }

      info.appendChild(title);
      info.appendChild(author);

      var playButton = document.createElement('input');
      playButton.type = 'button';
      playButton.className = 'queue-play';
      playButton.title = 'Play this playlist';
      // While the playlist is still being added (pending), render the play
      // button but keep it disabled so the user cannot start a playlist
      // whose metadata has not loaded yet.
      playButton.disabled = item.pending;
      playButton.onclick = function () {
        loadPlaylistAtIndex(i);
      };

      var removeButton = document.createElement('input');
      removeButton.type = 'button';
      removeButton.className = 'button queue-remove';
      removeButton.value = 'Remove';
      // Remove is disabled only while the playlist is still being added
      // (pending). It is enabled for the currently-playing playlist too:
      // removing it detaches that playlist from the queue (it keeps playing
      // in the player) and cancels any pending auto-advance.
      removeButton.disabled = item.pending;
      removeButton.onclick = function () {
        // Final-confirmation popup: greys out the page and asks the user
        // to confirm. The item is removed only if they click Yes;
        // otherwise no action is taken.
        openRemoveQueuePopup(i, item.title);
      };

      row.appendChild(number);
      row.appendChild(thumbWrap);
      row.appendChild(info);
      row.appendChild(playButton);
      row.appendChild(removeButton);
      container.appendChild(row);
    })(i);
  }
  applyQueueThumbBlur();
}

function isAutoAdvanceCountdownActive() {
  // Active means either an interval is ticking OR the countdown is paused
  // mid-way (a pending advance that will resume). This lets the remove
  // path cancel a paused countdown immediately too.
  return autoAdvanceTimerId !== null || autoAdvancePaused;
}

function removePlaylistFromQueue(index) {
  if (index < 0 || index >= playlistQueue.length) {
    return;
  }

  // Removing the currently-playing playlist detaches it from the queue: it
  // keeps playing in the player (no auto-advance will fire, since queueIndex
  // becomes -1 and maybeAutoAdvanceToNextPlaylist() bails on queueIndex < 0),
  // but the player state and the queue list both reflect that it is no
  // longer part of the queue.
  var removingCurrent = index === queueIndex;

  var countdownActive = isAutoAdvanceCountdownActive();
  playlistQueue.splice(index, 1);
  if (queueIndex >= 0 && index < queueIndex) {
    queueIndex--;
  } else if (removingCurrent) {
    // The current item is gone, so there is no "now playing" queued playlist
    // anymore. Detach the player from the queue.
    queueIndex = -1;
    context.detachedFromPlaylist = true;
  }

  var hasNext = queueIndex >= 0 && queueIndex + 1 < playlistQueue.length;
  if (countdownActive && !hasNext) {
    clearAutoAdvanceTimers();
  }

  renderQueueList();
}

function openRemoveQueuePopup(index, playlistTitle) {
  // Grey out the page and show a final-confirmation popup before the
  // removal happens. Only clicking "Yes" performs the removal.
  var popup = document.createElement('div');
  popup.className = 'remove-popup';
  popup.id = 'remove-queue-popup';

  var title = document.createElement('h4');
  title.className = 'remove-popup-title';
  title.textContent = 'Remove "' + playlistTitle + '" from queue?';

  var message = document.createElement('p');
  message.className = 'remove-popup-message';
  message.textContent = 'This action cannot be undone.';

  var yesButton = document.createElement('button');
  yesButton.type = 'button';
  yesButton.className = 'button remove-popup-yes';
  yesButton.textContent = 'Yes';
  yesButton.onclick = function () {
    closeRemoveQueuePopup();
    removePlaylistFromQueue(index);
  };

  var noButton = document.createElement('button');
  noButton.type = 'button';
  noButton.className = 'button remove-popup-no';
  noButton.textContent = 'No';
  noButton.onclick = function () {
    closeRemoveQueuePopup();
  };

  popup.appendChild(title);
  popup.appendChild(message);
  var buttons = document.createElement('div');
  buttons.className = 'remove-popup-buttons';
  buttons.appendChild(yesButton);
  buttons.appendChild(noButton);
  popup.appendChild(buttons);

  var overlay = document.createElement('div');
  overlay.className = 'remove-popup-overlay';
  overlay.id = 'remove-queue-popup-overlay';
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
}

function closeRemoveQueuePopup() {
  var overlay = document.getElementById('remove-queue-popup-overlay');
  if (overlay) {
    overlay.parentNode.removeChild(overlay);
  }
}

function playQueue() {
  if (playlistQueue.length === 0) {
    setLoadPlaylistError('Queue is empty. Add some playlists first.');
    return;
  }
  clearError();
  queueIndex = 0;
  renderQueueList();
  clearAutoAdvanceTimers();
  // Start the quiz immediately: autoPlay = true plays the first queued
  // playlist right away (same as the per-item "play" button in the queue
  // list), so the first video starts and the quiz begins without the user
  // having to click the green play button. The auto-advance countdown is
  // NOT started here; it only begins when "End of playlist" is displayed
  // (setGuessAsFinished in index.js).
  loadPlaylistFromParsed(playlistQueue[0].parsed, true);
}

function loadPlaylistFromParsed(parsed, autoPlay) {
  pendingAutoPlay = autoPlay;

  context.resetBuilderState();
  context.vidTimestamps = parsed.timestamps;
  context.sourcePlaylistId = parsed.playlistId;
  // A freshly loaded playlist is attached to the queue again, so a
  // previously-detached state never carries over into the next playlist.
  context.detachedFromPlaylist = false;
  context.needLastVolumeApplied = false;

  if (parsed.videoOrder) {
    context.videoOrder = parsed.videoOrder.slice();
    pendingYoutubeOrderDiscovery = true;
    isTransitioningToCustomOrder = false;
  } else {
    context.videoOrder = null;
    pendingYoutubeOrderDiscovery = false;
  }

  showBuilderEmptyState();
  if (context.videoOrder) {
    renderBuilderList();
  }

  clearError();
  clearStateForNextVideo();
  clearPlaylistCounter();

  if (autoPlay) {
    context.isWaitingForQuizStart = false;
    setQuizStartingDisplay();
    // The autoPlay branch is taken when the user presses the play button
    // in the queue (loadPlaylistAtIndex) or when auto-advancing to the next
    // playlist, neither of which calls setQuizReadyDisplay(). Without this,
    // the #quiz-status section stays at its CSS default (display: none) and
    // never reappears after a fresh queue load.
    document.getElementById('quiz-status').style.display = 'flex';
  } else {
    setQuizReadyDisplay();
  }

  setNewYtPlayerFromPlaylistId(parsed.playlistId);
}

function maybeAutoAdvanceToNextPlaylist() {
  if (queueIndex < 0) {
    return;
  }
  if (queueIndex + 1 >= playlistQueue.length) {
    clearAutoAdvanceTimers();
    return;
  }
  startAutoAdvanceCountdown();
}

function startAutoAdvanceCountdown() {
  // If the countdown was paused (e.g. the user paused the video), resume
  // from where it left off instead of restarting from the full delay.
  // Capture this BEFORE clearAutoAdvanceTimers below resets the flags.
  // The delay is configurable via the "Auto-advance delay between
  // playlists" setting in index.html (context.autoAdvanceDelaySeconds).
  var resumeFrom = (autoAdvancePaused && autoAdvancePausedSeconds > 0)
    ? autoAdvancePausedSeconds
    : context.autoAdvanceDelaySeconds;
  clearAutoAdvanceTimers();
  autoAdvanceSecondsLeft = resumeFrom;
  setNextPlaylistDisplay('Next playlist in: ' + getSecondsMessage(autoAdvanceSecondsLeft));

  // If the just-finished playlist's video is still playing, fade its audio
  // out over context.fadeOutMs (the same pattern used by nextVideoAfterQuiz
  // when advancing to the next video within a playlist) so it is nearly
  // silent by the time the next playlist auto-loads. The fade starts once
  // the countdown reaches the final fadeOutMs so the current audio plays at
  // full volume for the rest of the countdown; if the countdown is shorter
  // than fadeOutMs it starts immediately. This only applies to auto-advance
  // (autoplay); manual loads (the queue play button / loadPlaylistAtIndex)
  // keep the existing no-fade behavior.
  var fadeStarted = false;
  var fadeStartSeconds = Math.min(resumeFrom, Math.ceil(context.fadeOutMs / 1000));
  var startPlaylistFadeOut = function () {
    if (!fadeStarted && isVideoPlaying()) {
      fadeStarted = true;
      startVolumeFadeOut();
    }
  };
  if (autoAdvanceSecondsLeft <= fadeStartSeconds) {
    startPlaylistFadeOut();
  }

  autoAdvanceTimerId = setInterval(function () {
    autoAdvanceSecondsLeft--;
    if (autoAdvanceSecondsLeft <= 0) {
      // Stop the interval BEFORE loading so it cannot fire again and
      // auto-advance a second time (or dangle forever).
      clearAutoAdvanceTimers();
      loadNextQueuedPlaylist();
      return;
    }
    if (autoAdvanceSecondsLeft <= fadeStartSeconds) {
      startPlaylistFadeOut();
    }
    setNextPlaylistDisplay('Next playlist in: ' + getSecondsMessage(autoAdvanceSecondsLeft));
  }, 1000);
  // The countdown is now active, so reveal the dedicated pause/resume
  // button (and label it for the "pause" action since we just started).
  showCountdownToggleButton();
}

// The #countdownToggleButton is only visible while an auto-advance
// countdown is active (ticking) or user-paused. It is hidden by
// clearAutoAdvanceTimers(), which fires whenever a new video or playlist
// is loaded (the shared load path), the last queued playlist finishes, or
// the queue is emptied.
function showCountdownToggleButton() {
  var btn = document.getElementById('countdownToggleButton');
  btn.style.display = 'block';
  btn.value = autoAdvancePaused ? 'Resume countdown' : 'Pause countdown';
}

function hideCountdownToggleButton() {
  var btn = document.getElementById('countdownToggleButton');
  btn.style.display = 'none';
}

function loadNextQueuedPlaylist() {
  queueIndex++;
  renderQueueList();
  loadPlaylistFromParsed(playlistQueue[queueIndex].parsed, true);
}

function loadPlaylistAtIndex(index) {
  if (index < 0 || index >= playlistQueue.length) {
    return;
  }
  clearAutoAdvanceTimers();
  queueIndex = index;
  renderQueueList();
  loadPlaylistFromParsed(playlistQueue[index].parsed, true);
}

function clearAutoAdvanceTimers() {
  if (autoAdvanceTimerId !== null) {
    clearInterval(autoAdvanceTimerId);
    autoAdvanceTimerId = null;
  }
  autoAdvanceSecondsLeft = 0;
  // Definitive teardown: also drop any paused state so a stale
  // "paused" flag cannot survive and fire on a later video-resume.
  autoAdvancePaused = false;
  autoAdvancePausedSeconds = 0;
  clearNextPlaylistDisplay();
  // The countdown is no longer active (neither ticking nor user-paused),
  // so the dedicated pause/resume button is hidden until the next countdown
  // is triggered. This is what clears/disables it on a manual load.
  hideCountdownToggleButton();
}

function pauseAutoAdvanceCountdown() {
  if (!isAutoAdvanceCountdownActive()) {
    return;
  }
  // Remember how long was left so a resume can pick up where it left off.
  var remaining = autoAdvanceSecondsLeft;
  clearAutoAdvanceTimers();
  autoAdvancePaused = true;
  autoAdvancePausedSeconds = remaining;
  // Keep the button visible while paused so the user can resume; the label
  // flips to "Resume countdown" because autoAdvancePaused is now true.
  showCountdownToggleButton();
  setNextPlaylistDisplay('(Next playlist countdown paused)')
}

function resumeAutoAdvanceCountdown() {
  if (!autoAdvancePaused) {
    return;
  }
  // Only resume if there is actually a next queued playlist to advance to;
  // otherwise drop the paused state so it cannot fire later.
  if (queueIndex < 0 || queueIndex + 1 >= playlistQueue.length) {
    autoAdvancePaused = false;
    autoAdvancePausedSeconds = 0;
    return;
  }
  startAutoAdvanceCountdown();
}

// User-facing toggle for the dedicated pause/resume button
// (#countdownToggleButton). The button is only ever rendered while the
// auto-advance countdown is active (ticking) or user-paused, so this guard
// keeps it from misfiring if the DOM state ever drifts out of sync.
function toggleCountdownPause() {
  if (!isAutoAdvanceCountdownActive()) {
    return;
  }
  if (autoAdvancePaused) {
    resumeAutoAdvanceCountdown();
  } else {
    pauseAutoAdvanceCountdown();
  }
}
