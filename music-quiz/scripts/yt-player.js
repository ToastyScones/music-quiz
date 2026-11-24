
class YTPlayerWrapper {
  ytPlayer;
  currentPlaylist; 
  player1;
  player2;
  previousVideoTitle;

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
    // TODO might need a race condition check here
    this.setPrevVideoTitleToCurrentTitle();

    var videoId = this.currentPlaylist.getVideoIdAt(index);
    this.currentPlaylist.setIndex(index);
    this.ytPlayer.loadVideoById(videoId, this.getStartingSeconds());
  }

  pauseVideo() {
    this.ytPlayer.pauseVideo();
  }

  stopVideo() {
    this.ytPlayer.stopVideo();
  }

  previousVideo() {
    // TODO might need a race condition check here
    this.setPrevVideoTitleToCurrentTitle();
    
    var previousVideoId = this.currentPlaylist.getPreviousVideoId();
    this.currentPlaylist.decrementIndex();
    this.ytPlayer.loadVideoById(previousVideoId, this.getStartingSeconds());
  }

  nextVideo() {
    // TODO might need a race condition check here
    // TODO load video at seconds if applicable
    this.setPrevVideoTitleToCurrentTitle();

    var nextVideoId = this.currentPlaylist.getNextVideoId();
    this.currentPlaylist.incrementIndex();
    this.ytPlayer.loadVideoById(nextVideoId, this.getStartingSeconds());
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

  cuePlaylist(videoIds, index) {
    this.currentPlaylist = new Playlist(videoIds);
    this.currentPlaylist.setIndex(index);

    this.ytPlayer.cueVideoById(this.currentPlaylist.getVideoIdAt(index), this.getStartingSeconds());
  }

  loadPlaylist(videoIds, index) {
    this.currentPlaylist = new Playlist(videoIds);
    this.currentPlaylist.setIndex(index);

    this.ytPlayer.loadVideoById(this.currentPlaylist.getVideoIdAt(index), this.getStartingSeconds());
  }

  getPlaylist() {
    return this.currentPlaylist.getVideoIds();
  }

  getPlaylistIndex() {
    return this.currentPlaylist.getCurrentIndex();
  }

  getPlayerState() {
    return this.ytPlayer.getPlayerState();
  }

  getVideoData() {
    return this.ytPlayer.getVideoData();
  }

  getCurrentVideoId() {
    return this.currentPlaylist.getCurrentVideoId();
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

  setPrevVideoTitleToCurrentTitle() {
    try{
      this.previousVideoTitle = context.videoTitles.get(this.currentPlaylist.getCurrentVideoId()) 
        ?? this.getVideoData().title;
    } catch {
      try {
        this.previousVideoTitle = this.getVideoData().title;
      } catch {
        this.previousVideoTitle = "Could not fetch title for video id " + this.currentPlaylist.getCurrentVideoId();
      }
    }
  }

  getPreviousAnswer() {
    return this.previousVideoTitle;
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

  doesSetVolumeExist() {
    return this.doesFuncExist(this.ytPlayer.setVolume);
  }

  doesFuncExist(func) {
    if (typeof func === 'function') {
      return true;
    }
    return false;
  }

  getStartingSeconds() {
    if (!context?.vidTimestamps) {
      return 0;
    }
    return context.vidTimestamps[this.getPlaylistIndex()]
  }

  destroy() {
    this.ytPlayer.destroy();
  }
}

// TODO move to own file
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

  getCurrentVideoId() {
    //TODO add index check
    return this.videoIds[this.currentIndex];
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