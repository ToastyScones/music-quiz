function getEndOfPlaylistMessage() {
  return 'End of playlist <img src="images/emotes/umaruCry.webp" width="50" height="50">';
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
  }else if (eventData === -1) {
    console.log('UNSTARTED (-1)');
  } else {
    console.log('UNKNOWN: ' + eventData);
  }
}

function getPlaylistOrderDisplay(currentIndex, maxSize) {
  return currentIndex + '/' + maxSize;
}