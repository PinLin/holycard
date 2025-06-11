/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * Generated with the TypeScript template
 * https://github.com/react-native-community/react-native-template-typescript
 *
 * @format
 */

import React, { useState } from 'react';
import {
    StatusBar,
    Text,
    ToastAndroid,
    useColorScheme,
    View,
} from 'react-native';
import { Card, CardType } from './model/card.model';
import { NfcService } from './service/nfc.service';
import { ResultModal } from './components/ResultModal';

const nfcService = new NfcService();

function App(): React.JSX.Element {
    const isDarkMode = useColorScheme() === 'dark';
    const [isReady, setIsReady] = useState(false);
    const [isReadingCard, setIsReadingCard] = useState(false);
    const [isShowingResult, setIsShowingResult] = useState(false);

    const [cardType, setCardType] = useState(CardType.UNKNOWN);
    const [cardName, setCardName] = useState('');
    const [cardBalance, setCardBalance] = useState(0);
    const [isKuoKuangCard, setIsKuoKuangCard] = useState(false);
    const [cardKuoKuangPoints, setCardKuoKuangPoints] = useState(0);
    const [isTPassPurchased, setIsTPassPurchased] = useState(false);
    const [tPassPurchaseDate, setTPassPurchaseDate] = useState('');
    const [tPassExpiryDate, setTPassExpiryDate] = useState('');

    async function readCard() {
        setIsReady(true);

        try {
            await nfcService.requestMifareClassic(async (uid: string) => {
                setIsReadingCard(true);

                const response = await fetch(
                    `https://card.pinlin.me/card/${uid}`,
                );
                if (!response.ok) {
                    ToastAndroid.show('查無卡片資料', ToastAndroid.SHORT);
                    setIsReady(false);
                    setIsReadingCard(false);
                    return;
                }

                const card: Card = await response.json();
                setCardName(card.name);
                setCardType(card.type);

                const sector2KeyA = card.sectors.find(
                    (s) => s.index === 2,
                )?.keyA;
                if (!sector2KeyA) {
                    ToastAndroid.show(
                        '缺少讀取餘額所需的金鑰 2A',
                        ToastAndroid.SHORT,
                    );
                    setIsReady(false);
                    setIsReadingCard(false);
                    return;
                }
                const balance = await nfcService.readCardBalance(sector2KeyA);
                setCardBalance(balance);

                // 國光回數票悠遊卡
                if (
                    card.tags.includes('KuoKuangCard') &&
                    card.type === CardType.EASY_CARD
                ) {
                    const sector11KeyA = card.sectors.find(
                        (s) => s.index === 11,
                    )?.keyA;
                    if (sector11KeyA) {
                        try {
                            const kuoKuangPoints =
                                await nfcService.readCardKuoKuangPoints(
                                    sector11KeyA,
                                );
                            setCardKuoKuangPoints(kuoKuangPoints);
                            setIsKuoKuangCard(true);
                        } catch (err) {
                            if (
                                (err as any).message ===
                                'mifareClassicAuthenticate fail: AUTH_FAIL'
                            ) {
                                ToastAndroid.show(
                                    '讀取國光點數所需的金鑰 11A 無效',
                                    ToastAndroid.SHORT,
                                );
                            }
                        }
                    } else {
                        ToastAndroid.show(
                            '缺少讀取國光點數所需的金鑰 11A',
                            ToastAndroid.SHORT,
                        );
                    }
                }

                // TPASS 通勤月票悠遊卡（不支援國光回數票悠遊卡）
                if (
                    card.type === CardType.EASY_CARD &&
                    !card.tags.includes('KuoKuangCard')
                ) {
                    const sector3KeyA = card.sectors.find(
                        (s) => s.index === 3,
                    )?.keyA;
                    const sector8KeyA = card.sectors.find(
                        (s) => s.index === 8,
                    )?.keyA;
                    if (sector3KeyA && sector8KeyA) {
                        try {
                            const {
                                purchaseDateString: purchaseDate,
                                expiryDateString: expiryDate,
                            } = await nfcService.readTPassInfo(
                                sector3KeyA,
                                sector8KeyA,
                            );
                            if (purchaseDate) {
                                setTPassPurchaseDate(purchaseDate);
                                if (expiryDate) {
                                    setTPassExpiryDate(expiryDate);
                                } else {
                                    setTPassExpiryDate('未啟用');
                                }
                                setIsTPassPurchased(true);
                            }
                        } catch (err) {
                            if (
                                (err as any).message ===
                                'mifareClassicAuthenticate fail: AUTH_FAIL'
                            ) {
                                ToastAndroid.show(
                                    '讀取通勤月票資訊所需的金鑰 3A 或 8A 無效',
                                    ToastAndroid.SHORT,
                                );
                            }
                        }
                    } else {
                        ToastAndroid.show(
                            '缺少讀取通勤月票資訊所需的金鑰 3A 或 8A',
                            ToastAndroid.SHORT,
                        );
                    }
                }

                setIsShowingResult(true);
            });
        } catch (err) {
            ToastAndroid.show(`${err}`, ToastAndroid.SHORT);

            setIsReady(false);
            setIsReadingCard(false);
        }
    }

    if (!isReady) {
        readCard();
    }

    return (
        <>
            <StatusBar
                barStyle={isDarkMode ? 'light-content' : 'dark-content'}
                backgroundColor={isDarkMode ? 'black' : 'white'}
            />
            <View
                style={{
                    flex: 1,
                    paddingTop: 32,
                    paddingHorizontal: 24,
                    backgroundColor: isDarkMode ? 'black' : 'white',
                }}
            >
                <Text
                    style={{
                        fontSize: 24,
                        fontWeight: '600',
                        color: isDarkMode ? 'white' : 'black',
                    }}
                >
                    HolyCard
                </Text>
                <View
                    style={{
                        flex: 1,
                        justifyContent: 'center',
                    }}
                >
                    {isReadingCard && (
                        <Text
                            style={{
                                textAlign: 'center',
                                fontSize: 24,
                                fontWeight: '400',
                                color: isDarkMode ? 'white' : 'black',
                            }}
                        >
                            正在讀取卡片...
                        </Text>
                    )}
                    {!isReadingCard && (
                        <Text
                            style={{
                                textAlign: 'center',
                                fontSize: 24,
                                fontWeight: '400',
                                color: isDarkMode ? 'white' : 'black',
                            }}
                        >
                            請感應卡片
                        </Text>
                    )}
                </View>
            </View>
            {isShowingResult && (
                <ResultModal
                    cardType={cardType}
                    cardName={cardName}
                    cardBalance={cardBalance}
                    isKuoKuangCard={isKuoKuangCard}
                    cardKuoKuangPoints={cardKuoKuangPoints}
                    isTPassPurchased={isTPassPurchased}
                    tPassPurchaseDate={tPassPurchaseDate}
                    tPassExpiryDate={tPassExpiryDate}
                    onRequestClose={() => {
                        setIsReady(false);
                        setIsReadingCard(false);
                        setIsShowingResult(false);
                        setIsKuoKuangCard(false);
                        setIsTPassPurchased(false);
                    }}
                />
            )}
        </>
    );
}

export default App;
