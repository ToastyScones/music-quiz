var builderTitles = {};

function initPlaylistBuilder() {
  document.getElementById('applyBuilderButton').onclick = applyBuilderToQuiz;
  document.getElementById('copyBuilderUrlButton').onclick = copyBuilderUrl;
  document.getElementById('resetBuilderOrderButton').onclick = resetBuilderOrder;
  document.getElementById('randomizeBuilderOrderButton').onclick = randomizeBuilderOrder;
  document.getElementById('resetBuilderStartTimesButton').onclick = resetBuilderStartTimes;
}

function showBuilderEmptyState() {
  document.getElementById('playlist-builder-empty').style.display = 'block';
  document.getElementById('playlist-builder-content').style.display = 'none';
  document.getElementById('playlist-builder-list').innerHTML = '';
}

function showBuilderContent() {
  document.getElementById('playlist-builder-empty').style.display = 'none';
  document.getElementById('playlist-builder-content').style.display = 'block';
}

function getTimestampsFromBuilderUI() {
  var timestamps = {};
  var rows = document.querySelectorAll('.playlist-builder-row');

  rows.forEach(function (row) {
    var index = Number(row.dataset.index);
    var input = row.querySelector('.builder-start-time');
    var seconds = parseTimeInput(input.value);

    if (seconds !== null && seconds > 0) {
      timestamps[index] = seconds;
    }
  });

  return timestamps;
}

function createDragHandle() {
  var dragHandle = document.createElement('span');
  dragHandle.className = 'builder-drag-handle';
  dragHandle.title = 'Drag to reorder';
  dragHandle.draggable = true;

  for (var i = 0; i < 6; i++) {
    var dot = document.createElement('span');
    dot.className = 'builder-drag-dot';
    dragHandle.appendChild(dot);
  }

  dragHandle.addEventListener('dragstart', onBuilderDragStart);
  dragHandle.addEventListener('dragend', onBuilderDragEnd);

  return dragHandle;
}

function renderBuilderList() {
  if (!context.videoOrder || context.videoOrder.length === 0) {
    showBuilderEmptyState();
    return;
  }

  showBuilderContent();
  var listEl = document.getElementById('playlist-builder-list');
  listEl.innerHTML = '';

  context.videoOrder.forEach(function (videoId, index) {
    var row = document.createElement('div');
    row.className = 'playlist-builder-row';
    row.dataset.index = String(index);
    row.dataset.videoId = videoId;

    var position = document.createElement('span');
    position.className = 'builder-position';
    position.textContent = String(index + 1);

    var thumb = document.createElement('img');
    thumb.className = 'builder-thumb';
    thumb.src = 'https://img.youtube.com/vi/' + videoId + '/default.jpg';
    thumb.alt = '';

    var title = document.createElement('span');
    title.className = 'builder-title';
    title.textContent = builderTitles[videoId] || videoId;

    var timeLabel = document.createElement('label');
    timeLabel.className = 'builder-time-label';
    timeLabel.textContent = 'Start:';

    var timeInput = document.createElement('input');
    timeInput.type = 'text';
    timeInput.className = 'builder-start-time';
    timeInput.placeholder = 'mm:ss';
    timeInput.size = 6;
    var startSeconds = context.vidTimestamps[index];
    timeInput.value = startSeconds ? formatSecondsAsMmSs(startSeconds) : '';
    timeInput.addEventListener('input', updateBuilderUrlField);
    timeInput.addEventListener('change', updateBuilderUrlField);

    var previewBtn = document.createElement('input');
    previewBtn.type = 'button';
    previewBtn.className = 'button builder-preview-btn';
    previewBtn.value = 'Preview/Skip To';
    previewBtn.onclick = function () { previewVideoAtIndex(index); };

    var reorderControls = document.createElement('div');
    reorderControls.className = 'builder-reorder-controls';

    var upBtn = document.createElement('input');
    upBtn.type = 'button';
    upBtn.className = 'button builder-move-btn';
    upBtn.value = '↑';
    upBtn.disabled = index === 0;
    upBtn.onclick = function () { moveVideo(index, index - 1); };

    var downBtn = document.createElement('input');
    downBtn.type = 'button';
    downBtn.className = 'button builder-move-btn';
    downBtn.value = '↓';
    downBtn.disabled = index === context.videoOrder.length - 1;
    downBtn.onclick = function () { moveVideo(index, index + 1); };

    var dragHandle = createDragHandle();

    reorderControls.appendChild(upBtn);
    reorderControls.appendChild(downBtn);
    reorderControls.appendChild(dragHandle);

    row.appendChild(position);
    row.appendChild(thumb);
    row.appendChild(title);
    row.appendChild(timeLabel);
    row.appendChild(timeInput);
    row.appendChild(previewBtn);
    row.appendChild(reorderControls);

    row.addEventListener('dragover', onBuilderDragOver);
    row.addEventListener('dragleave', onBuilderDragLeave);
    row.addEventListener('drop', onBuilderDrop);

    listEl.appendChild(row);
  });

  updateBuilderUrlField();
  fetchVideoTitles(context.videoOrder);
  updateBuilderPlayingHighlight();
}

function isQuizRunning() {
  if (!player || !isPlaylistInitialized()) {
    return false;
  }

  return !context.isQuizManuallyStopped &&
    !context.isQuizForPlaylistDone &&
    document.getElementById('player').style.filter.includes('blur');
}

var builderDragSourceIndex = null;
var builderDragSourceRow = null;

function onBuilderDragStart(event) {
  var row = event.target.closest('.playlist-builder-row');
  if (!row) {
    return;
  }

  builderDragSourceIndex = Number(row.dataset.index);
  builderDragSourceRow = row;
  row.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', row.dataset.videoId);
}

function clearDropIndicators() {
  document.querySelectorAll('.playlist-builder-row').forEach(function (row) {
    row.classList.remove('drop-target-before', 'drop-target-after');
    delete row.dataset.dropPosition;
  });
}

function onBuilderDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';

  var row = event.currentTarget;
  if (!builderDragSourceRow || row === builderDragSourceRow) {
    return;
  }

  var rect = row.getBoundingClientRect();
  var insertBefore = event.clientY < rect.top + rect.height / 2;

  clearDropIndicators();
  row.classList.add(insertBefore ? 'drop-target-before' : 'drop-target-after');
  row.dataset.dropPosition = insertBefore ? 'before' : 'after';
}

function onBuilderDragLeave(event) {
  var row = event.currentTarget;
  if (!row.contains(event.relatedTarget)) {
    row.classList.remove('drop-target-before', 'drop-target-after');
    delete row.dataset.dropPosition;
  }
}

function onBuilderDrop(event) {
  event.preventDefault();

  var targetRow = event.currentTarget;
  var targetIndex = Number(targetRow.dataset.index);
  var insertBefore = targetRow.dataset.dropPosition === 'before';

  clearDropIndicators();

  if (builderDragSourceIndex === null) {
    return;
  }

  var toIndex = insertBefore ? targetIndex : targetIndex + 1;
  if (builderDragSourceIndex < toIndex) {
    toIndex--;
  }

  if (builderDragSourceIndex !== toIndex) {
    moveVideo(builderDragSourceIndex, toIndex);
  }
}

function onBuilderDragEnd() {
  if (builderDragSourceRow) {
    builderDragSourceRow.classList.remove('dragging');
  }
  builderDragSourceIndex = null;
  builderDragSourceRow = null;
  clearDropIndicators();
}

function moveVideo(fromIndex, toIndex) {
  if (fromIndex === toIndex) {
    return;
  }

  var timestampsBeforeMove = getTimestampsFromBuilderUI();
  var order = context.videoOrder.slice();
  var movedId = order[fromIndex];
  order.splice(fromIndex, 1);
  order.splice(toIndex, 0, movedId);

  var newTimestamps = {};
  order.forEach(function (videoId, newIndex) {
    var oldIndex = context.videoOrder.indexOf(videoId);
    if (timestampsBeforeMove[oldIndex]) {
      newTimestamps[newIndex] = timestampsBeforeMove[oldIndex];
    }
  });

  context.videoOrder = order;
  context.vidTimestamps = newTimestamps;
  renderBuilderList();
}

function fetchVideoTitles(videoIds) {
  var concurrency = 5;
  var queue = videoIds.filter(function (id) { return !builderTitles[id]; });
  var active = 0;
  var index = 0;

  function next() {
    while (active < concurrency && index < queue.length) {
      var videoId = queue[index++];
      active++;
      fetchVideoTitle(videoId).finally(function () {
        active--;
        next();
      });
    }
  }

  next();
}

function fetchVideoTitle(videoId) {
  var url = 'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=' +
    encodeURIComponent(videoId) + '&format=json';

  return fetch(url)
    .then(function (response) {
      if (!response.ok) {
        throw new Error('oEmbed failed');
      }
      return response.json();
    })
    .then(function (data) {
      builderTitles[videoId] = data.title;
      var titleEl = document.querySelector('.playlist-builder-row[data-video-id="' + videoId + '"] .builder-title');
      if (titleEl) {
        titleEl.textContent = data.title;
      }
    })
    .catch(function () {
      builderTitles[videoId] = videoId;
    });
}

function getTimestampsByVideoIdFromBuilderUI() {
  var timestampsByVideoId = {};
  var rows = document.querySelectorAll('.playlist-builder-row');

  rows.forEach(function (row) {
    var videoId = row.dataset.videoId;
    var seconds = parseTimeInput(row.querySelector('.builder-start-time').value);

    if (seconds !== null && seconds > 0) {
      timestampsByVideoId[videoId] = seconds;
    }
  });

  return timestampsByVideoId;
}

function resetBuilderOrder() {
  if (!context.youtubePlaylistOrder || !context.videoOrder) {
    return;
  }

  var timestampsByVideoId = getTimestampsByVideoIdFromBuilderUI();
  context.videoOrder = context.youtubePlaylistOrder.slice();
  context.vidTimestamps = {};

  context.videoOrder.forEach(function (videoId, index) {
    if (timestampsByVideoId[videoId]) {
      context.vidTimestamps[index] = timestampsByVideoId[videoId];
    }
  });

  renderBuilderList();
}

function shuffleVideoOrder(order) {
  var shuffled = order.slice();

  for (var i = shuffled.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }

  return shuffled;
}

function randomizeBuilderOrder() {
  if (!context.videoOrder || context.videoOrder.length < 2) {
    return;
  }

  var timestampsByVideoId = getTimestampsByVideoIdFromBuilderUI();
  var order = shuffleVideoOrder(context.videoOrder);

  if (arraysEqual(order, context.videoOrder)) {
    order = shuffleVideoOrder(context.videoOrder);
  }

  var newTimestamps = {};
  order.forEach(function (videoId, index) {
    if (timestampsByVideoId[videoId]) {
      newTimestamps[index] = timestampsByVideoId[videoId];
    }
  });

  context.videoOrder = order;
  context.vidTimestamps = newTimestamps;
  renderBuilderList();
}

function getCurrentPlayerVideoId() {
  if (!player) {
    return null;
  }

  if (player.getVideoData) {
    var videoData = player.getVideoData();
    if (videoData && videoData.video_id) {
      return videoData.video_id;
    }
  }

  if (!player.getPlaylist) {
    return null;
  }

  var playlist = player.getPlaylist();
  var currentIndex = player.getPlaylistIndex();
  if (!playlist || currentIndex < 0 || currentIndex >= playlist.length) {
    return null;
  }

  return playlist[currentIndex];
}

function updateBuilderPlayingHighlight() {
  document.querySelectorAll('.playlist-builder-row').forEach(function (row) {
    row.classList.remove('now-playing');
  });

  if (!player || !isPlaylistInitialized()) {
    return;
  }

  var playerState = player.getPlayerState();
  if (playerState === -1 || playerState === YT.PlayerState.CUED) {
    return;
  }

  var currentVideoId = getCurrentPlayerVideoId();
  if (!currentVideoId) {
    return;
  }

  var row = document.querySelector('.playlist-builder-row[data-video-id="' + currentVideoId + '"]');
  if (row) {
    row.classList.add('now-playing');
  }
}

function resetBuilderStartTimes() {
  context.vidTimestamps = {};
  renderBuilderList();
}

function previewVideoAtIndex(index) {
  if (!player) {
    return;
  }

  if (isQuizRunning()) {
    stopQuizLikeManualReveal();
  }

  resetQuizCountdownToSettings();
  clearMessagesAndFutures();

  context.isQuizManuallyStopped = false;
  context.isQuizForPlaylistDone = false;
  context.hasSeekToBeenApplied = false;
  context.didVideoJustChange = true;
  context.needLastVolumeApplied = false;
  context.vidTimestamps = getTimestampsFromBuilderUI();

  blurVideo();
  setPlayerVisible();

  context.isPreviewStarting = true;
  player.playVideoAt(index);
  player.playVideo();
}

function applyBuilderToQuiz() {
  if (!context.videoOrder || context.videoOrder.length === 0) {
    return;
  }

  context.vidTimestamps = getTimestampsFromBuilderUI();
  context.needLastVolumeApplied = false;
  clearStateForNextVideo();
  clearPlaylistCounter();
  setQuizReadyDisplay();
  reloadPlayerWithCurrentOrder();
  updateBuilderUrlField();
}

function copyBuilderUrl() {
  var url = updateBuilderUrlField();
  if (!url) {
    return;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).catch(function () {
      prompt('Copy this URL:', url);
    });
  } else {
    prompt('Copy this URL:', url);
  }
}

function updateBuilderUrlField() {
  var urlField = document.getElementById('playlist-builder-url');
  if (!context.sourcePlaylistId || !context.videoOrder || context.videoOrder.length === 0) {
    urlField.value = '';
    return '';
  }

  var url = buildPlaylistUrl({
    playlistId: context.sourcePlaylistId,
    videoOrder: context.videoOrder,
    timestamps: getTimestampsFromBuilderUI(),
    youtubeOrder: context.youtubePlaylistOrder
  });

  urlField.value = url;
  return url;
}

function onPlaylistReadyForBuilder() {
  renderBuilderList();
}
