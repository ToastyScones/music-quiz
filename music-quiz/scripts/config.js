// ============================================================================
// YouTube Data API configuration
// ============================================================================
// The playlist queue list can display each playlist's title, author, and
// thumbnail. That data comes from the YouTube Data API v3, which requires an
// API key.
//
// To enable it:
//   1. Create a key at https://console.cloud.google.com/apis/credentials
//   2. Enable the "YouTube Data API v3" for the same project.
//   3. Paste the key below, e.g.  YOUTUBE_API_KEY = 'AIza...';
//
// NOTE: This is a static site, so the key is loaded client-side. Restrict it
// in Google Cloud (referrer/IP) to your site to avoid quota abuse.
//
// If YOUTUBE_API_KEY is left empty, the queue list degrades gracefully: it
// shows the playlist ID (plus the first video's thumbnail when the pasted URL
// carried one) and simply omits the title/author.
var YOUTUBE_API_KEY = '';
