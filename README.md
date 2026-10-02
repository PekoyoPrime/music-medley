# Music Medley

GitHub Pages向けの、Deezerプレビュー音源を連続再生するWebプレイヤーです。

## ファイル

- `index.html` : UI
- `style.css` : デザイン
- `app.js` : Deezer検索・プレイヤー・プレイリスト・Media Session
- `manifest.webmanifest` : PWA設定
- `sw.js` : オフライン用キャッシュ

## GitHub Pages

1. GitHubで新しいPublic repositoryを作成
2. この5ファイルをアップロード
3. Settings → Pages
4. Sourceを `Deploy from a branch`
5. Branchを `main` / `/ (root)` に設定
6. Save
7. 数分後に発行されたPages URLを開く

## iPhone

SafariでPages URLを開き、最初に画面上の再生ボタンをタップしてください。
その後、iPhoneをロックしてバックグラウンド再生を確認します。

ホーム画面へ追加する場合は、Safariの共有 → ホーム画面に追加。

## 重要

Deezer APIの公開利用条件、CORS、preview URLの利用可否はDeezer側の仕様に依存します。
APIがブラウザから直接利用できない場合は、GitHub Pagesだけでは検索部分を成立させられません。

その場合はGitHub Pages + 小さなプロキシ（Cloudflare Workers等）へ構成を変更してください。


## CORSで検索できない場合（推奨構成）

Deezer APIがブラウザから直接CORSアクセスできない場合は、付属の `worker.js` を
Cloudflare Workersへデプロイしてください。

1. CloudflareでWorkers & Pagesを開く
2. 新しいWorkerを作成
3. `worker.js` の内容を貼り付けてDeploy
4. 発行された `https://xxxx.workers.dev` をコピー
5. Music Medleyの「Deezer API設定」のAPI URLへ入力
6. GitHub Pagesを再読み込みして検索

Workerは `/search?q=...` だけをDeezerへ中継します。
Deezerの検索API全体を無制限に公開する汎用プロキシにはしていません。

Cloudflareの公式ドキュメントでは、Workersで第三者APIへfetchし、
CORSヘッダーを付け直す構成が案内されています。
