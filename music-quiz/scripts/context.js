class QuizContext {
  fadeOutMs;
  guessTimeLimitSeconds;
  vidTimeLeftSeconds;
  isPaused;
  isQuizManuallyStopped;
  isQuizForVideoDone;
  isQuizForPlaylistDone;
  didVideoError;
  lastGuessTimeLimitSeconds;
  lastVidTimeLeftSeconds;
  didVideoJustChange;
  vidTimestamps;
  hasSeekToBeenApplied;
  needLastVolumeApplied;
  previousVideoIndex;
  previousVideoTitle;

  constructor() {
    this.initialize();
  }

  initialize() {
    this.fadeOutMs = 2000;
    this.isPaused = false;
    this.isQuizManuallyStopped = false;
    this.isQuizForVideoDone = false;
    this.isQuizForPlaylistDone = false;
    this.didVideoError = false;
    this.didVideoJustChange = false;
    this.vidTimestamps = {};
    this.hasSeekToBeenApplied = false;
    this.needLastVolumeApplied = false;
    this.previousVideoIndex = 0;
    this.previousVideoTitle = ''
  }

  setNextVideoState() {
    this.isPaused = false;
    this.isQuizManuallyStopped = false;
    this.isQuizForVideoDone = false;
    this.isQuizForPlaylistDone = false;
    this.hasSeekToBeenApplied = false;
    this.lastVidTimeLeftSeconds = undefined;
  }

  setTimeLimitSeconds() {
    this.setGameSeconds();
    this.setVidSeconds();
  }

  setGameSeconds() {
    this.guessTimeLimitSeconds = this.getCountdownSeconds('guessTimeLimitSeconds');
    setCountdownSettingDisplay('guessTimeLimitSeconds', 'quizCountdownCurrentValue', this.guessTimeLimitSeconds);
  }
  
  setVidSeconds() {
    this.vidTimeLeftSeconds = this.getCountdownSeconds('vidTimeLeftSeconds');
    setCountdownSettingDisplay('vidTimeLeftSeconds', 'nextVideoCountdownCurrentValue', this.vidTimeLeftSeconds);
  }

  getCountdownSeconds(sourceElement) {
    var seconds = Number(document.getElementById(sourceElement).value);
    if (seconds < 1) {
      document.getElementById(sourceElement).value = 1;
      seconds = 1;
    }
    return seconds;
  }

  setPreviousAnswerState(playlistIndex, videoTitle) {
    this.previousVideoIndex = playlistIndex;
    this.previousVideoTitle = videoTitle;
  }
}