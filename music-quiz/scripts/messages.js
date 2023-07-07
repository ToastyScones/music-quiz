function getEndOfPlaylistMessage() {
  return 'End of playlist <img src="' + getEndOfPlaylistEmote() + '" width="50" height="50">';
}

function getSecondsMessage(seconds) {
  if (seconds === 1) {
    return '<b>1</b> second'
  }
  return '<b>' + seconds + '</b> seconds'
}

function getFriendlyYoutubeAPIError(eventDataCode) {
  var baseMessage = 'Error: Video could not be played. Code: ' + eventDataCode + '<br>Message: <b>'
  switch (Number(eventDataCode)) {
    case 2:
      return baseMessage + 'The request contains an invalid video ID value.' + '</b>';
    case 5:
      return baseMessage + 'The requested content cannot be played in an HTML5 player.' + '</b>';
    case 100:
      return baseMessage + 'The video requested was not found or is private.' + '</b>';
    case 101:
    case 150:
      return baseMessage + 'Playlist is private, ID is invalid, or the owner of the requested video does not allow it to be played in embedded players' + '</b>';
    default:
      return baseMessage + 'Unknown error (spooky)' + '</b>';
  }
}

function printEventData(eventData) {
  if (eventData === YT.PlayerState.PLAYING) {
    console.log('YT.PlayerState.PLAYING');
  } else if (eventData === YT.PlayerState.PAUSED) {
    console.log('YT.PlayerState.PAUSED');
  } else if (eventData === YT.PlayerState.ENDED) {
    console.log('YT.PlayerState.ENDED');
  } else if (eventData === YT.PlayerState.BUFFERING) {
    console.log('YT.PlayerState.BUFFERING');
  } else if (eventData === -1) {
    console.log('UNSTARTED (-1)');
  } else {
    console.log('UNKNOWN: ' + eventData);
  }
}

function setUnknownPreviousVideoMessage() {
  let title = context.previousVideoTitle ?? '[I don\'t know, you\'re clicking too fast!! ＞ᨓ＜]';

  document.getElementById('last-answer-text').innerHTML =
    '<b-magenta>Previous Answer</b-magenta><br><b>' + title + '</b>';
  document.getElementById('previous-answer').style.display = "flex";
}

function getVideoDidNotLoadMessage() {
  return 'I don\'t know!! ＞ᨓ＜ <br>[The YouTube API doesn\'t instantly load, ' +
    'so clicking Reveal Answer causes issues before loading is complete. ' +
    'Click it again after the video loads.]'
}

function setQuizReadyDisplay() {
  document.getElementById('quiz-status-display').innerHTML = '[Waiting for quiz to start]';
  document.getElementById('quiz-status').style.display = 'flex';
  document.getElementById('playerParent').style.background = '#FFFFFF';
  document.getElementById('preQuizText').style.position = 'absolute';
  document.getElementById('preQuizText').innerHTML = '<b>Click the green play button below to start the quiz!</b>';
}

function setPlaylistOrderDisplay(currentIndex, maxSize) {
  document.getElementById('playlist-video-order').innerHTML = currentIndex + '/' + maxSize;
  document.getElementById('middle-video-controls').style.display = 'flex';
}

function setQuizStatusDisplay(message) {
  document.getElementById('quiz-status-display').innerHTML = message;
}

function setQuizCountdownDisplay(message) {
  document.getElementById('quiz-countdown-display').innerHTML = message;
}

function setLoadPlaylistError(message) {
  document.getElementById('errorMessage').innerHTML = message;
}

function clearError() {
  document.getElementById('errorMessage').innerHTML = '';
}

function setSecondsRemaningMessage(message, secondsRemaining) {
  setQuizCountdownDisplay('<br>' + message + ' ' + getSecondsMessage(secondsRemaining));
}

function setCountdownSettingDisplay(settingSourceElement, currentValueElement, currentValue) {
  document.getElementById(settingSourceElement).value = currentValue;
  document.getElementById(currentValueElement).innerHTML = 'Current value: <b>' + currentValue + "</b>";
}

function toggleQuizStatusAlignment(element) {
  let flexDirection = element.checked ? 'row' : 'column';
  let textAlign = element.checked ? 'left' : 'center';

  let quizStatusElement = document.getElementById('quiz-status');
  let prevAnswerElement = document.getElementById('previous-answer');

  quizStatusElement.style.flexDirection = flexDirection;
  quizStatusElement.style.textAlign = textAlign;
  prevAnswerElement.style.flexDirection = flexDirection;
  prevAnswerElement.style.textAlign = textAlign;
}

function clearPlaylistCounter() {
  document.getElementById('playlist-video-order').innerHTML = '';
}