// Playlist queue: lets the user queue multiple YouTube playlists from the
// "YT Playlist URL or ID:" input and auto-advance to the next queued playlist
// (after a short countdown) when the current one finishes.
//
// UI: "Add to Queue" / "Play Queue" buttons in index.html (controls section).
// All functions here are global and cooperate with scripts/index.js:
//   - loadPlaylistFromParsed(parsed, autoPlay) is the shared load path used by
//     both a manual "Load Playlist" and an auto-advance.
//   - maybeAutoAdvanceToNextPlaylist() is called from setVideoEndedState().

var playlistQueue = [];
var queueIndex = -1;
var autoAdvanceTimerId = null;
var autoAdvanceSecondsLeft = 0;
var AUTO_ADVANCE_DELAY_SECONDS = 30;

function makeQueueLabel(parsed) {
  var label = parsed.playlistId || 'playlist';
  if (parsed.videoOrder) {
    label += ' (custom order)';
  }
  if (parsed.timestamps && Object.keys(parsed.timestamps).length > 0) {
    label += ' (start times)';
  }
  return label;
}

function addPlaylistToQueue() {
  var ytPlaylistIdOrUrl = document.getElementById('playlistIdText').value;
  var parsed = parsePlaylistInput(ytPlaylistIdOrUrl);

  if (parsed.error) {
    setLoadPlaylistError(parsed.error);
    return;
  }

  playlistQueue.push({ parsed: parsed, label: makeQueueLabel(parsed) });
  renderQueueList();
  document.getElementById('playlistIdText').value = '';
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
    var item = playlistQueue[i];

    var row = document.createElement('div');
    row.className = 'queue-item';

    var number = document.createElement('span');
    number.className = 'queue-number';
    number.textContent = String(i + 1);

    var label = document.createElement('span');
    label.className = 'queue-label';
    label.textContent = item.label;
    label.title = item.label;

    var removeButton = document.createElement('input');
    removeButton.type = 'button';
    removeButton.className = 'button queue-remove';
    removeButton.value = 'Remove';
    (function (index) {
      removeButton.onclick = function () {
        removePlaylistFromQueue(index);
      };
    })(i);

    row.appendChild(number);
    row.appendChild(label);
    row.appendChild(removeButton);
    container.appendChild(row);
  }
}

function removePlaylistFromQueue(index) {
  if (index < 0 || index >= playlistQueue.length) {
    return;
  }

  var countdownActive = autoAdvanceTimerId !== null;
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
  queueIndex = 0;
  clearAutoAdvanceTimers();
  loadPlaylistFromParsed(playlistQueue[0].parsed, true);
  // Note: the auto-advance countdown is NOT started here. It only begins when
  // the current (first) queued playlist ends, via setVideoEndedState() in
  // index.js -> maybeAutoAdvanceToNextPlaylist().
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
  clearAutoAdvanceTimers();
  autoAdvanceSecondsLeft = AUTO_ADVANCE_DELAY_SECONDS;
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
  var nextIndex = queueIndex + 1;
  if (nextIndex < 0 || nextIndex >= playlistQueue.length) {
    return;
  }
  queueIndex = nextIndex;
  loadPlaylistFromParsed(playlistQueue[nextIndex].parsed, true);
}

function clearAutoAdvanceTimers() {
  if (autoAdvanceTimerId !== null) {
    clearInterval(autoAdvanceTimerId);
    autoAdvanceTimerId = null;
  }
  autoAdvanceSecondsLeft = 0;
}
