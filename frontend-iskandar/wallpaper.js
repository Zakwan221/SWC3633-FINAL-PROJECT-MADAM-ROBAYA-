// Live wallpaper: one background <video> whose file follows the theme, so only the one
// in use is downloaded. Dark theme gets the black loop, light the white one. It plays
// only on the pages listed in SHOW_ON; every other page has a plain background (the
// router in app.js sets data-route on <html>, and style.css hides the video there).
(function () {
  var video = document.getElementById('wallpaper');
  if (!video) return;

  var SOURCES = { dark: 'blacklivewallpaper.mp4', light: 'whitewalpaper.mp4' };
  var SHOW_ON = ['home', 'events'];
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function wanted() {
    return SHOW_ON.indexOf(document.documentElement.getAttribute('data-route')) !== -1;
  }

  function play() {
    var started = video.play();
    if (started && started.catch) started.catch(function () {});
  }

  // Browsers pause video-only media on a page that loads in the background (a new
  // tab, say) and do not restart it, so start again whenever it is next on screen.
  function resume() {
    if (!reduceMotion && wanted() && video.paused) play();
  }

  function sync() {
    if (!wanted()) { video.pause(); return; } // plain page: stop it, and do not download it
    var theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    if (video.getAttribute('data-theme') === theme) { resume(); return; }
    video.setAttribute('data-theme', theme);
    video.src = SOURCES[theme];
    if (reduceMotion) {
      // Hold the first frame instead of looping, for people who ask for less motion.
      video.autoplay = false;
      video.addEventListener('loadeddata', function () { video.pause(); }, { once: true });
    } else {
      play();
    }
  }

  video.addEventListener('canplay', resume);
  document.addEventListener('visibilitychange', resume);
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      if (entries[0] && entries[0].isIntersecting) resume();
    }).observe(video);
  }

  sync();
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-route'] });
})();
