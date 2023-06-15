# music-quiz
Basic GitHub page for YouTube music quizzes.

Link: https://toastyscones.github.io/music-quiz/

## Usage
Copy a YouTube playlist URL or ID, paste into the **YT Playlist URL or ID** field, and click Load Playlist. Finally, press the green play button to start the quiz.

YouTube playlist must be set to **public** or **unlisted**; Private playlists won't work.

YT URL example:
```
https://www.youtube.com/watch?v=U-g0N1hqIKo&list=PLfRFOBVf8C8dgruEoZR6aF1q1487QJ5iZ
```

YT Playlist ID example:
```
PLfRFOBVf8C8dgruEoZR6aF1q1487QJ5iZ
```

### Setting a start time for specific videos
You can specify the start time for specific videos in the playlist by adding one or more of the following query params in the URL:

```
t[X]=[number of seconds]
``` 

**\[X\]** is the order number of the video within the playlist and **\[number of seconds\]** is the timestamp where the video will start.

For example, if I wanted to start the first video at 30 seconds, and the third video at 13 seconds, then my playlist URL would look like:

```
https://www.youtube.com/watch?v=U-g0N1hqIKo&list=PLfRFOBVf8C8dgruEoZR6aF1q1487QJ5iZ&index=1&t1=30&t3=13
```

**Note:** This only works with URLs, not playlist IDs.

## Troubleshooting
### Muted audio/audio doesn't fade out/countdown acting weird/next video kicking off early
For now, you will need to keep the website visible somewhere on your desktop so your browser doesn't lose focus.

This app uses setInterval and setTimeout in a lot of its functionality, and both of those have degraded performance on tabs that lose focus (i.e. tabs that are tabbed out, minimized, etc.)

This was only tested on Firefox and Chromium, so other browsers may have even more unexpected issues. ( • ᴖ • )

For Chrome/Chromium, turning on the 'Sites can play sound' option seemed to have helped.

### Audio between videos is unbalanced

The issue is that the videos themselves have different audio levels.

Unforunately, audio compressors (within this site's JavaScript or through a browser extension/add-on) won't work. Due to CORS restrictions, the audio from the embedded player can't be maniuplated from outside a YouTube domain.

You can test this out by installing a YouTube audio compressor extension/add-on. It'll work on the actual YouTube site, but not here. (◞‸◟；)

You can also enable 'Enable Loudness Equalization' in Windows for your device, but it will affect all audio sources.

### Video won't load
YouTube or the user has disabled embedded play, or the video got marked as private/deleted.

Event codes: https://developers.google.com/youtube/iframe_api_reference#Events

If you're running it locally, some videos won't load if you're running from a local path or IP. See https://stackoverflow.com/a/56419165

### Autoplay doesn't work
Enable autoplay for your browser:

* Firefox: https://support.mozilla.org/en-US/kb/block-autoplay
* Opera: https://forums.opera.com/post/211179
* Chrome/Chromium (couldn't find an official source, so here are some copy paste instructions):
  * Settings -> Privacy and security -> Site settings -> Additional Content Settings -> Sound -> Sites can play sound