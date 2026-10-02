# Music Medley v2

曲名でDeezer検索し、検索結果のプレビューをその場で試聴できます。

## 追加した機能
1. 10/20/30秒再生  2. 曲ごとの開始位置  3. 曲ごとの終了位置  4. クロスフェード  5. シャッフル  6. リピート  7. お気に入り  8. 複数プレイリスト  9. URL共有  10. ダーク/ライト  11. iPhone向けUI  12. 大きなジャケット表示  13. 次に再生キュー  14. 検索履歴  15. Media Session  16. PWA

## Cloudflare Worker
`worker.js`をCloudflare Workerにデプロイし、`app.js`冒頭の`YOUR_WORKER_URL`をWorkerのURLに変更してください。

Worker API:
- `/search?q=...&index=0&limit=25`
- `/tracks?ids=123,456`

GitHub Pagesには `index.html/style.css/app.js/manifest.webmanifest/sw.js/icon.svg` をアップロードします。worker.jsはCloudflare側です。

## 注意
Deezerのプレビュー音源、画像、API等の利用条件に従ってください。Media Sessionはロック画面等のメディア操作に利用できますが、最終的な挙動はOS/ブラウザの対応状況に依存します。PWAはmanifestとservice workerを使用します。
