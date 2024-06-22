var player;
var context = new QuizContext();

function initializeMainPage() {
  toggleQuizStatusAlignment(document.getElementById('shift-quiz-status-left'));

  var tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';

  var firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  this.ytVolumeSlider = document.getElementById('ytVolume');

  context.setTimeLimitSeconds();
}

function setNewYtPlayer(playlistId) {
  if (player) {
    player.destroy();
    player = null;
  }

  document.getElementById('quiz-status-section').style.minHeight = "150px";

  player = new YT.Player('player', {
    height: '390',
    width: '640',
    playerVars: {
      'listType': 'playlist',
      'list': playlistId,
      'disablekb': 1,
      'autoplay': 0,
      'playsinline': 0,
      'loop': 0,
      'controls': 0, // Show pause/play buttons in player
      'showinfo': 1, // Hide the video title
      'modestbranding': 1, // Hide the Youtube Logo'
      'cc_load_policy': 0, // Hide closed captions
      'iv_load_policy': 1 // Hide the Video Annotations
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange,
      'onError': onError
    }
  });

  document.getElementById('player').style.opacity = "50%";
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
  }

  setCurrentPlaylistCounter();
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

  setCurrentPlaylistCounter();
  setPreviousAnswer();
}

function onError(event) {
  context.didVideoError = true;

  deblurVideo();

  var errorMessage = getFriendlyYoutubeAPIError(event.data);
  if (isEndOfPlaylist()) {
    errorMessage += '<br>' + getEndOfPlaylistMessage();
  }
  setQuizStatusDisplay(errorMessage);

  setPlayerVisible();

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

function setVideoPlayingState() {
  if (!player) { return; }

  setPlayerVisible();

  if (doesVideoNeedSeekTo()) {
    context.hasSeekToBeenApplied = true;
    seekTo(context.vidTimestamps[player.getPlaylistIndex()]);
    return;
  }

  player.setVolume(getVolume());
  context.needLastVolumeApplied = false;

  context.didVideoJustChange = false;
  if (context.isQuizManuallyStopped || context.isQuizForPlaylistDone) {
    return;
  }

  context.setTimeLimitSeconds();

  if (!context.isPaused) {
    //resumed from saved values
    var guessTimeLimitMs = context.guessTimeLimitSeconds * 1000;
    var vidTimeLimitMs = context.vidTimeLeftSeconds * 1000;
  } else {
    var guessTimeLimitMs = context.lastGuessTimeLimitSeconds * 1000;
    var vidTimeLimitMs = (context.lastVidTimeLeftSeconds ?? context.vidTimeLeftSeconds) * 1000;
  }

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
    let ytNextVidTimeoutMs = guessTimeLimitMs + vidTimeLimitMs - context.fadeOutMs;
    if (ytNextVidTimeoutMs <= 0) {
      ytNextVidTimeoutMs = vidTimeLimitMs;
    }

    this.ytNextVidTimeoutId = setTimeout(
      nextVideoAfterQuiz, ytNextVidTimeoutMs, vidTimeLimitMs
    );
  }
}

function setPausedVideoState() {
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

  context.isQuizForPlaylistDone = false;
  context.isQuizManuallyStopped = false;

  clearStateForNextVideo();
  setQuizStatusDisplay('(Starting next video)');
}

function loadPlaylist() {
  context.vidTimestamps = {};
  var ytPlaylistIdOrUrl = document.getElementById('playlistIdText').value;

  if (!ytPlaylistIdOrUrl) {
    setLoadPlaylistError('Value cannot be empty');
    return;
  }

  try {
    let url = new URL(ytPlaylistIdOrUrl);
    let urlHostname = url.hostname.toLowerCase();

    // crappy way of checking for a YT url
    if (!urlHostname.includes('youtube') && !urlHostname.includes('youtu.be')) {
      setLoadPlaylistError('Invalid YouTube URL');
      return;
    }

    let params = url.searchParams;
    var playlistId = params.get("list");

    if (!playlistId) {
      setLoadPlaylistError('Invalid YouTube playlist URL (needs a list= query param)');
      return;
    }

    params.forEach((value, key) => {
      if (key.startsWith('t')) {
        try {
          var vidTimestampKey = Number(key.substring(1)) - 1;
          var vidTimestampValue = Number(value);

          if (isNaN(vidTimestampKey) || isNaN(vidTimestampValue)) {
            let error = key + '=' + value + ' was invalid'
            throw error;
          }
          context.vidTimestamps[vidTimestampKey] = vidTimestampValue;
        } catch (_) {
          //console.log(_);
        }
      }
    });
  } catch (_) {
    playlistId = ytPlaylistIdOrUrl;
  }

  context.needLastVolumeApplied = false;
  clearError();
  clearStateForNextVideo();
  clearPlaylistCounter();
  setQuizReadyDisplay();
  setNewYtPlayer(playlistId);
}

function playVideo() {
  if (!player) { return; }
  player.playVideo();
}

function pauseVideo() {
  if (!player) { return; }
  player.pauseVideo();
}

function stopVideo() {
  player.stopVideo();
}

function previousVideo() {
  if (!player) { return; }
  context.didVideoJustChange = true;
  clearStateForNextVideo();
  player.previousVideo();
}

function nextVideo() {
  if (!player) { return; }
  if (isEndOfPlaylist()) {
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
  var tenPercentVol = Math.trunc(getVolume() * .1);
  if (tenPercentVol === 0) {
    tenPercentVol = 1;
  }

  if (!document.getElementById('disable-fade-out').checked) {
    reduceVolumeForFadeOut(tenPercentVol)
    this.volumeFadeOutIntervalId = setInterval(
      reduceVolumeForFadeOut, (context.fadeOutMs / 10), tenPercentVol
    );
  }

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

function reduceVolumeForFadeOut(volume) {
  player.setVolume(player.getVolume() - volume);
}

function endQuizForVideo() {
  if (!player) { return; }
  context.isQuizManuallyStopped = true;

  deblurVideo();
  clearMessagesAndFutures();
  setQuizStatusDisplay('Answer:<br><b>' + getVideoTitleWithFallback() + '</b><br><br>');
  setQuizCountdownDisplay('[Quiz is paused until next video]');
  document.getElementById('preQuizText').innerHTML = '';
  player.setVolume(getVolume());
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
  return currentIndex === lastIndex;
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
  document.getElementById('player').style.filter = "blur(70px)";
}

function clearCountdownTimer() {
  if (this.countdownTimerId) { clearInterval(this.countdownTimerId); }
  setQuizCountdownDisplay('');
}

function clearMessagesAndFutures() {
  clearError();

  if (this.ytNextVidTimeoutId) { clearTimeout(this.ytNextVidTimeoutId); }
  if (this.guessTimeRemainingTimeoutId) { clearTimeout(this.guessTimeRemainingTimeoutId); }
  if (this.vidTimeRemainingTimeoutId) { clearTimeout(this.vidTimeRemainingTimeoutId); }
  if (this.nextVideoTimeoutId) { clearTimeout(this.nextVideoTimeoutId); }
  if (this.onErrorNextVideoTimeoutId) { clearTimeout(this.onErrorNextVideoTimeoutId); }

  if (this.guessCountdownTimerId) { clearInterval(this.guessCountdownTimerId); }
  if (this.vidCountdownTimerId) { clearInterval(this.vidCountdownTimerId); }
  if (this.volumeFadeOutIntervalId) { clearInterval(this.volumeFadeOutIntervalId); }

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
}

function isPlaylistInitialized() {
  if (!player?.getPlaylist || !player.getPlaylist()) {
    return false;
  }
  return true;
}