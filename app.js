const $ = s => document.querySelector(s);
const audio = $("#audio");
const state = {
  playlist: JSON.parse(localStorage.getItem("medleyPlaylist") || "[]"),
  index: Number(localStorage.getItem("medleyIndex") || 0),
  playing: false,
  crossfade: false
};

/*
 * Deezer API adapter.
 * If Deezer changes its endpoint/CORS policy, change only this object.
 */
const DeezerAPI = {
  base() { return $("#apiBase").value.trim().replace(/\/$/, ""); },

  async search(query) {
    const url = `${this.base()}/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Deezer API HTTP ${res.status}`);
    const json = await res.json();
    return (json.data || []).map(t => ({
      id: String(t.id),
      title: t.title || "",
      artist: t.artist?.name || "",
      album: t.album?.title || "",
      cover: t.album?.cover_medium || t.album?.cover || "",
      preview: t.preview || "",
      link: t.link || ""
    }));
  }
};

function save() {
  localStorage.setItem("medleyPlaylist", JSON.stringify(state.playlist));
  localStorage.setItem("medleyIndex", String(state.index));
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderResults(items) {
  const el = $("#results");
  el.innerHTML = "";
  if (!items.length) {
    el.innerHTML = '<div class="status">結果がありません。</div>';
    return;
  }
  for (const t of items) {
    const row = document.createElement("div");
    row.className = "result";
    row.innerHTML = `
      <img class="thumb" src="${esc(t.cover)}" alt="">
      <div class="meta">
        <div class="title">${esc(t.title)}</div>
        <div class="artist">${esc(t.artist)}</div>
        <div class="album">${esc(t.album)}</div>
      </div>
      <button class="add">${t.preview ? "＋追加" : "試聴不可"}</button>`;
    row.querySelector(".add").disabled = !t.preview;
    row.querySelector(".add").onclick = () => addTrack(t);
    el.appendChild(row);
  }
}

function renderPlaylist() {
  const el = $("#playlist");
  if (!state.playlist.length) {
    el.className = "playlist empty";
    el.textContent = "曲を追加してください";
    return;
  }
  el.className = "playlist";
  el.innerHTML = "";
  state.playlist.forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "track";
    row.draggable = true;
    row.dataset.index = i;
    row.innerHTML = `
      <span class="drag">☰</span>
      <img class="thumb" src="${esc(t.cover)}" alt="">
      <div class="meta">
        <div class="title">${esc(t.title)}</div>
        <div class="artist">${esc(t.artist)}</div>
      </div>
      <button class="remove">削除</button>`;
    row.querySelector(".remove").onclick = e => {
      e.stopPropagation();
      if (i === state.index) audio.pause();
      state.playlist.splice(i,1);
      if (state.index >= state.playlist.length) state.index = 0;
      save(); renderPlaylist(); updatePlayer();
    };
    row.onclick = () => { state.index = i; save(); loadCurrent(true); };
    row.ondragstart = () => row.classList.add("dragging");
    row.ondragend = () => row.classList.remove("dragging");
    row.ondragover = e => e.preventDefault();
    row.ondrop = e => {
      e.preventDefault();
      const from = Number(document.querySelector(".dragging")?.dataset.index);
      if (!Number.isInteger(from) || from === i) return;
      const [moved] = state.playlist.splice(from,1);
      state.playlist.splice(i,0,moved);
      if (state.index === from) state.index = i;
      else if (from < state.index && i >= state.index) state.index--;
      else if (from > state.index && i <= state.index) state.index++;
      save(); renderPlaylist(); updatePlayer();
    };
    el.appendChild(row);
  });
}

function addTrack(t) {
  if (state.playlist.some(x => x.id === t.id)) {
    $("#playerStatus").textContent = "すでにプレイリストにあります。";
    return;
  }
  state.playlist.push(t);
  if (state.playlist.length === 1) state.index = 0;
  save(); renderPlaylist(); updatePlayer();
  $("#playerStatus").textContent = `「${t.title}」を追加しました。`;
}

function updatePlayer() {
  const t = state.playlist[state.index];
  if (!t) {
    $("#nowTitle").textContent = "再生停止中";
    $("#nowArtist").textContent = "";
    $("#nowAlbum").textContent = "";
    $("#cover").removeAttribute("src");
    return;
  }
  $("#nowTitle").textContent = t.title;
  $("#nowArtist").textContent = t.artist;
  $("#nowAlbum").textContent = t.album;
  $("#cover").src = t.cover || "";
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: t.artist,
      album: t.album,
      artwork: t.cover ? [{src:t.cover, sizes:"500x500", type:"image/jpeg"}] : []
    });
  }
}

async function loadCurrent(autoplay=false) {
  const t = state.playlist[state.index];
  if (!t) return;
  updatePlayer();
  audio.src = t.preview;
  audio.currentTime = 0;
  $("#seek").value = 0;
  $("#playerStatus").textContent = "";
  if (autoplay) await play();
}

async function play() {
  if (!state.playlist.length) {
    $("#playerStatus").textContent = "先に曲を追加してください。";
    return;
  }
  if (!audio.src) await loadCurrent(false);
  try {
    await audio.play();
    state.playing = true;
    $("#playBtn").textContent = "Ⅱ";
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
  } catch (e) {
    state.playing = false;
    $("#playerStatus").textContent = "再生できませんでした。iPhoneでは画面上の再生ボタンを一度タップしてください。";
    console.error(e);
  }
}

function pause() {
  audio.pause();
  state.playing = false;
  $("#playBtn").textContent = "▶";
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
}

async function next(auto=true) {
  if (!state.playlist.length) return;
  state.index = (state.index + 1) % state.playlist.length;
  save();
  await loadCurrent(auto);
}

async function prev() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  state.index = (state.index - 1 + state.playlist.length) % state.playlist.length;
  save();
  await loadCurrent(state.playing);
}

function fmt(s) {
  if (!Number.isFinite(s)) return "0:00";
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
}

$("#searchForm").onsubmit = async e => {
  e.preventDefault();
  const q = $("#searchInput").value.trim();
  if (!q) return;
  $("#searchStatus").textContent = "検索中…";
  try {
    const results = await DeezerAPI.search(q);
    renderResults(results);
    $("#searchStatus").textContent = `${results.length}件`;
  } catch (err) {
    console.error(err);
    $("#searchStatus").textContent =
      "Deezer APIに接続できませんでした。CORS/API仕様の変更が考えられます。";
  }
};

$("#playBtn").onclick = () => state.playing ? pause() : play();
$("#nextBtn").onclick = () => next(true);
$("#prevBtn").onclick = prev;

$("#shuffleBtn").onclick = () => {
  for (let i=state.playlist.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [state.playlist[i],state.playlist[j]]=[state.playlist[j],state.playlist[i]];
  }
  state.index=0; save(); renderPlaylist(); updatePlayer();
};

$("#clearBtn").onclick = () => {
  if (!confirm("プレイリストをすべて削除しますか？")) return;
  pause(); state.playlist=[]; state.index=0; save(); renderPlaylist(); updatePlayer();
};

$("#volume").oninput = e => audio.volume = Number(e.target.value);
$("#crossfade").onchange = e => state.crossfade = e.target.checked;

audio.addEventListener("loadedmetadata", () => {
  $("#duration").textContent = fmt(audio.duration);
  $("#seek").max = Number.isFinite(audio.duration) ? audio.duration : 30;
});
audio.addEventListener("timeupdate", () => {
  $("#currentTime").textContent = fmt(audio.currentTime);
  $("#seek").value = audio.currentTime;
});
$("#seek").oninput = e => audio.currentTime = Number(e.target.value);

audio.addEventListener("ended", async () => {
  await next(true);
});
audio.addEventListener("error", () => {
  $("#playerStatus").textContent = "このプレビュー音源を再生できませんでした。次の曲へ進むことができます。";
});

function setupMediaSession() {
  if (!("mediaSession" in navigator)) return;
  const set = (action, handler) => {
    try { navigator.mediaSession.setActionHandler(action, handler); } catch {}
  };
  set("play", play);
  set("pause", pause);
  set("nexttrack", () => next(true));
  set("previoustrack", prev);
  set("seekbackward", () => audio.currentTime = Math.max(0,audio.currentTime-10));
  set("seekforward", () => audio.currentTime = Math.min(audio.duration||30,audio.currentTime+10));
  set("seekto", d => {
    if (d.fastSeek && "fastSeek" in audio) audio.fastSeek(d.seekTime);
    else audio.currentTime = d.seekTime;
  });
}

function setupIOSAudioSession() {
  // Safari/iOS versions that expose Audio Session API can explicitly request
  // a playback session. Older browsers simply ignore this.
  try {
    if ("audioSession" in navigator) navigator.audioSession.type = "playback";
  } catch {}
}

setupMediaSession();
setupIOSAudioSession();
audio.volume = 1;
renderPlaylist();
updatePlayer();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.error));
}

if (window.matchMedia("(display-mode: standalone)").matches) $("#installBtn").classList.add("hidden");
else $("#installBtn").classList.remove("hidden");

$("#installBtn").onclick = () => {
  alert("iPhoneではSafariの共有ボタン →「ホーム画面に追加」でインストールできます。");
};
