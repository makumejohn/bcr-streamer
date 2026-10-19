// BCR Streamer - Free, ad-free, online-only
// IndexedDB persistence — songs stay after reload (Option 1)
// No subscriptions, payments, or downloads

// Seed track (Ficksburg cover) — will be saved to IndexedDB on first load
const seedTracks = [
  {
    id: 101,
    title: "Told You I Can",
    artist: "BCR Studios",
    genre: "R&B",
    duration: "—",
    seconds: 0,
    src: "", // no MP3 yet — add via uploader or workspace
    cover: "assets/told-you-i-can-rnb.png",
    color: "linear-gradient(135deg,#0a1931 0%, #1e3a5a 100%)",
    icon: "♪"
  }
];

let tracks = [...seedTracks]; // will be overwritten by IndexedDB on load

let currentId = null;
let isPlaying = false;
let favorites = new Set(JSON.parse(localStorage.getItem('bcr_favs')||'[]'));
let recent = JSON.parse(localStorage.getItem('bcr_recent')||'[]');
let queue = [...tracks];
let filterGenre = 'all';
let searchQ = '';
let viewAll = false;

const audio = document.getElementById('audio');
const cardsScroll = document.getElementById('cardsScroll');
const trackList = document.getElementById('trackList');
const miniCover = document.getElementById('miniCover');
const miniCoverPh = document.getElementById('miniCoverPh');
const miniTitle = document.getElementById('miniTitle');
const miniArtist = document.getElementById('miniArtist');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const progressFill = document.getElementById('progressFill');
const seek = document.getElementById('seek');
const curTime = document.getElementById('curTime');
const durTime = document.getElementById('durTime');
const allTracksSection = document.getElementById('allTracksSection');
const drawer = document.getElementById('drawer');
const drawerList = document.getElementById('drawerList');
const overlay = document.getElementById('overlay');

function fmt(t){
  const m=Math.floor(t/60), s=Math.floor(t%60);
  return m+":"+(s<10?"0"+s:s);
}
function saveFav(){ localStorage.setItem('bcr_favs', JSON.stringify([...favorites])); updateFavBadge(); }
function saveRecent(){ localStorage.setItem('bcr_recent', JSON.stringify(recent.slice(0,20))); }
function updateFavBadge(){
  const b=document.getElementById('favBadge');
  if(favorites.size>0){ b.textContent=favorites.size; b.classList.remove('hidden'); } else b.classList.add('hidden');
}
function getFiltered(){
  return tracks.filter(t=>{
    const okGenre = filterGenre==='all' || t.genre===filterGenre;
    const q=searchQ.toLowerCase();
    const okSearch = !q || t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
    if(filterGenre==='favorites') return favorites.has(t.id) && okSearch;
    return okGenre && okSearch;
  });
}

// --- IndexedDB helpers ---
function openDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open('bcr-streamer-db', 1);
    req.onupgradeneeded = ()=>{ req.result.createObjectStore('tracks', {keyPath: 'id'}); };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}
async function loadPersistedTracks(){
  try{
    const db = await openDB();
    return await new Promise((resolve, reject)=>{
      const tx = db.transaction('tracks','readonly');
      const store = tx.objectStore('tracks');
      const req = store.getAll();
      req.onsuccess = ()=> resolve(req.result || []);
      req.onerror = ()=> reject(req.error);
    });
  } catch(e){ console.warn('IndexedDB load failed', e); return []; }
}
async function saveTrackToDB(track){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction('tracks','readwrite');
    // store blobs directly — they persist
    tx.objectStore('tracks').put(track);
    tx.oncomplete = ()=> resolve();
    tx.onerror = ()=> reject(tx.error);
  });
}
async function deleteTrackFromDB(id){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction('tracks','readwrite');
    tx.objectStore('tracks').delete(id);
    tx.oncomplete = ()=> resolve();
    tx.onerror = ()=> reject(tx.error);
  });
}
function blobToUrl(blob){ return blob ? URL.createObjectURL(blob) : ""; }

function updateStats(){ const s=document.getElementById('statTotal'); if(s) s.textContent=tracks.length; }

// Render Recently Played
function renderCards(){
  const list = getFiltered();
  let toShow = list;
  if(!searchQ && filterGenre==='all' && !viewAll){
    const recentTracks = recent.map(id=>tracks.find(t=>t.id===id)).filter(Boolean);
    const remaining = list.filter(t=>!recent.includes(t.id));
    toShow = [...recentTracks, ...remaining].slice(0,12);
    if(toShow.length===0) toShow=list;
  }
  cardsScroll.innerHTML='';
  const empty = document.getElementById('emptyState');
  if(toShow.length===0){
    empty.classList.remove('hidden');
    empty.innerHTML = `<p>🎵 No music yet</p><p style="margin-top:6px;font-size:11px;color:#9ab0cc">Upload your real songs via Owner Access — they will stay after reload</p>`;
    return;
  } else empty.classList.add('hidden');
  toShow.forEach(t=>{
    const el=document.createElement('div');
    el.className='card'+(currentId===t.id?' active':'');
    el.dataset.id=t.id;
    const hasCover = t.cover;
    el.innerHTML=`
      <div class="card-cover" style="background:${t.color}">
        ${hasCover ? `<img src="${t.cover}" alt="${t.title}" loading="lazy" onerror="this.style.display='none'">` : ''}
        <span class="ph" style="${hasCover?'display:none':''}">${t.icon}</span>
        <span class="play-badge">${currentId===t.id && isPlaying ? '❚❚' : '▶'}</span>
      </div>
      <div class="card-title">${t.title}</div>
      <div class="card-artist">${t.artist}</div>
    `;
    el.addEventListener('click', ()=> playTrack(t.id));
    cardsScroll.appendChild(el);
  });
}
function renderList(){
  const list=getFiltered();
  trackList.innerHTML='';
  const countEl = document.getElementById('trackCount');
  if(countEl) countEl.textContent = list.length+' tracks';
  if(list.length===0){
    trackList.innerHTML = `<div style="padding:20px;text-align:center;color:#7d8aa2;font-size:12px;border:1px dashed #1e3352;border-radius:12px">No tracks yet — unlock Owner Access to add your first song</div>`;
    return;
  }
  list.forEach(t=>{
    const row=document.createElement('div');
    row.className='row'+(currentId===t.id?' active':'');
    row.dataset.id=t.id;
    row.innerHTML=`
      <div class="row-cover" style="background:${t.color}">
        <img src="${t.cover}" alt="${t.title}" loading="lazy" onerror="this.style.display='none'">
      </div>
      <div class="row-meta">
        <strong>${t.title}</strong>
        <span>${t.artist} • ${t.genre} • ${t.duration}</span>
      </div>
      <div class="row-actions">
        <button class="${favorites.has(t.id)?'saved':''}" data-fav="${t.id}" aria-label="Favorite">${favorites.has(t.id)?'♥':'♡'}</button>
        <button class="row-play" data-play="${t.id}">${currentId===t.id && isPlaying ? '❚❚' : '▶'}</button>
      </div>
    `;
    row.addEventListener('click', (e)=>{
      if(e.target.closest('[data-fav]')){ toggleFav(t.id); return; }
      if(e.target.closest('[data-play]')){ playTrack(t.id); return; }
      playTrack(t.id);
    });
    trackList.appendChild(row);
  });
}
function renderDrawer(){
  drawerList.innerHTML='';
  if(queue.length===0){
    drawerList.innerHTML = `<div style="padding:20px;text-align:center;color:#7d8aa2;font-size:12px">No songs in queue — add music first</div>`;
    return;
  }
  queue.forEach(t=>{
    const r=document.createElement('div');
    r.className='row'+(currentId===t.id?' active':'');
    r.innerHTML=`
      <div class="row-cover" style="background:${t.color}"><img src="${t.cover}" alt="" onerror="this.style.display='none'"></div>
      <div class="row-meta"><strong>${t.title}</strong><span>${t.artist}</span></div>
      <div class="row-actions"><button class="row-play">${currentId===t.id && isPlaying?'❚❚':'▶'}</button></div>
    `;
    r.addEventListener('click',()=>{ playTrack(t.id); closeDrawer(); });
    drawerList.appendChild(r);
  });
}
function updatePlayerUI(){
  const t = tracks.find(x=>x.id===currentId);
  if(!t){
    miniTitle.textContent='No music yet';
    miniArtist.textContent='Upload a song via Owner Access to start streaming';
    miniCover.style.display='none';
    miniCoverPh.style.display='grid';
    miniCoverPh.textContent='♪';
    return;
  }
  miniTitle.textContent=t.title;
  miniArtist.textContent=t.artist;
  if(t.cover){
    miniCover.src=t.cover;
    miniCover.style.display='block';
    miniCoverPh.style.display='none';
    miniCover.onerror=()=>{ miniCover.style.display='none'; miniCoverPh.style.display='grid'; miniCoverPh.textContent=t.icon; };
  } else {
    miniCover.style.display='none';
    miniCoverPh.style.display='grid';
    miniCoverPh.textContent=t.icon;
    miniCoverPh.style.background=t.color;
  }
  if(isPlaying){ playIcon.classList.add('hidden'); pauseIcon.classList.remove('hidden'); }
  else { playIcon.classList.remove('hidden'); pauseIcon.classList.add('hidden'); }
  renderCards(); renderList(); renderDrawer();
  const heroBtn = document.getElementById('heroPlayBtn');
  if(heroBtn) heroBtn.textContent = isPlaying ? '❚❚  Now Streaming' : '▶   Play Now';
}
function playTrack(id){
  const t=tracks.find(x=>x.id===id);
  if(!t) return;
  if(!t.src){ toast(`“${t.title}” has no MP3 yet — add its audio via Owner Access`); return; }
  recent = [id, ...recent.filter(x=>x!==id)];
  saveRecent();
  if(currentId===id && audio.src){ togglePlay(); return; }
  currentId=id;
  queue = [...tracks];
  audio.src=t.src;
  audio.play().then(()=>{
    isPlaying=true;
    updatePlayerUI();
    toast(`Streaming: ${t.title} • ${t.artist}`);
  }).catch(e=>{
    isPlaying=false;
    updatePlayerUI();
    toast('Tap play again — browser blocked autoplay. Requires interaction.');
    console.error(e);
  });
}
function togglePlay(){
  if(!currentId){
    const first=getFiltered()[0] || tracks[0];
    if(first) playTrack(first.id);
    else toast('No music yet — unlock Owner Access to add a song');
    return;
  }
  if(!tracks.find(x=>x.id===currentId)?.src){ toast('This track has no audio file yet'); return; }
  if(isPlaying){ audio.pause(); isPlaying=false; toast('Paused'); }
  else { audio.play().then(()=>{ isPlaying=true; toast('Resumed'); }).catch(()=>toast('Need internet — streaming is online-only')); }
  updatePlayerUI();
}
function nextTrack(){
  if(!currentId) return;
  const list=getFiltered().length?getFiltered():tracks;
  const idx=list.findIndex(t=>t.id===currentId);
  const next=list[(idx+1)%list.length];
  if(next) playTrack(next.id);
}
function prevTrack(){
  if(!currentId) return;
  const list=getFiltered().length?getFiltered():tracks;
  const idx=list.findIndex(t=>t.id===currentId);
  const prev=list[(idx-1+list.length)%list.length];
  if(prev) playTrack(prev.id);
}
function toggleFav(id){
  if(favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  saveFav(); renderList(); renderCards();
  toast(favorites.has(id)?'Added to Favorites':'Removed from Favorites');
}
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer=setTimeout(()=>t.classList.add('hidden'), 2800);
}
// Events
document.getElementById('playPauseBtn').addEventListener('click', togglePlay);
document.getElementById('prevBtn').addEventListener('click', prevTrack);
document.getElementById('nextBtn').addEventListener('click', nextTrack);
document.getElementById('heroPlayBtn').addEventListener('click', ()=>{
  if(!currentId){
    const f=getFiltered()[0]||tracks[0];
    if(f) playTrack(f.id); else toast('No music yet — unlock Owner Access to add a song');
  } else togglePlay();
});
audio.addEventListener('timeupdate', ()=>{
  if(!audio.duration) return;
  const pct=(audio.currentTime/audio.duration)*100;
  progressFill.style.width=pct+'%';
  seek.value=pct;
  curTime.textContent=fmt(audio.currentTime);
  durTime.textContent=fmt(audio.duration||0);
});
audio.addEventListener('ended', nextTrack);
audio.addEventListener('play', ()=>{ isPlaying=true; updatePlayerUI(); });
audio.addEventListener('pause', ()=>{ isPlaying=false; updatePlayerUI(); });
audio.addEventListener('loadedmetadata', ()=>{ durTime.textContent=fmt(audio.duration); });
seek.addEventListener('input', ()=>{
  if(!audio.duration) return;
  const t=(seek.value/100)*audio.duration;
  audio.currentTime=t;
});
document.getElementById('progressBar').addEventListener('click', (e)=>{
  if(!audio.duration) return;
  const rect=e.currentTarget.getBoundingClientRect();
  const pct=(e.clientX-rect.left)/rect.width;
  audio.currentTime=pct*audio.duration;
});
const searchInput=document.getElementById('searchInput');
const searchOverlay=document.getElementById('searchOverlay');
document.getElementById('searchBtn').addEventListener('click', ()=>{
  searchOverlay.classList.toggle('hidden');
  if(!searchOverlay.classList.contains('hidden')) searchInput.focus();
  else { searchInput.value=''; searchQ=''; renderCards(); renderList(); }
});
document.getElementById('menuBtn').addEventListener('click', ()=>{
  allTracksSection.classList.toggle('hidden');
  viewAll = !allTracksSection.classList.contains('hidden');
  const titleEl = document.getElementById('allTracksTitle');
  if(titleEl) titleEl.textContent = viewAll ? 'Library' : 'All Tracks';
  toast(viewAll ? 'Library opened' : 'Library closed');
});
document.getElementById('clearSearch').addEventListener('click', ()=>{
  searchInput.value=''; searchQ=''; renderCards(); renderList();
});
searchInput.addEventListener('input', ()=>{
  searchQ=searchInput.value;
  renderCards(); renderList();
  if(searchQ) allTracksSection.classList.remove('hidden');
});
document.getElementById('resetSearch').addEventListener('click', ()=>{
  searchInput.value=''; searchQ=''; renderCards(); renderList();
});
document.getElementById('seeAllBtn').addEventListener('click', ()=>{
  allTracksSection.classList.remove('hidden');
  viewAll=true;
  allTracksSection.scrollIntoView({behavior:'smooth'});
});
document.querySelectorAll('.chip').forEach(ch=>{
  ch.addEventListener('click', ()=>{
    document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
    ch.classList.add('active');
    filterGenre=ch.dataset.filter;
    if(filterGenre==='favorites' || searchQ) allTracksSection.classList.remove('hidden');
    renderCards(); renderList();
  });
});
document.querySelectorAll('.tile').forEach(t=>{
  t.addEventListener('click', ()=>{
    const a=t.dataset.action;
    if(a==='music'){ filterGenre='all'; allTracksSection.classList.remove('hidden'); viewAll=true; }
    if(a==='favorites'){ filterGenre='favorites'; allTracksSection.classList.remove('hidden'); }
    if(a==='videos'){ toast('Videos hidden — music only mode at launch'); return; }
    if(a==='playlists'){ toast('Playlists — use Favorites for now (music only)'); return; }
    document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active', c.dataset.filter===filterGenre));
    renderCards(); renderList();
    allTracksSection.scrollIntoView({behavior:'smooth'});
  });
});
document.querySelectorAll('.nav-btn').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const nav=b.dataset.nav;
    if(nav==='home'){ window.scrollTo({top:0,behavior:'smooth'}); allTracksSection.classList.add('hidden'); }
    if(nav==='search'){ searchOverlay.classList.remove('hidden'); searchInput.focus(); }
    if(nav==='library'){ allTracksSection.classList.remove('hidden'); allTracksSection.scrollIntoView({behavior:'smooth'}); }
    if(nav==='profile'){ toast('Profile — Free account. No subscriptions at launch.'); }
  });
});
function openDrawer(){ drawer.classList.remove('hidden'); overlay.classList.remove('hidden'); }
function closeDrawer(){ drawer.classList.add('hidden'); overlay.classList.add('hidden'); }
document.getElementById('queueBtn').addEventListener('click', ()=>{ renderDrawer(); openDrawer(); });
document.getElementById('closeDrawer').addEventListener('click', closeDrawer);
overlay.addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e)=>{
  if(e.code==='Space' && e.target.tagName!=='INPUT'){ e.preventDefault(); togglePlay(); }
});

// --- UPLOAD REAL SONG (with IndexedDB persistence) ---
let pendingMP3 = null;
let pendingCover = null;
let pendingMP3Url = null;
let pendingCoverUrl = null;
const mp3Input = document.getElementById('mp3Input');
const coverInput = document.getElementById('coverInput');
const mp3Name = document.getElementById('mp3Name');
const coverName = document.getElementById('coverName');
const addSongBtn = document.getElementById('addSongBtn');
if(mp3Input){
  mp3Input.addEventListener('change', ()=>{
    const f = mp3Input.files[0];
    if(!f) return;
    pendingMP3 = f;
    mp3Name.textContent = f.name + ' • ' + (f.size/1024/1024).toFixed(2)+' MB';
    mp3Name.style.color = '#22c7f4';
    if(pendingMP3Url) URL.revokeObjectURL(pendingMP3Url);
    pendingMP3Url = URL.createObjectURL(f);
    const titleIn = document.getElementById('songTitle');
    if(!titleIn.value) titleIn.value = f.name.replace(/\.mp3$/i,'').replace(/[_-]/g,' ');
  });
}
if(coverInput){
  coverInput.addEventListener('change', ()=>{
    const f = coverInput.files[0];
    if(!f) return;
    pendingCover = f;
    coverName.textContent = f.name;
    coverName.style.color = '#22c7f4';
    if(pendingCoverUrl) URL.revokeObjectURL(pendingCoverUrl);
    pendingCoverUrl = URL.createObjectURL(f);
  });
}
if(addSongBtn){
  addSongBtn.addEventListener('click', async ()=>{
    const title = document.getElementById('songTitle').value.trim();
    const artist = document.getElementById('songArtist').value.trim() || 'BCR Studios';
    const genre = document.getElementById('songGenre').value;
    if(!pendingMP3Url || !title){
      toast('Please choose an MP3 and enter a song title');
      return;
    }
    const newId = Date.now();
    // keep blobs for persistence — create URLs for immediate playback
    const coverUrl = pendingCoverUrl || `https://picsum.photos/seed/${encodeURIComponent(title)}/300/300`;
    const newTrack = {
      id: newId,
      title: title,
      artist: artist,
      genre: genre,
      duration: '—',
      seconds: 0,
      src: pendingMP3Url,
      cover: coverUrl,
      color: `linear-gradient(135deg,#0a1931 0%, #1e3a5a 100%)`,
      icon: '♪',
      mp3Blob: pendingMP3,
      coverBlob: pendingCover || null
    };
    tracks.unshift(newTrack);
    const ghToken = getGhToken();
    // If token exists — publish for EVERYONE (Option 2), else just per-device (Option 1)
    if(ghToken){
      try{
        addSongBtn.textContent = 'Publishing for everyone...';
        addSongBtn.disabled = true;
        const shared = await publishToSharedLibrary(newTrack, pendingMP3, pendingCover, ghToken);
        toast(`Published for everyone! Render will deploy in 1-2 min — ${shared.title} will show for all visitors`);
        // Also save locally for instant feedback
        await saveTrackToDB({...newTrack});
      } catch(e){
        console.error(e);
        toast('GitHub publish failed — saved locally only (still survives reload on this device). Error: ' + e.message.slice(0,100));
        await saveTrackToDB({...newTrack});
      } finally {
        addSongBtn.textContent = '+ Add to BCR Streamer';
        addSongBtn.disabled = false;
      }
    } else {
      // No token — just per-device persistence (Option 1)
      await saveTrackToDB({...newTrack});
      toast('Added & SAVED on this device — will stay after reload! (Add a GitHub token to publish for everyone)');
    }
    pendingMP3 = null; pendingMP3Url = null; pendingCover = null; pendingCoverUrl = null;
    if(mp3Input) mp3Input.value='';
    if(coverInput) coverInput.value='';
    if(mp3Name){ mp3Name.textContent='No file chosen'; mp3Name.style.color=''; }
    if(coverName){ coverName.textContent='Optional — auto sky-blue if empty'; coverName.style.color=''; }
    document.getElementById('songTitle').value='';
    updateStats(); renderCards(); renderList(); renderDrawer(); renderManageList();
    allTracksSection.classList.remove('hidden');
    playTrack(newId);
    audio.addEventListener('loadedmetadata', function handler(){
      const d = audio.duration;
      if(newTrack.id===currentId && d){
        newTrack.duration = fmt(d);
        newTrack.seconds = Math.floor(d);
        renderList();
        saveTrackToDB({...newTrack});
      }
      audio.removeEventListener('loadedmetadata', handler);
    });
  });
}

// --- GITHUB SHARED PUBLISH (Option 2) ---
// Token stored ONLY in your browser (localStorage), never in code or repo
function getGhToken(){ return localStorage.getItem('bcr_gh_token') || ''; }
function setGhToken(t){ if(t) localStorage.setItem('bcr_gh_token', t.trim()); else localStorage.removeItem('bcr_gh_token'); }
async function fileToBase64(file){
  return new Promise((res, rej)=>{
    const r=new FileReader();
    r.onload=()=> res(r.result.split(',')[1]);
    r.onerror=rej;
    r.readAsDataURL(file);
  });
}
async function githubGetSha(path, token){
  const res = await fetch(`https://api.github.com/repos/makumejohn/bcr-streamer/contents/${path}`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
  });
  if(res.status===200){ const j=await res.json(); return j.sha; }
  return null;
}
async function githubPutFile(path, b64, message, token){
  const sha = await githubGetSha(path, token);
  const body = { message, content: b64, branch: 'main' };
  if(sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/makumejohn/bcr-streamer/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  });
  if(!res.ok){ const t=await res.text(); throw new Error(`GitHub ${res.status}: ${t}`); }
  return res.json();
}
async function publishToSharedLibrary(track, mp3File, coverFile, token){
  const slug = track.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') + '-' + track.id;
  let mp3Path = null, coverPath = null;
  // 1) Upload MP3
  if(mp3File){
    const ext = mp3File.name.split('.').pop() || 'mp3';
    mp3Path = `assets/${slug}.${ext}`;
    toast(`Uploading MP3 to GitHub: ${mp3Path}...`);
    const b64 = await fileToBase64(mp3File);
    await githubPutFile(mp3Path, b64, `feat: add ${track.title} MP3`, token);
  }
  // 2) Upload cover
  if(coverFile){
    const ext = coverFile.name.split('.').pop() || 'jpg';
    coverPath = `assets/${slug}-cover.${ext}`;
    toast(`Uploading cover: ${coverPath}...`);
    const b64 = await fileToBase64(coverFile);
    await githubPutFile(coverPath, b64, `feat: add ${track.title} cover`, token);
  }
  // 3) Update data/tracks.json
  toast('Updating shared library...');
  // Fetch current tracks.json via API to get sha
  let currentSha = null, currentTracks = [];
  try{
    const r = await fetch(`https://api.github.com/repos/makumejohn/bcr-streamer/contents/data/tracks.json`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
    });
    if(r.ok){
      const j = await r.json();
      currentSha = j.sha;
      currentTracks = JSON.parse(atob(j.content));
    }
  } catch(e){}
  // Fallback to local seed if fetch fails
  if(currentTracks.length===0){
    try{
      const r2 = await fetch('data/tracks.json');
      if(r2.ok) currentTracks = await r2.json();
    } catch(e){}
  }
  // Build shared track entry with GitHub raw URLs (so all visitors see it)
  const sharedTrack = {
    id: track.id,
    title: track.title,
    artist: track.artist,
    genre: track.genre,
    duration: track.duration,
    seconds: track.seconds,
    src: mp3Path ? `assets/${mp3Path.split('/').pop()}` : track.src,
    cover: coverPath ? `assets/${coverPath.split('/').pop()}` : track.cover,
    color: track.color,
    icon: track.icon
  };
  // Avoid duplicates
  currentTracks = currentTracks.filter(t=> t.id !== sharedTrack.id && t.title !== sharedTrack.title);
  currentTracks.unshift(sharedTrack);
  const newContentB64 = btoa(unescape(encodeURIComponent(JSON.stringify(currentTracks, null, 2))));
  const putBody = { message: `feat: publish ${track.title} to shared library`, content: newContentB64, branch: 'main' };
  if(currentSha) putBody.sha = currentSha;
  const putRes = await fetch(`https://api.github.com/repos/makumejohn/bcr-streamer/contents/data/tracks.json`, {
    method: 'PUT',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type':'application/json' },
    body: JSON.stringify(putBody)
  });
  if(!putRes.ok) throw new Error('Failed to update data/tracks.json: '+(await putRes.text()));
  return sharedTrack;
}

// --- OWNER GATE ---
const OWNER_PASS = "lucifer619ismyGod$";
const gatePass = document.getElementById('gatePass');
const unlockBtn = document.getElementById('unlockBtn');
const lockBtn = document.getElementById('lockBtn');
const ownerGate = document.getElementById('ownerGate');
const uploadSection = document.getElementById('uploadSection');
function unlock(){
  if(gatePass && gatePass.value === OWNER_PASS){
    if(ownerGate) ownerGate.classList.add('hidden');
    if(uploadSection) uploadSection.classList.remove('hidden');
    sessionStorage.setItem('bcr_unlocked','1');
    // show token box after unlock
    const tb = document.getElementById('tokenBox');
    if(tb) tb.style.display = 'block';
    const gh = document.getElementById('ghToken');
    if(gh) gh.value = getGhToken();
    renderManageList();
    toast('Unlocked — add songs for everyone (Option 2) or just this device');
  } else {
    toast('Wrong password — try again');
    if(gatePass) gatePass.value='';
  }
}
function lock(){
  if(ownerGate) ownerGate.classList.remove('hidden');
  if(uploadSection) uploadSection.classList.add('hidden');
  sessionStorage.removeItem('bcr_unlocked');
  if(gatePass) gatePass.value='';
  toast('Locked');
}
if(unlockBtn) unlockBtn.addEventListener('click', unlock);
if(gatePass) gatePass.addEventListener('keydown', (e)=>{ if(e.key==='Enter') unlock(); });
if(lockBtn) lockBtn.addEventListener('click', lock);
function setupTokenBox(){
  const tb = document.getElementById('tokenBox');
  const tb2 = document.getElementById('tokenBox2');
  const gh = document.getElementById('ghToken');
  const gh2 = document.getElementById('ghToken2');
  const saveBtn = document.getElementById('saveTokenBtn');
  const saveBtn2 = document.getElementById('saveTokenBtn2');
  const token = getGhToken();
  if(tb && gh){ gh.value = token; }
  if(tb2 && gh2){ gh2.value = token; }
  const handler = (input)=>{
    const v = input.value.trim();
    if(!v){ toast('Paste your GitHub token (ghp_...)'); return; }
    if(!v.startsWith('ghp_') && !v.startsWith('github_pat_')){ toast('That does not look like a token — should start with ghp_'); return; }
    setGhToken(v);
    if(gh) gh.value = v;
    if(gh2) gh2.value = v;
    toast('Token saved locally — only on this device, never in code');
  };
  if(saveBtn) saveBtn.addEventListener('click', ()=> handler(document.getElementById('ghToken')));
  if(saveBtn2) saveBtn2.addEventListener('click', ()=> handler(document.getElementById('ghToken2')));
  // keep them in sync
  if(gh) gh.addEventListener('input', ()=>{ if(gh2) gh2.value = gh.value; });
  if(gh2) gh2.addEventListener('input', ()=>{ if(gh) gh.value = gh2.value; });
}
setupTokenBox();
if(sessionStorage.getItem('bcr_unlocked')==='1'){
  if(ownerGate) ownerGate.classList.add('hidden');
  if(uploadSection) uploadSection.classList.remove('hidden');
  setTimeout(()=>renderManageList(), 100);
}

// --- MANAGE / REMOVE SONGS (with DB delete) ---
function renderManageList(){
  const listEl = document.getElementById('manageList');
  const countEl = document.getElementById('manageCount');
  if(!listEl) return;
  listEl.innerHTML='';
  if(countEl) countEl.textContent = tracks.length;
  if(tracks.length===0){
    listEl.innerHTML = `<div style="padding:12px;text-align:center;color:#7d8aa2;font-size:11px;border:1px dashed #1e3352;border-radius:10px">No songs yet — add one above</div>`;
    return;
  }
  tracks.forEach(t=>{
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;background:#0a1a33;border:1px solid #1e3352;border-radius:10px;padding:8px 10px';
    row.innerHTML = `
      <img src="${t.cover}" alt="" onerror="this.style.display='none'" style="width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0;border:1px solid #1e3352">
      <div style="flex:1;min-width:0">
        <strong style="display:block;font-size:11px;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.title}</strong>
        <span style="display:block;font-size:10px;color:#7d8aa2">${t.artist} • ${t.genre}</span>
      </div>
      <button data-remove="${t.id}" style="background:#1a0f14;border:1px solid #4a1a2a;color:#ff6b81;border-radius:8px;padding:6px 10px;font-size:11px;cursor:pointer">🗑️ Remove</button>
    `;
    const btn = row.querySelector('[data-remove]');
    btn.addEventListener('click', async ()=>{
      if(!confirm(`Remove "${t.title}" permanently?`)) return;
      const idx = tracks.findIndex(x=>x.id===t.id);
      if(idx>-1) tracks.splice(idx,1);
      recent = recent.filter(id=>id!==t.id);
      favorites.delete(t.id);
      saveRecent(); saveFav();
      await deleteTrackFromDB(t.id);
      if(currentId===t.id){ audio.pause(); audio.src=''; currentId=null; isPlaying=false; }
      updateStats(); renderManageList(); renderCards(); renderList(); renderDrawer(); updatePlayerUI();
      toast(`Removed: ${t.title} — deleted from device storage`);
    });
    listEl.appendChild(row);
  });
}

// Init with persistence + shared fetch
async function initTracks(){
  // 1) Try shared library from GitHub (data/tracks.json) — visible to everyone
  let shared = [];
  try{
    // try both local and raw GitHub (works on localhost and Render/GitHub Pages)
    const urls = ['data/tracks.json', 'https://raw.githubusercontent.com/makumejohn/bcr-streamer/main/data/tracks.json'];
    for(const u of urls){
      try{
        const r = await fetch(u, {cache: 'no-store'});
        if(r.ok){ shared = await r.json(); if(shared.length) break; }
      } catch(e){}
    }
  } catch(e){}
  if(shared.length){
    // shared library exists — use it as base (covers are relative to repo root, e.g., assets/xxx.png)
    tracks = shared.map(t=> ({...t}));
    toast(`Shared library: ${shared.length} song(s) for everyone`);
  } else {
    // no shared yet — load per-device or seed
    const persisted = await loadPersistedTracks();
    if(persisted.length>0){
      tracks = persisted.map(t=>{
        if(t.mp3Blob) t.src = blobToUrl(t.mp3Blob);
        if(t.coverBlob) t.cover = blobToUrl(t.coverBlob);
        return t;
      });
    } else {
      tracks = [...seedTracks];
      for(const t of tracks) await saveTrackToDB({...t});
    }
    toast(persisted.length>0 ? `Loaded ${persisted.length} saved song(s) — they survived reload!` : `Welcome — add your first real song!`);
  }
  // Also merge per-device IndexedDB tracks that are not yet in shared (so local adds still show)
  try{
    const persisted = await loadPersistedTracks();
    // if we loaded shared, also add any local-only tracks that aren't in shared
    if(shared.length){
      const sharedIds = new Set(shared.map(s=>s.id));
      const sharedTitles = new Set(shared.map(s=>s.title));
      for(const p of persisted){
        if(!sharedIds.has(p.id) && !sharedTitles.has(p.title)){
          if(p.mp3Blob) p.src = blobToUrl(p.mp3Blob);
          if(p.coverBlob) p.cover = blobToUrl(p.coverBlob);
          tracks.push(p);
        }
      }
    }
  } catch(e){}
  queue = [...tracks];
  updateStats(); renderCards(); renderList(); renderDrawer(); renderManageList(); updatePlayerUI();
}
// Init
(async ()=>{
  updateFavBadge();
  await initTracks();
  durTime.textContent='0:00';
})();
window.addEventListener('offline', ()=> toast('You are offline — streaming requires internet'));
window.addEventListener('online', ()=> toast('Back online — streaming ready'));
