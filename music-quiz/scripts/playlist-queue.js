// Playlist queue: lets the user queue multiple YouTube playlists from the
// "YT Playlist URL or ID:" input and auto-advance to the next queued playlist
// (after a short countdown) when the current one finishes.
//
// UI: "Add to Queue" / "Load Queue" buttons in index.html (controls section).
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
var AUTO_ADVANCE_DELAY_SECONDS = 30;

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

function fetchPlaylistMetadata(item, onDone) {
  if (!YOUTUBE_API_KEY) {
    if (onDone) { onDone(null); }
    return;
  }

  var url = 'https://www.googleapis.com/youtube/v3/playlists?part=snippet'
    + '&key=' + YOUTUBE_API_KEY
    + '&id=' + encodeURIComponent(item.parsed.playlistId);

  fetch(url)
    .then(function (res) {
      if (!res.ok) { throw new Error('HTTP ' + res.status); }
      return res.json();
    })
    .then(function (data) {
      var snippet = null;
      if (data && data.items && data.items.length > 0) {
        snippet = data.items[0].snippet;
      }
      if (onDone) { onDone(snippet); }
    })
    .catch(function () {
      if (onDone) { onDone(null); }
    });
}

function addPlaylistToQueue() {
  clearError();
  var ytPlaylistIdOrUrl = document.getElementById('playlistIdText').value;
  var parsed = parsePlaylistInput(ytPlaylistIdOrUrl);

  if (parsed.error) {
    setLoadPlaylistError(parsed.error);
    return;
  }

  var item = {
    parsed: parsed,
    title: makeQueueLabel(parsed.playlistId, parsed),
    author: null,
    thumbnail: parsed.firstVideoId
      ? 'https://i.ytimg.com/vi/' + parsed.firstVideoId + '/default.jpg'
      : null,
    metaLoaded: false
  };
  playlistQueue.push(item);
  renderQueueList();
  document.getElementById('playlistIdText').value = '';

  fetchPlaylistMetadata(item, function (snippet) {
    if (snippet) {
      item.title = makeQueueLabel(snippet.title, item.parsed);
      item.author = snippet.channelTitle || null;
      var thumb = null;
      if (snippet.thumbnail) {
        if (typeof snippet.thumbnail === 'string') {
          thumb = snippet.thumbnail;
        } else if (snippet.thumbnail.default && snippet.thumbnail.default.url) {
          thumb = snippet.thumbnail.default.url;
        }
      }
      if (thumb) {
        item.thumbnail = thumb;
      }
      item.metaLoaded = true;
    }
    renderQueueList();
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
      } else {
        thumb.style.display = 'none';
      }

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

      var removeButton = document.createElement('input');
      removeButton.type = 'button';
      removeButton.className = 'button queue-remove';
      removeButton.value = 'Remove';
      removeButton.onclick = function () {
        removePlaylistFromQueue(i);
      };

      row.appendChild(number);
      row.appendChild(thumb);
      row.appendChild(info);
      row.appendChild(removeButton);
      container.appendChild(row);
    })(i);
  }
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

  var countdownActive = isAutoAdvanceCountdownActive();
  playlistQueue.splice(index, 1);
  if (queueIndex >= 0 && index < queueIndex) {
    queueIndex--;
  }

  var hasNext = queueIndex >= 0 && queueIndex + 1 < playlistQueue.length;
  if (countdownActive && !hasNext) {
    clearAutoAdvanceTimers();
  }

  renderQueueList();
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
  // Behave like the old "Load Playlist": cue the first queued playlist
  // (autoPlay = false) so the user then starts the quiz with the green play
  // button. The auto-advance countdown is NOT started here; it only begins
  // when "End of playlist" is displayed (setGuessAsFinished in index.js).
  loadPlaylistFromParsed(playlistQueue[0].parsed, false);
}

function loadPlaylistFromParsed(parsed, autoPlay) {
  pendingAutoPlay = autoPlay;

  context.resetBuilderState();
  context.vidTimestamps = parsed.timestamps;
  context.sourcePlaylistId = parsed.playlistId;
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
    setQuizStatusDisplay('Loading next playlist...');
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
  var resumeFrom = (autoAdvancePaused && autoAdvancePausedSeconds > 0)
    ? autoAdvancePausedSeconds
    : AUTO_ADVANCE_DELAY_SECONDS;
  clearAutoAdvanceTimers();
  autoAdvanceSecondsLeft = resumeFrom;
  setQuizStatusDisplay('Next playlist in: ' + getSecondsMessage(autoAdvanceSecondsLeft));
  autoAdvanceTimerId = setInterval(function () {
    autoAdvanceSecondsLeft--;
    if (autoAdvanceSecondsLeft <= 0) {
      // Stop the interval BEFORE loading so it cannot fire again and
      // auto-advance a second time (or dangle forever).
      clearAutoAdvanceTimers();
      loadNextQueuedPlaylist();
      return;
    }
    setQuizStatusDisplay('Next playlist in: ' + getSecondsMessage(autoAdvanceSecondsLeft));
  }, 1000);
}

function loadNextQueuedPlaylist() {
  queueIndex++;
  renderQueueList();
  loadPlaylistFromParsed(playlistQueue[queueIndex].parsed, true);
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
