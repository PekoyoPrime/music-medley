const CONFIG = {
  // Cloudflare Workerをデプロイしたら、ここをWorkerのURLに変更してください。
  // 例: https://music-medley-search.xxxxx.workers.dev
  API_BASE: "https://music-medley-search.tukiyoyozakura.workers.dev"
};

const $ = (s) => document.querySelector(s);
const audio = $("#audio");
let playlist = JSON.parse(localStorage.getItem("medleyPlaylist") || "[]");
let currentIndex = Number(localStorage.getItem("medleyIndex") || 0);
let shuffle = localStorage.getItem("medleyShuffle") === "1";
let repeat = localStorage.getItem("medleyRepeat") === "1";

$("#shuffle").checked = shuffle;
$("#repeat").checked = repeat;
$("#volume").value = localStorage.getItem("medleyVolume") || "1";
audio.volume = Number($("#volume").value);

function save() {
  localStorage.setItem("medleyPlaylist", JSON.stringify(playlist));
  localStorage.setItem("medleyIndex", String(currentIndex));
  localStorage.setItem("medleyShuffle", shuffle ? "1" : "0");
  localStorage.setItem("medleyRepeat", repeat ? "1" : "0");
}

function timeText(sec) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function setStatus(message, type = "") {
  const el = $("#status");
  el.textContent = message;
  el.className = "status " + type;
}

function renderPlaylist() {
  $("#count").textContent = `${playlist.length}曲`;
  $("#empty").style.display = playlist.length ? "none" : "block";
  $("#playlist").innerHTML = "";

  playlist.forEach((track, i) => {
    const row = document.createElement("div");
    row.className = "track" + (i === currentIndex ? " active" : "");
    row.draggable = true;
    row.dataset.index = i;
    row.innerHTML = `
      <div class="track-number">${i + 1}</div>
      <img class="thumb" src="${escapeAttr(track.cover || "")}" alt="" onerror="this.style.visibility='hidden'">
      <div class="track-main">
        <div class="track-title">${escapeHtml(track.title)}</div>
        <div class="track-meta">${escapeHtml(track.artist || "")}${track.album ? " · " + escapeHtml(track.album) : ""}</div>
      </div>
      <div class="track-actions">
        <button class="small-button" data-action="up" title="上へ">↑</button>
        <button class="small-button" data-action="down" title="下へ">↓</button>
        <button class="small-button" data-action="remove" title="削除">×</button>
      </div>`;
    row.addEventListener("click", (e) => {
      const action = e.target.closest("[data-action]")?.dataset.action;
      if (action) {
        e.stopPropagation();
        if (action === "remove") removeTrack(i);
        if (action === "up") moveTrack(i, -1);
        if (action === "down") moveTrack(i, 1);
        return;
      }
      playIndex(i);
    });
    row.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", String(i));
    });
    row.addEventListener("dragover", e => e.preventDefault());
    row.addEventListener("drop", e => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData("text/plain"));
      moveTrackTo(from, i);
    });
    $("#playlist").appendChild(row);
  });
}

function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function escapeAttr(v) { return escapeHtml(v); }

function addTrack(track) {
  if (!track.preview) {
    setStatus("この曲には利用できるプレビュー音源がありません。", "error");
    return;
  }
  if (playlist.some(x => x.id === track.id)) {
    setStatus("その曲はすでにプレイリストに入っています。", "error");
    return;
  }
  playlist.push(track);
  if (playlist.length === 1) currentIndex = 0;
  save();
  renderPlaylist();
  setStatus(`「${track.title}」を追加しました。`, "ok");
}

function removeTrack(i) {
  const wasCurrent = i === currentIndex;
  playlist.splice(i, 1);
  if (!playlist.length) {
    currentIndex = 0;
    audio.pause();
    audio.removeAttribute("src");
    updateNowPlaying(null);
  } else if (i < currentIndex) {
    currentIndex--;
  } else if (wasCurrent && currentIndex >= playlist.length) {
    currentIndex = playlist.length - 1;
  }
  save();
  renderPlaylist();
  if (wasCurrent && playlist.length) playIndex(currentIndex);
}

function moveTrack(i, delta) { moveTrackTo(i, i + delta); }

function moveTrackTo(from, to) {
  if (from === to || from < 0 || to < 0 || from >= playlist.length || to >= playlist.length) return;
  const [item] = playlist.splice(from, 1);
  playlist.splice(to, 0, item);
  if (currentIndex === from) currentIndex = to;
  else if (from < currentIndex && to >= currentIndex) currentIndex--;
  else if (from > currentIndex && to <= currentIndex) currentIndex++;
  save();
  renderPlaylist();
}

function updateNowPlaying(track) {
  if (!track) {
    $("#nowTitle").textContent = "まだ再生していません";
    $("#nowArtist").textContent = "曲をプレイリストに追加してください";
    $("#cover").hidden = true;
    return;
  }
  $("#nowTitle").textContent = track.title;
  $("#nowArtist").textContent = track.artist || "";
  if (track.cover) {
    $("#cover").src = track.cover;
    $("#cover").hidden = false;
  } else {
    $("#cover").hidden = true;
  }
}

function updateMediaSession(track) {
  if (!("mediaSession" in navigator) || !track) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist || "",
      album: track.album || "Music Medley",
      artwork: track.cover ? [{ src: track.cover, sizes: "500x500", type: "image/jpeg" }] : []
    });
  } catch {}
}

async function playIndex(i) {
  if (!playlist.length) return;
  currentIndex = (i + playlist.length) % playlist.length;
  const track = playlist[currentIndex];
  updateNowPlaying(track);
  updateMediaSession(track);
  save();
  renderPlaylist();
  audio.src = track.preview;
  try {
    await audio.play();
  } catch (e) {
    setStatus("再生できませんでした。画面上の再生ボタンを押してもう一度試してください。", "error");
  }
}

function nextTrack() {
  if (!playlist.length) return;
  if (repeat) return playIndex(currentIndex);
  if (shuffle && playlist.length > 1) {
    let next;
    do next = Math.floor(Math.random() * playlist.length); while (next === currentIndex);
    return playIndex(next);
  }
  return playIndex(currentIndex + 1);
}

function previousTrack() {
  if (!playlist.length) return;
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  playIndex(currentIndex - 1);
}

$("#searchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("#query").value.trim();
  if (!q) return;
  if (CONFIG.API_BASE === "YOUR_WORKER_URL") {
    setStatus("先に app.js の YOUR_WORKER_URL を、Cloudflare WorkerのURLに変更してください。", "error");
    return;
  }

  $("#searchButton").disabled = true;
  $("#results").innerHTML = "";
  setStatus("検索中…");

  try {
    const url = CONFIG.API_BASE.replace(/\/$/, "") + "/search?q=" + encodeURIComponent(q);
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "検索に失敗しました");
    const items = (data.data || []).filter(x => x.preview);

    if (!items.length) {
      setStatus("プレビュー音源が見つかりませんでした。");
      return;
    }

    setStatus(`${items.length}件見つかりました。追加したい曲を選んでください。`, "ok");
    items.slice(0, 12).forEach(track => {
      const el = document.createElement("div");
      el.className = "result";
      el.innerHTML = `
        <img class="thumb" src="${escapeAttr(track.cover || "")}" alt="" onerror="this.style.visibility='hidden'">
        <div class="result-main">
          <div class="result-title">${escapeHtml(track.title)}</div>
          <div class="result-meta">${escapeHtml(track.artist || "")}${track.album ? " · " + escapeHtml(track.album) : ""}</div>
        </div>
        <button class="add-button">追加</button>`;
      el.querySelector("button").addEventListener("click", () => addTrack(track));
      $("#results").appendChild(el);
    });
  } catch (err) {
    setStatus("検索に失敗しました: " + err.message, "error");
  } finally {
    $("#searchButton").disabled = false;
  }
});

$("#playButton").addEventListener("click", async () => {
  if (!playlist.length) return;
  if (audio.paused) {
    if (!audio.src) await playIndex(currentIndex);
    else await audio.play();
  } else audio.pause();
});

$("#prevButton").addEventListener("click", previousTrack);
$("#nextButton").addEventListener("click", nextTrack);

audio.addEventListener("play", () => { $("#playButton").textContent = "⏸"; });
audio.addEventListener("pause", () => { $("#playButton").textContent = "▶"; });
audio.addEventListener("timeupdate", () => {
  $("#currentTime").textContent = timeText(audio.currentTime);
  $("#duration").textContent = timeText(audio.duration);
  $("#seek").value = Number.isFinite(audio.duration) ? (audio.currentTime / audio.duration) * 100 : 0;
});
audio.addEventListener("loadedmetadata", () => {
  $("#duration").textContent = timeText(audio.duration);
});
audio.addEventListener("ended", nextTrack);
audio.addEventListener("error", () => setStatus("音源を再生できませんでした。別の検索結果を試してください。", "error"));

$("#seek").addEventListener("input", () => {
  if (Number.isFinite(audio.duration)) audio.currentTime = audio.duration * Number($("#seek").value) / 100;
});
$("#volume").addEventListener("input", () => {
  audio.volume = Number($("#volume").value);
  localStorage.setItem("medleyVolume", $("#volume").value);
});
$("#shuffle").addEventListener("change", e => { shuffle = e.target.checked; save(); });
$("#repeat").addEventListener("change", e => { repeat = e.target.checked; save(); });
$("#clearButton").addEventListener("click", () => {
  if (!playlist.length || confirm("プレイリストをすべて削除しますか？")) {
    playlist = [];
    currentIndex = 0;
    audio.pause();
    audio.removeAttribute("src");
    updateNowPlaying(null);
    save();
    renderPlaylist();
  }
});

if ("mediaSession" in navigator) {
  const actions = {
    play: () => audio.play(),
    pause: () => audio.pause(),
    nexttrack: nextTrack,
    previoustrack: previousTrack,
    seekbackward: () => audio.currentTime = Math.max(0, audio.currentTime - 10),
    seekforward: () => audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 10),
    seekto: d => { if (d.seekTime != null) audio.currentTime = d.seekTime; }
  };
  for (const [name, handler] of Object.entries(actions)) {
    try { navigator.mediaSession.setActionHandler(name, handler); } catch {}
  }
}

if ("audioSession" in navigator) {
  try { navigator.audioSession.type = "playback"; } catch {}
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

renderPlaylist();
if (playlist[currentIndex]) updateNowPlaying(playlist[currentIndex]);
