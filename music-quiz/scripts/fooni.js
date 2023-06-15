const emoteList = [
  'ratJAM.webp',
  'banan.webp',
  'PREGGERS.webp',
  'friday-night.webp',
  'intotheayaya.webp',
  'kleerave.webp',
  'kkool.webp',
  'apuband.webp',
  'catcampfire.webp',
  'assemble.webp',
  'scatter.webp'
]
const emoteFolderDir = 'images/emotes/'

var curEmoteIndex = 0;

function initializeHeaderEmote() {
  curEmoteIndex = Math.floor(Math.random() * emoteList.length);
  setHeaderEmote();
}

function loadNextImg() {
  curEmoteIndex++;
  if (curEmoteIndex < 0 || curEmoteIndex >= emoteList.length) {
    curEmoteIndex = 0;
  }

  setHeaderEmote();
}

function setHeaderEmote(imgSrc) {
  document.getElementById('fooni-header').src = ''; // prevents weird image stretching when loading the new image
  document.getElementById('fooni-header').src = emoteFolderDir + emoteList[curEmoteIndex];
}
