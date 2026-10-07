# 美術來源

城市與車輛均使用本專案的 Blender 腳本建立，沒有使用 GTA 遊戲檔、品牌標誌、既有車款模型或配樂。

`harbor-city.glb`：原創城市街廓及港灣設施；作者檔 `harbor-city.blend`。

`raven-coupe.glb`、`pursuit-coupe.glb`：原創 RAVEN 跑車與追逐車；基礎作者檔 `raven-coupe.blend`，腳本提供兩種材質版本及網格優化。

`navigation-gate.glb`：Blender 製作導航門；作者檔 `navigation-gate.blend`。

`twilight-sky.jpg`：Image Gen 生成的等距柱狀天空貼圖，JPEG 壓縮使用 macOS sips。原圖 `docs/sky-source.png`。

概念圖 `docs/gameplay-concept.png` 作為構圖與色彩方向，不作遊戲底圖；本機保留。霧、泛光、輪胎痕、柔光池和 HUD 使用引擎或原生網頁繪製。

## 生成美術方向

概念：原創港灣都市駕駛，銀色雙門寬體跑車、黑車頂、紅尾燈、追車鏡頭、暮色橘紫天空、青色檢查點、桃紅霓虹、棕櫚與港口吊車；左下地圖、右下速度及氮氣，簡潔遊戲 HUD。無既有遊戲標誌或品牌。

天空：2:1 等距柱狀全景，暮色藍紫上空，雲層受暖色夕陽照亮，地平線放在畫面正中，無地景、無建築、無文字，左右接縫連續。第二次編輯將暖色地平線帶移至正中供立方環境貼圖轉換。

模型明確採用較輕量的風格化 PBR，而非概念圖的寫實密度。模型與天空均先在實際遊戲相機檢查後再調整光照、路面粗糙度、天空材質與起跑構圖。

## 配樂素材

`synthwave-house.m4a`：Fupi 的 **Synthwave House Loop**，114 BPM、可循環電子音樂，作者在 [OpenGameArt 素材頁](https://opengameart.org/content/synthwave-house-loop) 以 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) 公開。於 2026-10-07 查核作者及授權標示。下載該頁連結的 WAV，以 macOS afconvert 轉為 AAC 160 kbps；沒有改寫旋律或截取其他曲目。來源 WAV 留在製作暫存，遊戲包僅含壓縮版。署名亦保存在遊戲指引、README 和第三方聲明。
