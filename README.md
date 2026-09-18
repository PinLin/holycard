# holycard

我的卡片餘額讀取器，只有 Android 版。

有 key 的卡片優先用 MIFARE Classic 讀，因為通勤月票只存在加密磁區裡；晶片悠遊卡（9122／9132）的 applet 讀得到卡號與餘額，但讀不到月票。沒有 key 的時候（例如後端查無此卡）才退回 applet，這時晶片悠遊卡仍讀得出卡號與餘額，其他卡片（舊款悠遊卡、聯名卡）則讀不了。

https://hackmd.io/@PinLin/ryUV9TR0Jx

| ![](https://imgur.com/Quioo7P.png) | ![](https://imgur.com/fAE208A.png) |
| :--------------------------------: | :--------------------------------: |
| ![](https://imgur.com/dvg7enl.png) | ![](https://imgur.com/yDQ0hxn.png) |
