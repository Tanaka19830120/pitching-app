# ソフトボール・ピッチング記録アプリ

チームで練習記録、球速、投球数、動画、統計を共有するモバイル向けWebアプリです。フォーム解析機能を段階的に追加しています。

## ローカル起動

```bash
npm install
npm run dev
```

`.env.example`を参考にSupabaseの接続情報を`.env`へ設定してください。`.env`はGitへ登録しません。

## 品質確認

```bash
npm run lint
npm test
npm run build
```

## フォーム解析の方針

- MediaPipe Pose Landmarkerによるブラウザ内解析
- 動画、切り出し画像、骨格座標を外部解析サービスへ送信しない
- 表示値は単眼動画の2D投影値
- 実際のボール離脱ではなく「リリース推定点」を表示
- 技術の絶対評価や医療診断は行わない

詳細は[FORM_ANALYZER_INTEGRATION_PLAN.md](./FORM_ANALYZER_INTEGRATION_PLAN.md)を参照してください。

## 推奨撮影条件

- 1投につき3〜8秒
- 可能なら60fps、最低30fps
- 頭から両足まで画面内へ入れる
- カメラを固定し、逆光や他の人物との重なりを避ける
- 比較する動画はカメラ位置と撮影方向をそろえる

## 対応ブラウザ

最新版のSafari、Chrome、Edgeを対象とします。iPhoneのHEVC/MOVは端末・ブラウザによって再生できない場合があります。

## プライバシー

練習記録へ登録した動画はチーム共有のためSupabase Storageへ保存されます。フォーム解析処理そのものは端末内で行い、別の解析サービスへ動画を送信しません。
