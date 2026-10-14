# holycard

我的卡片餘額讀取器，只有 Android 版。

有 key 的卡片優先用 MIFARE Classic 讀，因為晶片悠遊卡（9122／9123）的月票只存在加密磁區裡，它的 applet 只讀得到卡號與餘額。沒有 key 的時候（例如金鑰來源查無此卡）才退回 applet：晶片悠遊卡讀得出卡號與餘額，超級悠遊卡（9132）連月票也讀得出來；icash 2.0 不需要 key。其他卡片（舊款悠遊卡、聯名卡）沒有 key 就讀不了。

https://hackmd.io/@PinLin/ryUV9TR0Jx

| ![](https://imgur.com/Quioo7P.png) | ![](https://imgur.com/fAE208A.png) |
| :--------------------------------: | :--------------------------------: |
| ![](https://imgur.com/dvg7enl.png) | ![](https://imgur.com/yDQ0hxn.png) |
