# music-quiz
Basic GitHub page for YouTube music quizzes.

Link: https://toastyscones.github.io/music-quiz/

## Usage
Copy a YouTube playlist URL or ID, paste into the **YT Playlist URL or ID** field, and click Load Playlist. Press Play to start the quiz!

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
### Video won't load
YouTube or the user has disabled embedded play that vid, or the video got marked as private/deleted.

Event codes: https://developers.google.com/youtube/iframe_api_reference#Events

If you're running it locally, some videos won't load if you're running from a local path or IP. See https://stackoverflow.com/a/56419165


### Music doesn't fade out
On some browsers, like Firefox, setInterval is limited if you lose focus on the tab (e.g. tabbing out, minimizing the browser, etc.). For now, you will need to keep the tab open and visible. 
