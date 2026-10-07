# HARBOR RUN · 港灣疾走

原創 3D 都市駕駛遊戲原型。手機可作為體感方向盤，電腦呈現港灣城市與追車視角。

**[直接試玩](https://changyi123456.github.io/harbor-run/)**

## 手機連動

1. 電腦開啟遊戲，讀完畫面上的操作指引，按「連接手機」。
2. 手機掃描 QR Code，用 Safari 或 Chrome 開啟連結。
3. iPhone 若已開啟「直向鎖定」，在控制頁右上「介面方向」選「橫向：手機頂端朝左／朝右」，依實際握法選擇。未鎖定時可用「跟隨螢幕」。
4. 按「啟用體感控制」，允許動作感測權限。橫拿手機，螢幕稍微立起朝向你，擺好你想當作正中央的握姿，再按「確定校正為 0°」。握穩約一秒，等到畫面顯示「校正完成」，這個姿勢就成為 0°。
5. 按「開始任務」。右傾右轉、左傾左轉，按住油門加速；其他按鈕控制煞車、手煞車、倒車和氮氣。
6. 改變握姿後按「重新校正 0°」；改變介面方向後重新確認中央。收不到資料、手機仍在移動或放得太平時會顯示原因。也提供「反轉體感方向」選項與觸控方向備援。

手機與電腦建議先使用同一個 Wi-Fi。體感需要 HTTPS；GitHub Pages 提供 HTTPS。限制 WebRTC 的網路可能連不上，請換網路。公共 PeerJS 信令服務是外部依賴，本版沒有專用 TURN 中繼。切換 App／鎖屏會停止控制，斷線時遊戲會暫停。

手動橫向會旋轉網頁控制介面，並同步轉向感測座標；不需改變 iPhone 的系統方向鎖定。校正至少採集六筆連續且穩定的資料，涵蓋 600ms，五秒內未完成則提示重試。

## 鍵盤與玩法

| 操作 | 按鍵 |
| --- | --- |
| 加速／倒車 | W／S 或 ↑／↓ |
| 轉向 | A／D 或 ←／→ |
| 手煞車／甩尾 | Space |
| 氮氣 | Shift |
| 暫停／繼續 | Esc |
| 重開 | R |

在 180 秒內穿過八個青色導航門，到達碼頭。碰撞降低耐久，時間耗盡或耐久歸零會失敗。亦提供自由駕駛、低畫質模式、音效切換、全螢幕與本機最佳成績。

## 製作

- Babylon.js + TypeScript + Vite；固定 60Hz 街機車輛模擬。
- Blender 4.5 LTS 製作原創城市、銀色跑車、追逐車與導航門，輸出 GLB。`.blend` 作者檔位於 `art-source/blender-projects.zip`。
- 港灣街廓、窗框、霓虹商店、棕櫚、標線、碼頭、吊車和車體零件是實際 3D 幾何；天空貼圖與概念圖由 Image Gen 生成。
- WebRTC DataChannel 傳送控制輸入；DeviceMotion 重力投影與 DeviceOrientation 備援提供體感轉向，含姿勢校正與敏感度。
- 原創合成引擎聲、碰撞與檢查點提示音。
- 配樂使用 [Synthwave House Loop — Fupi](https://opengameart.org/content/synthwave-house-loop)，作者以 [CC0](https://creativecommons.org/publicdomain/zero/1.0/) 公開。右上角音符按鈕可單獨開關配樂，暫停時降低音量。

都市駕駛氣氛參考大型開放世界遊戲；採用原創風格化模型。這是可玩垂直切片，尚未具備商業 AAA 遊戲的內容量和寫實精度。

## 本機開發

需要 Node.js 24：

```sh
npm ci
npm test
npm run dev
```

正式版本：

```sh
npm run build
npm run preview -- --port 4173
```

Blender 重建（依序執行，第二個腳本會合併車輛網格並建立導航門）：

```sh
blender --background --python art-source/build_assets.py
blender --background --python art-source/optimize_models.py
```

推送 `main` 後 GitHub Actions 會測試、打包及部署。新複製的專案需在 Settings → Pages 選 GitHub Actions。

## 驗證與技術文件

檢查紀錄與已知限制：[QA](docs/qa.md)。模型清單：[asset ledger](docs/asset-ledger.csv)。第三方套件授權：[notices](public/third-party-notices.txt)。

- [MDN：Device orientation events](https://developer.mozilla.org/en-US/docs/Web/API/Device_orientation_events/Detecting_device_orientation)
- [W3C：Device Orientation and Motion](https://www.w3.org/TR/orientation-event/)
- [W3C：Screen Orientation](https://www.w3.org/TR/screen-orientation/)
- [Apple：iPhone 螢幕旋轉與直向鎖定](https://support.apple.com/en-gb/118226)
- [PeerJS API](https://peerjs.com/docs/)
- [Babylon.js：glTF import](https://doc.babylonjs.com/features/featuresDeepDive/importers/glTF/)
- [GitHub Pages 自訂工作流程](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
