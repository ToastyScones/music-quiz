
class YTPlayerWrapper {
  currentPlaylist; 
  player1;
  player2;

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
    return;

    // TODO might need a race condition check here
    var videoId = this.currentPlaylist.getVideoIdAt(index);
    this.currentPlaylist.setIndex(index);
    this.ytPlayer.loadVideoById(videoId);
  }

  pauseVideo() {
    this.ytPlayer.pauseVideo();
  }

  stopVideo() {
    this.ytPlayer.stopVideo();
  }

  previousVideo() {
    this.ytPlayer.previousVideo();
    return;

    // TODO might need a race condition check here
    var previousVideoId = this.currentPlaylist.getPreviousVideoId();
    this.currentPlaylist.decrementIndex();
    this.ytPlayer.loadVideoById(previousVideoId);
  }

  nextVideo() {
    this.ytPlayer.nextVideo();
    return;

    // TODO might need a race condition check here
    var nextVideoId = this.currentPlaylist.getNextVideoId();
    this.currentPlaylist.incrementIndex();
    this.ytPlayer.loadVideoById(nextVideoId);
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
    return;
    
    //playlist will be changed to videoIds
    this.currentPlaylist = new Playlist(videoIds);
    this.ytPlayer.cueVideoById(this.currentPlaylist.getVideoIdAt(0));
  }

  loadPlaylist(playlist, index) {
    // has an optional startSeconds param
    this.ytPlayer.loadPlaylist(playlist, index);

    return;

    //playlist will be changed to videoIds
    this.currentPlaylist = new Playlist(videoIds);
    this.ytPlayer.loadVideoById(this.currentPlaylist.getVideoIdAt(0));
  }

  getPlaylist() {
    return this.ytPlayer.getPlaylist();
    return this.currentPlaylist.getVideoIds();
  }

  getPlaylistIndex() {
    return this.ytPlayer.getPlaylistIndex();
    return this.currentPlaylist.getCurrentIndex();
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



class Playlist {
  videoIds;
  currentIndex;

  constructor(videoIds) {
    this.videoIds = videoIds;
    this.currentIndex = 0;
  }

  getVideoIdAt(index) {
    return this.videoIds[index];
  }

  getVideoIds() {
    return this.videoIds;
  }

  getNextVideoId() {
    //TODO add index check
    return this.videoIds[this.currentIndex + 1];
  }

  getPreviousVideoId() {
    //TODO add index check
    return this.videoIds[this.currentIndex - 1];
  }

  getCurrentIndex() {
    return this.currentIndex;
  }

  setIndex(index) {
    if (index < 0 || index >= this.videoIds.length) {
      throw 'index out of range';
    }

    this.currentIndex = index;
  }

  incrementIndex() {
    if (this.currentIndex < this.videoIds.length - 1){
      this.currentIndex = this.currentIndex + 1;
    }
  }

  decrementIndex() {
    if (this.currentIndex > 0){
      this.currentIndex = this.currentIndex - 1;
    }
  }

  length() {
    if (!this.videoIds || typeof this.videoIds !== 'array') {
      return -1;
    }
    return this.videoIds.length;
  }
}