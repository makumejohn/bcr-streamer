// BCR Streamer - Free, ad-free, online-only
// No subscriptions, payments, or downloads
// DEMOS REMOVED per owner request — clean library for real BCR music only

const tracks = [
  {
    id: 101,
    title: "Told You I Can",
    artist: "BCR Studios",
    genre: "R&B",
    duration: "—",
    seconds: 0,
    src: "", // ← Add your MP3 here - drag your MP3 file into this chat and I'll wire it
    cover: "assets/told-you-i-can-rnb.png",
    color: "linear-gradient(135deg,#0a1931 0%, #1e3a5a 100%)",
    icon: "♪"
  }
];

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

// Render Recently Played (cards) — uses LOADED songs with cover art
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
    // Show friendly empty for music-only mode
    empty.innerHTML = `<p>🎵 No music yet</p><p style="margin-top:6px;font-size:11px;color:#9ab0cc">Upload your real songs above — they will appear here with cover art</p>`;
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
    trackList.innerHTML = `<div style="padding:20px;text-align:center;color:#7d8aa2;font-size:12px;border:1px dashed #1e3352;border-radius:12px">No tracks yet — add your first real song above</div>`;
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
    miniArtist.textContent='Upload a song above to start streaming';
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
  recent = [id, ...recent.filter(x=>x!==id)];
  saveRecent();

  if(currentId===id && audio.src){
    togglePlay(); return;
  }
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
    else toast('No music yet — upload a song first');
    return;
  }
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
    if(f) playTrack(f.id); else toast('No music yet — upload a song above');
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

// Search
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

// Filter chips
document.querySelectorAll('.chip').forEach(ch=>{
  ch.addEventListener('click', ()=>{
    document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
    ch.classList.add('active');
    filterGenre=ch.dataset.filter;
    if(filterGenre==='favorites' || searchQ) allTracksSection.classList.remove('hidden');
    renderCards(); renderList();
  });
});

// Tiles actions — NOW MUSIC ONLY per request
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

// Bottom nav
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

// Drawer
function openDrawer(){ drawer.classList.remove('hidden'); overlay.classList.remove('hidden'); }
function closeDrawer(){ drawer.classList.add('hidden'); overlay.classList.add('hidden'); }
document.getElementById('queueBtn').addEventListener('click', ()=>{ renderDrawer(); openDrawer(); });
document.getElementById('closeDrawer').addEventListener('click', closeDrawer);
overlay.addEventListener('click', closeDrawer);

// Keyboard
document.addEventListener('keydown', (e)=>{
  if(e.code==='Space' && e.target.tagName!=='INPUT'){ e.preventDefault(); togglePlay(); }
});

// --- UPLOAD REAL SONG ---
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
  addSongBtn.addEventListener('click', ()=>{
    const title = document.getElementById('songTitle').value.trim();
    const artist = document.getElementById('songArtist').value.trim() || 'BCR Studios';
    const genre = document.getElementById('songGenre').value;
    if(!pendingMP3Url || !title){
      toast('Please choose an MP3 and enter a song title');
      return;
    }
    const newId = Date.now();
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
      color: `linear-gradient(135deg,#0c4a6e 0%, #082f49 100%)`,
      icon: '♪'
    };
    tracks.unshift(newTrack);
    pendingMP3 = null; pendingMP3Url = null; pendingCover = null; pendingCoverUrl = null;
    mp3Input.value=''; coverInput.value='';
    mp3Name.textContent='No file chosen'; mp3Name.style.color='';
    coverName.textContent='Optional — uses auto art if empty'; coverName.style.color='';
    document.getElementById('songTitle').value='';
    const stat = document.getElementById('statTotal');
    if(stat) stat.textContent = tracks.length;
    renderCards(); renderList(); renderDrawer(); renderManageList();
    allTracksSection.classList.remove('hidden');
    playTrack(newId);
    toast('Added: '+title+' — now in Recently Played with cover art');
    audio.addEventListener('loadedmetadata', function handler(){
      const d = audio.duration;
      if(newTrack.id===currentId && d){
        newTrack.duration = fmt(d);
        newTrack.seconds = Math.floor(d);
        renderList();
      }
      audio.removeEventListener('loadedmetadata', handler);
    });
  });
}

fetch('/uploads/').then(r=>r.text()).then(html=>{
  const matches = html.match(/href="[^"]+\.mp3"/gi);
  if(matches){
    toast('Found '+matches.length+' uploaded MP3(s) — add them via the uploader or tell me their names');
  }
}).catch(()=>{});

// --- OWNER GATE (password protected uploader) ---
const OWNER_PASS = "lucifer619ismyGod$"; // your private password — only you should know this
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
    renderManageList();
    toast('Unlocked — you can now add or remove songs');
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
// auto-unlock if already unlocked this session
if(sessionStorage.getItem('bcr_unlocked')==='1'){
  if(ownerGate) ownerGate.classList.add('hidden');
  if(uploadSection) uploadSection.classList.remove('hidden');
  setTimeout(()=>renderManageList(), 100);
}

 // --- MANAGE / REMOVE SONGS ---
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
    btn.addEventListener('click', ()=>{
      if(!confirm(`Remove "${t.title}" permanently?`)) return;
      const idx = tracks.findIndex(x=>x.id===t.id);
      if(idx>-1) tracks.splice(idx,1);
      // also clean recent/favorites
      recent = recent.filter(id=>id!==t.id);
      favorites.delete(t.id);
      saveRecent(); saveFav();
      if(currentId===t.id){ audio.pause(); audio.src=''; currentId=null; isPlaying=false; }
      const stat = document.getElementById('statTotal');
      if(stat) stat.textContent = tracks.length;
      renderManageList(); renderCards(); renderList(); renderDrawer(); updatePlayerUI();
      toast(`Removed: ${t.title}`);
    });
    listEl.appendChild(row);
  });
}
const originalRenderManage = renderManageList;

 // Init
const statTotal = document.getElementById('statTotal');
if(statTotal) statTotal.textContent=tracks.length;
updateFavBadge();
renderCards();
renderList();
renderDrawer();
renderManageList();
updatePlayerUI();
durTime.textContent='0:00';

window.addEventListener('offline', ()=> toast('You are offline — streaming requires internet'));
window.addEventListener('online', ()=> toast('Back online — streaming ready'));
