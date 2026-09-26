var builderTitles = {};

function initPlaylistBuilder() {
  document.getElementById('addBuilderQueueButton').onclick = addBuilderToQueue;
  document.getElementById('copyBuilderUrlButton').onclick = copyBuilderUrl;
  document.getElementById('resetBuilderOrderButton').onclick = resetBuilderOrder;
  document.getElementById('randomizeBuilderOrderButton').onclick = randomizeBuilderOrder;
  document.getElementById('resetBuilderStartTimesButton').onclick = resetBuilderStartTimes;

  var listEl = document.getElementById('playlist-builder-list');
  listEl.addEventListener('dragover', onBuilderListDragOver);
  listEl.addEventListener('drop', onBuilderListDrop);
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

function createBuilderDropZone(insertIndex) {
  var dropZone = document.createElement('div');
  dropZone.className = 'playlist-builder-drop-zone';
  dropZone.dataset.insertIndex = String(insertIndex);
  return dropZone;
}

function isBuilderDropZoneNoOp(insertIndex, fromIndex) {
  return insertIndex === fromIndex || insertIndex === fromIndex + 1;
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
    listEl.appendChild(createBuilderDropZone(index));

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

    listEl.appendChild(row);
  });

  listEl.appendChild(createBuilderDropZone(context.videoOrder.length));

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
var builderDragImageEl = null;

function createBuilderRowDragImage(row, event) {
  var rowRect = row.getBoundingClientRect();
  var dragImage = row.cloneNode(true);
  dragImage.classList.add('playlist-builder-drag-image');
  dragImage.classList.remove('dragging', 'now-playing');
  dragImage.style.width = rowRect.width + 'px';
  dragImage.style.position = 'fixed';
  dragImage.style.top = '-1000px';
  dragImage.style.left = '-1000px';
  dragImage.style.pointerEvents = 'none';
  document.body.appendChild(dragImage);

  var offsetX = event.clientX - rowRect.left;
  var offsetY = event.clientY - rowRect.top;
  event.dataTransfer.setDragImage(dragImage, offsetX, offsetY);

  return dragImage;
}

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
  builderDragImageEl = createBuilderRowDragImage(row, event);
}

function clearDropIndicators() {
  document.querySelectorAll('.playlist-builder-drop-zone.active').forEach(function (dropZone) {
    dropZone.classList.remove('active');
  });
}

function getBuilderInsertIndexFromPointer(clientY) {
  var rows = document.querySelectorAll('#playlist-builder-list .playlist-builder-row');

  for (var i = 0; i < rows.length; i++) {
    var rect = rows[i].getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      return i;
    }
  }

  return rows.length;
}

function activateBuilderDropZoneForPointer(clientY) {
  if (builderDragSourceIndex === null) {
    clearDropIndicators();
    return;
  }

  var insertIndex = getBuilderInsertIndexFromPointer(clientY);
  if (isBuilderDropZoneNoOp(insertIndex, builderDragSourceIndex)) {
    clearDropIndicators();
    return;
  }

  var dropZone = document.querySelector(
    '.playlist-builder-drop-zone[data-insert-index="' + insertIndex + '"]'
  );

  clearDropIndicators();
  if (dropZone) {
    dropZone.classList.add('active');
  }
}

function onBuilderListDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  activateBuilderDropZoneForPointer(event.clientY);
}

function onBuilderListDrop(event) {
  event.preventDefault();

  if (builderDragSourceIndex === null) {
    clearDropIndicators();
    return;
  }

  var insertIndex = getBuilderInsertIndexFromPointer(event.clientY);
  clearDropIndicators();

  if (isBuilderDropZoneNoOp(insertIndex, builderDragSourceIndex)) {
    return;
  }

  var toIndex = insertIndex;
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
  if (builderDragImageEl) {
    builderDragImageEl.remove();
    builderDragImageEl = null;
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

// Adds the builder's generated URL (list + custom video order + per-video
// start times, as shown in the "Generated URL" field) to the queue using the
// same add pipeline as the raw "Add to Queue" button (oEmbed metadata fetch
// plus embed validation, then the item is pushed to the queue list).
function addBuilderToQueue() {
  var url = updateBuilderUrlField();
  if (!url) {
    return;
  }

  var addQueueButton = document.getElementById('addQueueButton');
  addQueueButton.disabled = true;

  // The builder's generated URL is always a full YouTube playlist URL, so
  // parsePlaylistInput is safe here and yields playlistId, videoOrder, and
  // the t* start-time params (user options).
  var parsed = parsePlaylistInput(url);

  var item = {
    parsed: parsed,
    title: 'Adding playlist...',
    author: null,
    thumbnail: null,
    metaLoaded: false,
    pending: true
  };

  // Capture the final-finished state before pushing the temp item, because
  // adding an item to the queue changes playlistQueue.length and would make
  // isFinalFinishedState() report false.
  var wasInFinalFinishedState = isFinalFinishedState();
  playlistQueue.push(item);
  renderQueueList();

  // The playlist is only added to the queue if its metadata can be fetched
  // via the oEmbed REST request. On failure the temporary queue item is
  // removed and an error is displayed instead of queuing the item.
  fetchPlaylistMetadata(parsed.playlistId, item).then(function (metaLoaded) {
    if (metaLoaded) {
      item.pending = false;
      if (wasInFinalFinishedState) {
        // The quiz was in the final finished state (last playlist, last
        // video, and the end-of-playlist message displayed with no upcoming
        // playlists). Now that a new playlist has been added, automatically
        // start the countdown to load it.
        maybeAutoAdvanceToNextPlaylist();
      }
    } else {
      // Error out: remove the temporary queue item so the queue only
      // reflects playlists that were actually added.
      var tempIndex = playlistQueue.indexOf(item);
      if (tempIndex !== -1) {
        playlistQueue.splice(tempIndex, 1);
      }
    }

    addQueueButton.disabled = false;
    renderQueueList();
  });
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
