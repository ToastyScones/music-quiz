
class YTPlayerWrapper {
  constructor(onPlayerReady, onPlayerStateChange, onError) {
    this.ytPlayer = new YT.Player('player', {
      height: '390',
      width: '640',
      playerVars: {
        'disablekb': 1,
        'autoplay': 1,
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
  }

  playVideo() {
    this.ytPlayer.playVideo();
  }

  playVideoAt(index) {
    this.ytPlayer.playVideoAt(index);
  }

  pauseVideo() {
    this.ytPlayer.pauseVideo();
  }

  stopVideo() {
    this.ytPlayer.stopVideo();
  }

  previousVideo() {
    this.ytPlayer.previousVideo();
  }

  nextVideo() {
    this.ytPlayer.nextVideo();
  }

  setVolume(volume) {
    this.ytPlayer.setVolume(volume);
  }

  getVolume() {
    return this.ytPlayer.getVolume();
  }

  seekTo(seconds) {
    this.ytPlayer.seekTo(seconds);
  }

  cuePlaylist(playlist, index) {
    // has an optional startSeconds param
    this.ytPlayer.cuePlaylist(playlist, index);
  }

  loadPlaylist(playlist, index) {
    // has an optional startSeconds param
    this.ytPlayer.loadPlaylist(playlist, index);
  }

  getPlaylist() {
    return this.ytPlayer.getPlaylist();
  }

  getPlaylistIndex() {
    return this.ytPlayer.getPlaylistIndex();
  }

  getPlayerState() {
    return this.ytPlayer.getPlayerState();
  }

  getVideoData() {
    return this.ytPlayer.getVideoData();
  }

  mute() {
    return this.ytPlayer.mute();
  }

  unMute() {
    return this.ytPlayer.unMute();
  }

  isMuted() {
    return this.ytPlayer.isMuted();
  }

  doesCuePlaylistExist() {
    return this.doesFuncExist(this.ytPlayer.cuePlaylist);
  }

  doesLoadPlaylistExist() {
    return this.doesFuncExist(this.ytPlayer.loadPlaylist);
  }

  doesGetPlaylistExist() {
    return this.doesFuncExist(this.ytPlayer.getPlaylist);
  }

  doesDestroyExist() {
    return this.doesFuncExist(this.ytPlayer.destroy);
  }

  doesGetVideoDataExist() {
    return this.doesFuncExist(this.ytPlayer.getVideoData);
  }

  doesFuncExist(func) {
    if (typeof func === 'function') {
      return true;
    }
    return false;
  }

  destroy() {
    this.ytPlayer.destroy();
  }
}
