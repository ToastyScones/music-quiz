var player;
var context = new QuizContext();
var pendingLoadMode = null;
var pendingPlaylistId = null;
var pendingVideoIds = null;
var pendingStartIndex = 0;
var pendingYoutubeOrderDiscovery = false;
var isTransitioningToCustomOrder = false;
var pendingAutoPlay = false;

// Next-video preloading: a hidden second YT.Player buffers the NEXT
// video's stream while the current one plays, so advancing loads faster.
var preloadPlayer = null;
var preloadReady = false;
var preloadCuedId = null; // video id currently cued in the preload player
var preloadRequestedId = null; // video id to cue once the preload is ready
var preloadRewound = false; // true once the preloaded video has been paused at its start offset

function initializeMainPage() {
  toggleQuizStatusAlignment(document.getElementById('shift-quiz-status-left'));

  var tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';

  var firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  this.ytVolumeSlider = document.getElementById('ytVolume');

  context.setTimeLimitSeconds();
  initPlaylistBuilder();
  showBuilderEmptyState();
}

function destroyPlayer() {
  if (player) {
    player.destroy();
    player = null;
  }
}

function createYtPlayer() {
  destroyPlayer();
  // The playlist is being replaced, so any previously preloaded "next"
  // video is now stale. Forget it so the first PLAYING state re-cues it.
  preloadCuedId = null;

  document.getElementById('quiz-status-section').style.minHeight = "150px";

  player = new YT.Player('player', {
    height: '390',
    width: '640',
    playerVars: {
      'disablekb': 1,
      'autoplay': 0,
      'playsinline': 0,
      'loop': 0,
      'controls': 0, // Show pause/play buttons in player
      'showinfo': 1, // Hide the video title
      'modestbranding': 1, // Hide the Youtube Logo'
      'cc_load_policy': 3, // Hide closed captions
      'iv_load_policy': 3 // Hide the Video Annotations
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange,
      'onError': onError
    }
  });
  document.getElementById('player').style.opacity = "50%";
}

function setNewYtPlayerFromPlaylistId(playlistId) {
  context.pendingPlaylistInit = true;
  pendingLoadMode = 'playlistId';
  pendingPlaylistId = playlistId;
  createYtPlayer();
}

function setNewYtPlayerFromOrder(videoIds, startIndex) {
  context.pendingPlaylistInit = true;
  pendingLoadMode = 'videoIds';
  pendingVideoIds = videoIds;
  pendingStartIndex = startIndex || 0;
  createYtPlayer();
}

function reloadPlayerWithCurrentOrder() {
  if (!context.videoOrder || context.videoOrder.length === 0) {
    return;
  }

  context.pendingPlaylistInit = true;

  if (player && player.cuePlaylist) {
    player.cuePlaylist(context.videoOrder, 0);
  } else if (player && player.loadPlaylist) {
    player.loadPlaylist(context.videoOrder, 0);
  } else {
    setNewYtPlayerFromOrder(context.videoOrder);
  }
}

function tryCompletePlaylistInit() {
  if (!context.pendingPlaylistInit || !player?.getPlaylist) {
    return;
  }

  var playlist = player.getPlaylist();
  if (!playlist || playlist.length === 0) {
    return;
  }

  var playlistOrder = playlist.slice();

  if (pendingYoutubeOrderDiscovery) {
    context.youtubePlaylistOrder = playlistOrder.slice();
    pendingYoutubeOrderDiscovery = false;
    isTransitioningToCustomOrder = true;
    setNewYtPlayerFromOrder(context.videoOrder, 0);
    return;
  }

  if (!context.youtubePlaylistOrder) {
    context.youtubePlaylistOrder = playlistOrder.slice();
  }

  if (!context.videoOrder || context.videoOrder.length === 0) {
    context.videoOrder = playlistOrder.slice();
  }

  if (!arraysEqual(playlistOrder, context.videoOrder)) {
    reloadPlayerWithCurrentOrder();
    return;
  }

  context.pendingPlaylistInit = false;
  isTransitioningToCustomOrder = false;
  setCurrentPlaylistCounter();
  onPlaylistReadyForBuilder();
}

function setVolumeStateForNextVideo() {
  if (!(player?.setVolume) || context.needLastVolumeApplied) { return; }

  player.setVolume(0);
  context.needLastVolumeApplied = true;
}

function onPlayerReady(event) {
  this.ytVolumeSlider.value = getVolume();
  this.ytVolumeSlider.oninput = function () {
    player.setVolume(this.value);
    unMute();
  };

  if (pendingLoadMode === 'playlistId' && pendingPlaylistId) {
    var playlistOptions = {
      listType: 'playlist',
      list: pendingPlaylistId,
      index: 0
    };
    if (pendingAutoPlay && player.loadPlaylist) {
      player.loadPlaylist(playlistOptions);
      if (!pendingYoutubeOrderDiscovery) {
        pendingAutoPlay = false;
      }
    } else if (player.cuePlaylist) {
      player.cuePlaylist(playlistOptions);
      pendingAutoPlay = false;
    } else {
      player.loadPlaylist(playlistOptions);
    }
    pendingLoadMode = null;
    pendingPlaylistId = null;
  } else if (pendingLoadMode === 'videoIds' && pendingVideoIds) {
    if (pendingAutoPlay && player.loadPlaylist) {
      player.loadPlaylist(pendingVideoIds, pendingStartIndex);
    } else if (player.cuePlaylist) {
      player.cuePlaylist(pendingVideoIds, pendingStartIndex);
    } else {
      player.loadPlaylist(pendingVideoIds, pendingStartIndex);
    }
    pendingAutoPlay = false;
    pendingLoadMode = null;
    pendingVideoIds = null;
    pendingStartIndex = 0;
  }

  tryCompletePlaylistInit();
  setCurrentPlaylistCounter();
  clearNextPlaylistDisplay();
}

function getVolume() {
  return this.ytVolumeSlider.value;
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    setVideoPlayingState();
  } else if (event.data === YT.PlayerState.PAUSED) {
    setPausedVideoState();
  } else if (event.data === YT.PlayerState.ENDED) {
    setVideoEndedState();
  } else if (event.data === -1) {
    setVideoUnstartedState();
  }

  tryCompletePlaylistInit();
  setCurrentPlaylistCounter();
  setPreviousAnswer();
}

function onError(event) {
  if (isTransitioningToCustomOrder) {
    return;
  }

  context.didVideoError = true;

  deblurVideo();

  var errorMessage = getFriendlyYoutubeAPIError(event.data);
  if (isEndOfPlaylist()) {
    errorMessage += '<br>' + getEndOfPlaylistMessage();
  }
  setQuizStatusDisplay(errorMessage);

  setPlayerVisible();

  if (event.data === 2 && context.isWaitingForQuizStart) {
    return;
  }

  this.onErrorNextVideoTimeoutId = setTimeout(
    function () {
      context.didVideoError = false;
      if (isEndOfPlaylist()) {
        return;
      }
      blurVideo();
      nextVideo();
    },
    5000
  );
}

function setPlayerVisible() {
  document.getElementById('player').style.opacity = "100%";
  document.getElementById('preQuizText').innerHTML = '';
}

function clearQuizFutures() {
  if (this.ytNextVidTimeoutId) {
    clearTimeout(this.ytNextVidTimeoutId);
    this.ytNextVidTimeoutId = null;
  }
  if (this.guessTimeRemainingTimeoutId) {
    clearTimeout(this.guessTimeRemainingTimeoutId);
    this.guessTimeRemainingTimeoutId = null;
  }
  if (this.nextVideoTimeoutId) {
    clearTimeout(this.nextVideoTimeoutId);
    this.nextVideoTimeoutId = null;
  }
  if (this.guessCountdownTimerId) {
    clearInterval(this.guessCountdownTimerId);
    this.guessCountdownTimerId = null;
  }
  if (this.vidCountdownTimerId) {
    clearInterval(this.vidCountdownTimerId);
    this.vidCountdownTimerId = null;
  }
  if (this.volumeFadeOutIntervalId) {
    clearInterval(this.volumeFadeOutIntervalId);
    this.volumeFadeOutIntervalId = null;
  }
  clearAutoAdvanceTimers();
}

function getQuizTimerLimitsMs() {
  context.setTimeLimitSeconds();

  if (
    !context.isPaused ||
    context.lastGuessTimeLimitSeconds === undefined ||
    context.lastGuessTimeLimitSeconds <= 0
  ) {
    return {
      guessTimeLimitMs: context.guessTimeLimitSeconds * 1000,
      vidTimeLimitMs: context.vidTimeLeftSeconds * 1000
    };
  }

  var guessTimeLimitMs = context.lastGuessTimeLimitSeconds * 1000;
  var vidTimeLimitMs = (context.lastVidTimeLeftSeconds ?? context.vidTimeLeftSeconds) * 1000;

  if (guessTimeLimitMs <= 0) {
    guessTimeLimitMs = context.guessTimeLimitSeconds * 1000;
    vidTimeLimitMs = context.vidTimeLeftSeconds * 1000;
  }

  return { guessTimeLimitMs, vidTimeLimitMs };
}

// Whether a video is currently actively playing in the player.
// Returns false when there is no player, or the player is in any
// non-playing state (unstarted, cued, paused, or ended). Mirrors the
// guard used by startQuizTimersIfPlaying below.
function isVideoPlaying() {
  if (!player || player.getPlayerState() !== YT.PlayerState.PLAYING) {
    return false;
  }
  return true;
}

function startQuizTimersIfPlaying() {
  if (!player || player.getPlayerState() !== YT.PlayerState.PLAYING) {
    return;
  }

  if (context.isQuizManuallyStopped || context.isQuizForPlaylistDone) {
    return;
  }

  clearQuizFutures();

  var timerLimits = getQuizTimerLimitsMs();
  var guessTimeLimitMs = timerLimits.guessTimeLimitMs;
  var vidTimeLimitMs = timerLimits.vidTimeLimitMs;

  context.isPaused = false;

  if (!context.isQuizForVideoDone) {
    setGuessTimeRemainingMessage(guessTimeLimitMs / 1000);

    this.guessTimeRemainingTimeoutId = setTimeout(
      setGuessAsFinished,
      guessTimeLimitMs,
      vidTimeLimitMs / 1000
    );
  } else {
    var message = 'Time\'s up! Answer was:<br><b>' + getVideoTitleWithFallback() + '</b><br>';

    if (isEndOfPlaylist()) {
      context.isQuizForPlaylistDone = true;
      clearCountdownTimer();
      setQuizStatusDisplay(message + '<br>' + getEndOfPlaylistMessage());
    } else {
      setQuizStatusDisplay(message);
      setVidTimeRemainingMessage(vidTimeLimitMs / 1000);
    }
  }

  if (!isEndOfPlaylist()) {
    var ytNextVidTimeoutMs = guessTimeLimitMs + vidTimeLimitMs - context.fadeOutMs;
    if (ytNextVidTimeoutMs <= 0) {
      ytNextVidTimeoutMs = vidTimeLimitMs;
    }

    this.ytNextVidTimeoutId = setTimeout(
      nextVideoAfterQuiz, ytNextVidTimeoutMs, vidTimeLimitMs
    );
  }
}

function setVideoPlayingState() {
  if (!player) { return; }

  setPlayerVisible();
  context.isPreviewStarting = false;

  if (context.isPreviewing) {
    return;
  }

  // Warm the next video's stream so advancing to it is faster.
  maybePreloadNextVideo();

  player.setVolume(getVolume());
  context.needLastVolumeApplied = false;

  context.didVideoJustChange = false;
  context.isWaitingForQuizStart = false;
  if (context.isQuizManuallyStopped || context.isQuizForPlaylistDone) {
    return;
  }

  if (doesVideoNeedSeekTo()) {
    context.hasSeekToBeenApplied = true;
    seekTo(context.vidTimestamps[player.getPlaylistIndex()]);
    setTimeout(startQuizTimersIfPlaying, 300);
    return;
  }

  startQuizTimersIfPlaying();
}

function setPausedVideoState() {
  if (context.isPreviewing) {
    return;
  }

  if (context.isQuizManuallyStopped || context.isQuizForPlaylistDone) {
    return;
  }

  if (context.didVideoJustChange) {
    context.didVideoJustChange = false;
    return;
  }

  context.isPaused = true;

  player.setVolume(getVolume());

  clearMessagesAndFutures();
  setQuizStatusDisplay('(Video and quiz are paused)');
}

function setVideoEndedState() {
  context.isQuizManuallyStopped = true;

  if (isEndOfPlaylist()) {
    context.isQuizForPlaylistDone = true;
    return;
  }

  clearStateForNextVideo();
}

function setVideoUnstartedState() {
  if (context.didVideoError) { return; }
  if (context.isPreviewStarting) { return; }

  context.isQuizForPlaylistDone = false;
  context.isQuizManuallyStopped = false;

  clearStateForNextVideo();
  if (context.isWaitingForQuizStart) {
    setQuizReadyDisplay();
    return;
  }
  setQuizStatusDisplay('(Starting next video)');
}

function playVideo() {
  if (!player) { return; }
  context.isPreviewing = false;
  player.playVideo();
}

function pauseVideo() {
  if (!player) { return; }
  player.pauseVideo();
}

function stopVideo() {
  player.stopVideo();
}

// ---- Next-video preloading -------------------------------------------
// A second, hidden YT.Player actually PLAYS (muted, offscreen) the NEXT
// video while the current one is playing. Playing it is what triggers
// the real network fetch (ad + media stream); merely cueing/loading it
// leaves the stream cold and the advance stays slow. With the stream
// already fetched, when the real player advances (player.nextVideo())
// the bytes are warm in the browser cache and the transition loads
// faster. It is toggled by the "Preload next video" checkbox in
// index.html. It must never drive quiz logic, so its state events are
// no-ops.

function isPreloadEnabled() {
  var el = document.getElementById('preload-next-video');
  return !!(el && el.checked);
}

// The video id that follows the current one, or null when the current
// video is the last in the playlist / the player isn't initialized.
function getNextVideoId() {
  if (!isPlaylistInitialized()) {
    return null;
  }
  var playlist = player.getPlaylist();
  var currentIndex = player.getPlaylistIndex();
  var nextIndex = currentIndex + 1;
  if (!playlist || nextIndex >= playlist.length) {
    return null;
  }
  var entry = playlist[nextIndex];
  // getPlaylist() may return id strings or {videoId} objects; normalize.
  return (entry && typeof entry === 'object') ? entry.videoId : entry;
}

function ensurePreloadPlayer(videoId) {
  if (preloadReady && preloadPlayer && preloadPlayer.playVideo) {
    // Actually START playback so the ad + media stream is really fetched
    // and cached (muted, offscreen) while the current video plays.
    // loadVideoById targets the exact next video; playVideo() is what kicks
    // off the real network fetch (ad + stream) - a load/cue alone leaves
    // the stream cold and nextVideo() stays slow. By the time the main
    // player calls nextVideo(), the stream is warm in the browser cache.
    var startSeconds = context.vidTimestamps[player.getPlaylistIndex() + 1];
    preloadPlayer.loadVideoById({ videoId: videoId, startSeconds: startSeconds });
    //preloadPlayer.playVideo();
    preloadCuedId = videoId;
    preloadRewound = false;
    return;
  }
  // Not ready yet (or not created): remember the target; onReady loads it.
  preloadRequestedId = videoId;
  if (!preloadPlayer) {
    preloadPlayer = new YT.Player('preload-player', {
      width: 1,
      height: 1,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        playsinline: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        cc_load_policy: 3
      },
      events: {
        onReady: onPreloadPlayerReady,
        onStateChange: onPreloadPlayerStateChange
      }
    });
  }
}

// The preload player's state handler. It is a hidden, offscreen player used
// ONLY to warm the NEXT video's stream, so it must never drive quiz logic.
// The moment the preloaded video actually starts playing (PLAYING) we:
//   1) seek it to that video's configurable start offset (the &tN= param, the
//      same value the MAIN player seeks to via seekTo()), so the stream is
//      warm AND positioned where the quiz will start, then
//   2) pause it (stop playback once it has started). The flag ensures this
//      happens at most once per cued video.
function onPreloadPlayerStateChange(event) {
  if (preloadRewound) {
    return;
  }
  if (event.data !== YT.PlayerState.PLAYING) {
    return;
  }
  preloadRewound = true;
  if (!player || !preloadPlayer) {
    return;
  }
  var startSeconds = context.vidTimestamps[player.getPlaylistIndex() + 1];
  if (typeof startSeconds === 'number' && startSeconds > 0) {
    preloadPlayer.seekTo(startSeconds, true);
  }
  preloadPlayer.pauseVideo();
}

function onPreloadPlayerReady() {
  preloadReady = true;
  if (preloadPlayer) {
    preloadPlayer.setVolume(0);
    preloadPlayer.mute();
  }
  if (preloadRequestedId) {
    ensurePreloadPlayer(preloadRequestedId);
    preloadRequestedId = null;
  }
  preloadPlayer.playVideo();
}

// Warms the next video's stream. Called whenever the current video starts
// playing. No-ops at the end of the playlist, when the feature is off,
// or when the next video is already buffered.
function maybePreloadNextVideo() {
  if (!isPreloadEnabled()) {
    return;
  }
  var nextId = getNextVideoId();
  if (!nextId || nextId === preloadCuedId) {
    return;
  }
  ensurePreloadPlayer(nextId);
}

function previousVideo() {
  if (!player) { return; }
  // At the first video, "previous" means the previous queued playlist;
  // jump there (it auto-plays). Do nothing if there is no previous one.
  var previousPlaylistIndex = (queueIndex >= 0) ? queueIndex - 1 : -1;
  if (isFirstVideoInPlaylist() &&
      previousPlaylistIndex >= 0 &&
      previousPlaylistIndex < playlistQueue.length) {
    loadPlaylistAtIndex(previousPlaylistIndex);
    return;
  }
  context.didVideoJustChange = true;
  clearStateForNextVideo();
  player.previousVideo();
}

function nextVideo() {
  if (!player) { return; }
  if (isEndOfPlaylist()) {
    // At the last video, advance to the next queued playlist (auto-plays).
    if (queueIndex >= 0 && queueIndex + 1 < playlistQueue.length) {
      loadNextQueuedPlaylist();
    }
    return;
  }
  context.didVideoJustChange = true;
  clearStateForNextVideo();
  setPreviousAnswerState();
  player.nextVideo();
}

function seekTo(seconds) {
  player.seekTo(seconds);
}

function doesVideoNeedSeekTo() {
  var playerPlaylistIndex = player.getPlaylistIndex();
  if (playerPlaylistIndex in context.vidTimestamps) {
    return !context.hasSeekToBeenApplied;
  }
  return false;
}

function clearStateForNextVideo() {
  context.setNextVideoState();
  blurVideo();
  clearMessagesAndFutures();
  setVolumeStateForNextVideo();
}


// This function gets called in the last couple seconds as the 
//  music fades out and the next video is queued to play.
function nextVideoAfterQuiz(milliSecondsRemaining) {
  context.isQuizManuallyStopped = false;

  if (isEndOfPlaylist()) {
    // Don't call nextVideo if at the end of the playlist
    return;
  }

  // Fade out music as video ends
  startVolumeFadeOut();

  // Next video timeout.
  //  While this is queued, music should start to fade out
  //  from the interval above.
  var nextVideoTimeoutMs = milliSecondsRemaining < context.fadeOutMs ?
    milliSecondsRemaining : context.fadeOutMs;

  this.nextVideoTimeoutId = setTimeout(
    function () {
      setQuizStatusDisplay('(Starting next video)');
      clearInterval(this.volumeFadeOutIntervalId);
      clearStateForNextVideo();
      nextVideo();
    },
    nextVideoTimeoutMs
  );
}

// Start fading out the current (still-playing) audio over context.fadeOutMs,
// so it is nearly silent by the time the next video/playlist is actually
// loaded. The fade interval is torn down by clearQuizFutures (via
// clearStateForNextVideo / loadPlaylistFromParsed) when the next
// video/playlist is loaded. Honors the "Disable audio fade out" checkbox
// (no-ops if it is checked).
function startVolumeFadeOut() {
  if (!player) { return; }
  if (document.getElementById('disable-fade-out').checked) { return; }

  var tenPercentVol = Math.trunc(getVolume() * .1);
  if (tenPercentVol === 0) {
    tenPercentVol = 1;
  }

  reduceVolumeForFadeOut(tenPercentVol);
  this.volumeFadeOutIntervalId = setInterval(
    reduceVolumeForFadeOut, (context.fadeOutMs / 10), tenPercentVol
  );
}

function reduceVolumeForFadeOut(volume) {
  player.setVolume(player.getVolume() - volume);
}

function stopQuizLikeManualReveal() {
  context.isQuizManuallyStopped = true;
  deblurVideo();
  clearMessagesAndFutures();
  setQuizStatusDisplay('Answer:<br><b>' + getVideoTitleWithFallback() + '</b><br><br>');
  setQuizCountdownDisplay('[Quiz is paused until next video]');
  document.getElementById('preQuizText').innerHTML = '';
  if (player) {
    player.setVolume(getVolume());
  }
}

function resetQuizCountdownToSettings() {
  context.setTimeLimitSeconds();
  context.lastGuessTimeLimitSeconds = undefined;
  context.lastVidTimeLeftSeconds = undefined;
  context.isPaused = false;
  context.isQuizForVideoDone = false;
}

function endQuizForVideo() {
  if (!player) { return; }
  stopQuizLikeManualReveal();
}

function setGuessAsFinished(secondsRemaining) {
  context.isQuizForVideoDone = true;
  clearTimeout(this.guessTimeRemainingTimeoutId);

  deblurVideo();
  var message = 'Time\'s up! Answer was:<br><b>' + getVideoTitleWithFallback() + '</b><br>';

  if (isEndOfPlaylist()) {
    context.isQuizForPlaylistDone = true;
    clearCountdownTimer();
    setQuizStatusDisplay(message + getEndOfPlaylistMessage());
    maybeAutoAdvanceToNextPlaylist();
  } else {
    setQuizStatusDisplay(message);
    setVidTimeRemainingMessage(secondsRemaining);
  }
}

function setGuessTimeRemainingMessage(secondsRemaining) {
  setQuizStatusDisplay('Time to guess!');
  let message = 'Time left:';
  setSecondsRemaningMessage(message, secondsRemaining);

  secondsRemaining = secondsRemaining - 1;
  clearInterval(this.guessCountdownTimerId);
  this.guessCountdownTimerId = setInterval(
    function () {
      if (secondsRemaining <= 0) {
        clearInterval(this.guessCountdownTimerId);
      } else {
        setSecondsRemaningMessage(message, secondsRemaining);
      }
      secondsRemaining -= 1;
      context.lastGuessTimeLimitSeconds = secondsRemaining >= 0 ? secondsRemaining : 0;
    },
    1000
  );
}

function setVidTimeRemainingMessage(secondsRemaining) {
  let message = 'Next video in:';
  setSecondsRemaningMessage(message, secondsRemaining);

  secondsRemaining = secondsRemaining - 1;
  clearInterval(this.vidCountdownTimerId);
  this.vidCountdownTimerId = setInterval(
    function () {
      if (secondsRemaining < 0) {
        clearInterval(this.vidCountdownTimerId);
      } else {
        setSecondsRemaningMessage(message, secondsRemaining);
      }
      secondsRemaining -= 1;
      context.lastVidTimeLeftSeconds = secondsRemaining >= 0 ? secondsRemaining : 0;
    },
    1000
  );
}

function isEndOfPlaylist() {
  if (!isPlaylistInitialized()) {
    return true;
  }

  var lastIndex = player.getPlaylist().length - 1;
  var currentIndex = player.getPlaylistIndex();
  return currentIndex === lastIndex || (lastIndex === -1 && currentIndex === 0);
}

// True when the player is on the first video of the current playlist.
// Mirrors isEndOfPlaylist(); returns true when the playlist isn't
// initialized so the caller treats a missing/initializing player as
// "at the first video" (jumping to the previous playlist, if any, is the
// only sensible move).
function isFirstVideoInPlaylist() {
  if (!isPlaylistInitialized()) {
    return true;
  }
  return player.getPlaylistIndex() === 0;
}

function getVideoTitleWithFallback() {
  return getVideoTitle() ?? getVideoDidNotLoadMessage();
}

function getVideoTitle() {
  if (!player?.getVideoData) {return null;}
  return player.getVideoData().title;
}

function deblurVideo() {
  document.getElementById('player').style.filter = "blur(0px)";
}

function blurVideo() {
  document.getElementById('player').style.filter = "blur(70px) hue-rotate(180deg)";
}

function clearCountdownTimer() {
  if (this.countdownTimerId) { clearInterval(this.countdownTimerId); }
  setQuizCountdownDisplay('');
}

function clearMessagesAndFutures() {
  clearError();
  clearQuizFutures();

  if (this.onErrorNextVideoTimeoutId) {
    clearTimeout(this.onErrorNextVideoTimeoutId);
    this.onErrorNextVideoTimeoutId = null;
  }

  clearCountdownTimer();
}

function setPreviousAnswer() {
  if (!player) { return; }

  var currentVideoIndex = player.getPlaylistIndex();

  if (currentVideoIndex > context.previousVideoIndex) {
    setUnknownPreviousVideoMessage();
  }
  setPreviousAnswerState();
}

function setPreviousAnswerState() {
  context.setPreviousAnswerState(player.getPlaylistIndex(), getVideoTitle());
}

function toggleMute() {
  if (!player) { return; }

  if (player.isMuted()) {
    unMute();
  } else {
    player.mute();
    document.getElementById('vol-icon').src = 'images/icons/volume-mute-solid-36.png';
  }
}

function unMute() {
  player.unMute();
  document.getElementById('vol-icon').src = 'images/icons/volume-full-solid-36.png';
}

function setCurrentPlaylistCounter() {
  if (!isPlaylistInitialized()) { return; }
  var lastId = player.getPlaylist().length;
  var currentId = player.getPlaylistIndex() + 1;
  setPlaylistOrderDisplay(currentId, lastId);
  updateBuilderPlayingHighlight();
}

function isPlaylistInitialized() {
  if (!player?.getPlaylist || !player.getPlaylist()) {
    return false;
  }
  return true;
}
