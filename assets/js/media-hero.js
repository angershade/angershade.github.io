// Media Hero: adaptive readability over image or looping video.
// No external services. Uses HTML5 video + tiny Canvas sampling.
// Works with multiple sections on a page.

(function(){
  document.addEventListener('DOMContentLoaded', () => {
    const heroes = document.querySelectorAll('.media-hero');
    heroes.forEach(setupHero);
  });

  function setupHero(hero){
    const imgSrc   = (hero.dataset.bg || "").trim();
    const videoRaw = (hero.dataset.video || "").trim();
    const poster   = (hero.dataset.poster || "").trim();
    const pos      = (hero.dataset.position || 'center center').trim();

    hero.style.setProperty('--bg-position', pos);

    if(videoRaw){
      // VIDEO MODE
      const sources = videoRaw.split(',').map(s => s.trim()).filter(Boolean);
      setupVideo(hero, sources, poster, pos);
    }else if(imgSrc){
      // IMAGE MODE
      enableImageMode(hero, imgSrc, pos);
    }else{
      console.warn('Provide either data-video (mp4/mov) or data-bg (image) on .media-hero');
    }
  }

  function setupVideo(hero, sources, poster, pos){
    const video = document.createElement('video');
    video.className   = 'bg-video';
    video.muted       = true;       // required for autoplay
    video.autoplay    = true;
    video.playsInline = true;       // iOS inline playback
    video.loop        = true;       // looping, per request
    video.preload     = 'metadata'; // let browser manage buffering
    if(poster) video.poster = poster;

    // If hosting on a different origin AND you send proper CORS headers,
    // uncomment next line so Canvas sampling can work cross-origin:
    // video.crossOrigin = 'anonymous';

    for(const src of sources){
      const type = guessType(src);
      const el = document.createElement('source');
      el.src = src; if(type) el.type = type;
      video.appendChild(el);
    }

    hero.prepend(video);

    // Adaptive tuning: sample frames ~2x/sec
    const w = 64, h = 64;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    let stopped = false;
    let lastSample = 0;

    function onFrame(){
      if(stopped) return;
      const now = performance.now();
      if(now - lastSample < 500){ requestAnimationFrame(onFrame); return; }
      lastSample = now;

      try{
        if(video.readyState >= 2 && video.videoWidth && video.videoHeight){
          const ratio = Math.max(w / video.videoWidth, h / video.videoHeight);
          const dw = video.videoWidth * ratio;
          const dh = video.videoHeight * ratio;
          const dx = (w - dw) / 2;
          const dy = (h - dh) / 2;
          ctx.clearRect(0,0,w,h);
          ctx.drawImage(video, dx, dy, dw, dh);
          const { data } = ctx.getImageData(0, 0, w, h);
          applyAdaptiveFromPixelData(hero, data);
        }
      }catch(err){
        console.warn('Video adaptive tuning skipped (likely CORS). Using safe defaults.', err);
        setConservativeDefaults(hero);
        stopped = true;
      }
      requestAnimationFrame(onFrame);
    }

    video.addEventListener('loadeddata', () => requestAnimationFrame(onFrame));
    video.addEventListener('error', () => {
      console.error('Video failed to load. Check data-video paths and file types.');
      setConservativeDefaults(hero);
    });

    // Ensure object-position matches desired focal point
    hero.style.setProperty('--bg-position', pos);
  }

  function enableImageMode(hero, src, pos){
    hero.style.setProperty('--bg-image', `url("${src}")`);
    hero.style.setProperty('--bg-position', pos);

    const img = new Image();
    // If remote with CORS headers, uncomment next line:
    // img.crossOrigin = 'anonymous';
    img.src = src;

    img.onload = function(){
      try{
        const w = 48, h = 48;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');

        const ratio = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const dw = img.naturalWidth * ratio;
        const dh = img.naturalHeight * ratio;
        const dx = (w - dw) / 2;
        const dy = (h - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        const { data } = ctx.getImageData(0, 0, w, h);
        applyAdaptiveFromPixelData(hero, data);
      }catch(err){
        console.warn('Image adaptive tuning skipped (likely CORS). Using safe defaults.', err);
        setConservativeDefaults(hero);
      }
    };

    img.onerror = function(){
      console.error('Background image failed to load. Check data-bg path and file name.');
      setConservativeDefaults(hero);
    };
  }

  function applyAdaptiveFromPixelData(hero, data){
    let sum = 0, sumSq = 0, n = 0;
    for(let i = 0; i < data.length; i += 4){
      const r = data[i], g = data[i+1], b = data[i+2];
      // Rec. 709 luminance
      const y = 0.2126*r + 0.7152*g + 0.0722*b; // 0..255
      sum += y; sumSq += y*y; n++;
    }
    const avg = sum / n;
    const variance = Math.max(0, (sumSq / n) - (avg*avg));
    const stdev = Math.sqrt(variance);

    // Map brightness to overlay strength—brighter background => darker scrim
    const min = 0.34, max = 0.70;
    const overlay = clamp(min + (avg/255)*(max - min), min, max);

    // Busy visuals get more blur (and a touch of desaturation)
    const blur = stdev > 60 ? map(stdev, 60, 90, 1.5, 3.0) : map(stdev, 20, 60, 0.0, 1.5);
    const saturate = stdev > 75 ? 0.9 : 1.0;

    hero.style.setProperty('--overlay', overlay.toFixed(2));
    hero.style.setProperty('--blur', `${clamp(blur, 0, 3).toFixed(2)}px`);
    hero.style.setProperty('--saturate', saturate.toFixed(2));
  }

  function setConservativeDefaults(hero){
    hero.style.setProperty('--overlay', '.55');
    hero.style.setProperty('--blur', '1px');
    hero.style.setProperty('--saturate', '1');
  }

  function clamp(v, lo, hi){ return Math.min(hi, Math.max(lo, v)); }
  function map(v, inMin, inMax, outMin, outMax){
    const t = (v - inMin) / (inMax - inMin);
    return outMin + Math.min(1, Math.max(0, t)) * (outMax - outMin);
  }

  function guessType(src){
    const ext = src.split('?')[0].split('#')[0].trim().toLowerCase().split('.').pop();
    if(ext === 'mp4') return 'video/mp4';
    if(ext === 'mov') return 'video/quicktime';
    return '';
  }
})();