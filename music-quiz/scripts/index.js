var player;
var fadeOutMs = 2000;
var guessTimeLimitSeconds;
var vidTimeLeftSeconds;
var isPaused = false;
var isQuizManuallyStopped = false;
var isQuizForVideoDone = false;
var isQuizForPlaylistDone = false;
var lastVolume = undefined;
var didVideoError = false;
var lastGuessTimeLimitSeconds;
var lastVidTimeLeftSeconds;
var didVideoJustChange = false;
var vidTimestamps = {};
var hasSeekToBeenApplied = false;
var needLastVolumeApplied = false;

function setNewYtPlayer(playlistId) {
  if (player) {
    player.stopVideo();
    player.destroy();
    player = null;
  }

  document.getElementById('mainView').style.minHeight = "150px";

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
}

function setVolumeStateForNextVideo() {
  if (!player || needLastVolumeApplied) { return; }

  player.setVolume(0);
  needLastVolumeApplied = true;
}

function onPlayerReady(event) {
  document.getElementById('ytVolume').value = lastVolume;
  document.getElementById('volumeText').style.display = "inline";
  document.getElementById('ytVolume').style.display = "inline";

  lastVolume = player.getVolume();

  this.ytVolumeSlider.value = lastVolume;
  this.ytVolumeSlider.oninput = function () {
    player.setVolume(this.value);
    lastVolume = this.value;
  }

  configurePlayerShuffle();
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
  //printEventData(event.data);
}

function onError(event) {
  didVideoError = true;

  deblurVideo();

  var errorMessage = getFriendlyYoutubeAPIError(event.data);
  if (isEndOfPlaylist()) {
    errorMessage += '<br>' + getEndOfPlaylistMessage();
  }
  setQuizStatusDisplay(errorMessage);

  this.onErrorNextVideoTimeoutId = setTimeout(
    function () {
      didVideoError = false;
      if (isEndOfPlaylist()) {
        return;
      }
      blurVideo();
      nextVideo();
    },
    5000
  );
}

function setVideoPlayingState() {
  if (!player) { return; }

  if (doesVideoNeedSeekTo()) {
    hasSeekToBeenApplied = true;
    seekTo(vidTimestamps[player.getPlaylistIndex()]);
    return;
  }

  if (needLastVolumeApplied) {
    player.setVolume(lastVolume);
    needLastVolumeApplied = false;
  } else {
    lastVolume = player.getVolume();
  }

  didVideoJustChange = false;
  if (isQuizManuallyStopped || isQuizForPlaylistDone) {
    return;
  }

  setTimeLimitSeconds();

  if (!isPaused) {
    //resumed from saved values
    var guessTimeLimitMs = guessTimeLimitSeconds * 1000;
    var vidTimeLimitMs = vidTimeLeftSeconds * 1000;
  } else {
    var guessTimeLimitMs = lastGuessTimeLimitSeconds * 1000;
    var vidTimeLimitMs = (lastVidTimeLeftSeconds ?? vidTimeLeftSeconds) * 1000;
  }

  isPaused = false;

  if (!isQuizForVideoDone) {
    setGuessTimeRemainingMessage(guessTimeLimitMs / 1000);

    this.guessTimeRemainingTimeoutId = setTimeout(
      setGuessAsFinished,
      guessTimeLimitMs,
      vidTimeLimitMs / 1000
    );
  } else {
    var message = 'Time\'s up! Answer was: <br><b>' + getVideoTitle() + '</b><br>';

    if (isEndOfPlaylist()) {
      isQuizForPlaylistDone = true;
      clearCountdownTimer();
      setQuizStatusDisplay(message + '<br>' + getEndOfPlaylistMessage());
    } else {
      setQuizStatusDisplay(message);
      setVidTimeRemainingMessage(vidTimeLimitMs / 1000);
    }
  }

  if (!isEndOfPlaylist()) {
    let ytNextVidTimeoutMs = guessTimeLimitMs + vidTimeLimitMs - fadeOutMs;
    if (ytNextVidTimeoutMs <= 0) {
      ytNextVidTimeoutMs = vidTimeLimitMs;
    }

    this.ytNextVidTimeoutId = setTimeout(
      nextVideoAfterQuiz, ytNextVidTimeoutMs, vidTimeLimitMs
    );
  }
}

function setPausedVideoState() {
  if (isQuizManuallyStopped || isQuizForPlaylistDone) {
    return;
  }

  if (didVideoJustChange) {
    didVideoJustChange = false;
    return;
  }

  isPaused = true;

  player.setVolume(lastVolume);

  clearMessagesAndFutures();
  setQuizStatusDisplay('(Video and quiz are paused)');
}

function setVideoEndedState() {
  isQuizManuallyStopped = true;

  if (isEndOfPlaylist()) {
    isQuizForPlaylistDone = true;
    return;
  }

  clearStateForNextVideo();
}

function setVideoUnstartedState() {
  if (didVideoError) { return; }

  isQuizForPlaylistDone = false;
  isQuizManuallyStopped = false;

  clearStateForNextVideo();
  setQuizStatusDisplay('(Starting next video)');
}

function setPlaylist() {
  vidTimestamps = {};
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
          vidTimestamps[vidTimestampKey] = vidTimestampValue;
        } catch (_) {
          //console.log(_);
        }
      }
    });
  } catch (_) {
    playlistId = ytPlaylistIdOrUrl;
  }

  clearError();
  clearStateForNextVideo();
  needLastVolumeApplied = false;

  setQuizStatusDisplay('Press Play to start the quiz!');

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
  didVideoJustChange = true;
  clearStateForNextVideo();
  player.previousVideo();
}

function nextVideo() {
  if (!player) { return; }
  if (isEndOfPlaylist()) {
    return;
  }
  didVideoJustChange = true;
  clearStateForNextVideo();
  player.nextVideo();
}

function seekTo(seconds) {
  player.seekTo(seconds);
}

function doesVideoNeedSeekTo() {
  var playerPlaylistIndex = player.getPlaylistIndex();
  if (playerPlaylistIndex in vidTimestamps) {
    return !hasSeekToBeenApplied;
  }
  return false;
}

function clearStateForNextVideo() {
  isPaused = false;
  isQuizManuallyStopped = false;
  isQuizForVideoDone = false;
  isQuizForPlaylistDone = false;
  hasSeekToBeenApplied = false;

  lastVidTimeLeftSeconds = undefined;

  blurVideo();
  clearMessagesAndFutures();
  setVolumeStateForNextVideo();
}

// This function gets called in the last couple seconds as the 
//  music fades out and the next video is queued to play.
function nextVideoAfterQuiz(milliSecondsRemaining) {
  isQuizManuallyStopped = false;

  if (isEndOfPlaylist()) {
    // Don't call nextVideo if at the end of the playlist
    return;
  }

  // Fade out music as video ends
  lastVolume = player.getVolume();
  var tenPercentVol = Math.trunc(lastVolume * .1);
  if (tenPercentVol === 0) {
    tenPercentVol = 1;
  }

  reduceVolumeForFadeOut(tenPercentVol)
  this.volumeFadeOutIntervalId = setInterval(
    reduceVolumeForFadeOut, (fadeOutMs / 10), tenPercentVol
  );

  // Next video timeout.
  //  While this is queued, music should start to fade out
  //  from the interval above.
  var nextVideoTimeoutMs = milliSecondsRemaining < fadeOutMs ?
    milliSecondsRemaining : fadeOutMs;

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
  isQuizManuallyStopped = true;
  setQuizStatusDisplay('(Quiz is paused until next video)<br>Title: <b>' + getVideoTitle() + '</b><br>');
  deblurVideo();
  clearMessagesAndFutures();
  player.setVolume(lastVolume);
}

function setTimeLimitSeconds() {
  setGameSeconds();
  setVidSeconds();
}

function setGuessAsFinished(secondsRemaining) {
  isQuizForVideoDone = true;
  clearTimeout(this.guessTimeRemainingTimeoutId);

  deblurVideo();
  var message = 'Time\'s up! Answer was: <br><b>' + getVideoTitle() + '</b><br>';

  if (isEndOfPlaylist()) {
    isQuizForPlaylistDone = true;
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
      if (secondsRemaining < 0) {
        clearInterval(this.guessCountdownTimerId);
      } else {
        setSecondsRemaningMessage(message, secondsRemaining);
      }
      secondsRemaining -= 1;
      lastGuessTimeLimitSeconds = secondsRemaining >= 0 ? secondsRemaining : 0;
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
      lastVidTimeLeftSeconds = secondsRemaining >= 0 ? secondsRemaining : 0;
    },
    1000
  );
}

function setSecondsRemaningMessage(message, secondsRemaining) {
  setQuizCountdownDisplay('<br>' + message + ' ' + getSecondsMessage(secondsRemaining));
}

function isEndOfPlaylist() {
  if (!(player.getPlaylist())) {
    return true;
  }

  var lastIndex = player.getPlaylist().length - 1;
  var currentIndex = player.getPlaylistIndex();
  return currentIndex === lastIndex;
}

function getVideoTitle() {
  return player.getVideoData().title;
}

function deblurVideo() {
  document.getElementById('player').style.filter = "blur(0px) sepia(0%)";
}

function blurVideo() {
  document.getElementById('player').style.filter = "blur(70px) sepia(60%)";
}

function setGameSeconds() {
  guessTimeLimitSeconds = Number(document.getElementById('guessTimeLimitSeconds').value);
  if (guessTimeLimitSeconds < 1) {
    document.getElementById('guessTimeLimitSeconds').value = 1;
    guessTimeLimitSeconds = 1;
  }
  document.getElementById('quizCountdownCurrentValue').innerHTML = 'Current value: <b>' + guessTimeLimitSeconds + "</b>";
}

function setVidSeconds() {
  vidTimeLeftSeconds = Number(document.getElementById('vidTimeLeftSeconds').value);
  if (vidTimeLeftSeconds < 1) {
    document.getElementById('vidTimeLeftSeconds').value = 1;
    vidTimeLeftSeconds = 1;
  }
  document.getElementById('nextVideoCountdownCurrentValue').innerHTML = 'Current value: <b>' + vidTimeLeftSeconds + "</b>";
}

function setQuizStatusDisplay(message) {
  document.getElementById('quizStatusDisplay').innerHTML = message;
}

function setQuizCountdownDisplay(message) {
  document.getElementById('quizCountdownDisplay').innerHTML = message;
}

function setLoadPlaylistError(message) {
  document.getElementById('errorMessage').innerHTML = message;
}

function clearError() {
  document.getElementById('errorMessage').innerHTML = "";
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

function configurePlayerShuffle() {
  if (!player) { return; }
  //player.setShuffle(document.getElementById("myCheck").checked);
}
