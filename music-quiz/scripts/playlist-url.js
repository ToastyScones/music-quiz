function parseTimeInput(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  var trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  if (trimmed.includes(':')) {
    var parts = trimmed.split(':');
    if (parts.length !== 2) {
      return null;
    }

    var minutes = Number(parts[0]);
    var seconds = Number(parts[1]);

    if (isNaN(minutes) || isNaN(seconds) || minutes < 0 || seconds < 0 || seconds >= 60) {
      return null;
    }

    return minutes * 60 + seconds;
  }

  var asNumber = Number(trimmed);
  if (isNaN(asNumber) || asNumber < 0) {
    return null;
  }

  return Math.floor(asNumber);
}

function formatSecondsAsMmSs(seconds) {
  if (!seconds || seconds <= 0) {
    return '';
  }

  var totalSeconds = Math.floor(seconds);
  var minutes = Math.floor(totalSeconds / 60);
  var remainingSeconds = totalSeconds % 60;
  return minutes + ':' + String(remainingSeconds).padStart(2, '0');
}

function parseTimestampParams(params) {
  var timestamps = {};

  params.forEach(function (value, key) {
    if (!key.startsWith('t') || key.length < 2) {
      return;
    }

    var position = Number(key.substring(1));
    var seconds = Number(value);

    if (isNaN(position) || isNaN(seconds) || position < 1) {
      return;
    }

    timestamps[position - 1] = seconds;
  });

  return timestamps;
}

function parseOrderParam(orderValue) {
  if (!orderValue) {
    return null;
  }

  var ids = orderValue.split(',').map(function (id) { return id.trim(); }).filter(function (id) { return id; });
  return ids.length > 0 ? ids : null;
}

function parsePlaylistInput(text) {
  var result = {
    playlistId: null,
    videoOrder: null,
    timestamps: {},
    firstVideoId: null,
    error: null
  };

  if (!text || !text.trim()) {
    result.error = 'Value cannot be empty';
    return result;
  }

  var trimmed = text.trim();

  try {
    var url = new URL(trimmed);
    var urlHostname = url.hostname.toLowerCase();

    if (!urlHostname.includes('youtube') && !urlHostname.includes('youtu.be')) {
      result.error = 'Invalid YouTube URL';
      return result;
    }

    var params = url.searchParams;
    result.playlistId = params.get('list');
    result.firstVideoId = params.get('v');
    result.videoOrder = parseOrderParam(params.get('order'));
    result.timestamps = parseTimestampParams(params);

    if (!result.playlistId) {
      result.error = 'Invalid YouTube playlist URL (needs a list= query param)';
      return result;
    }
  } catch (_) {
    result.playlistId = trimmed;
  }

  return result;
}

function arraysEqual(a, b) {
  if (!a || !b || a.length !== b.length) {
    return false;
  }

  for (var i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

function buildPlaylistUrl(options) {
  var playlistId = options.playlistId;
  var videoOrder = options.videoOrder || [];
  var timestamps = options.timestamps || {};
  var youtubeOrder = options.youtubeOrder;

  if (!playlistId || videoOrder.length === 0) {
    return '';
  }

  var params = new URLSearchParams();
  params.set('list', playlistId);

  var includeOrder = youtubeOrder && !arraysEqual(videoOrder, youtubeOrder);
  if (includeOrder) {
    params.set('order', videoOrder.join(','));
  }

  Object.keys(timestamps).forEach(function (key) {
    var index = Number(key);
    var seconds = timestamps[key];
    if (!isNaN(index) && seconds > 0) {
      params.set('t' + (index + 1), String(seconds));
    }
  });

  return 'https://www.youtube.com/playlist?' + params.toString();
}
