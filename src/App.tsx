/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * Generated with the TypeScript template
 * https://github.com/react-native-community/react-native-template-typescript
 *
 * @format
 */

import { ProgressBar } from '@react-native-community/progress-bar-android';
import React, { useState } from 'react';
import {
    Image,
    Modal,
    StatusBar,
    Text,
    ToastAndroid,
    useColorScheme,
    View,
} from 'react-native';
import { Card, CardType } from './model/card.model';
import { NfcService } from './service/nfc.service';

const nfcService = new NfcService();

const App = () => {
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
                    `https://holycard.pinlin.me/card/${uid}`,
                );
                if (!response.ok) {
                    throw '查無卡片資料';
                }

                const card: Card = await response.json();
                setCardName(card.name);
                setCardType(card.type);

                const sector2KeyA = card.sectors.find(
                    (s) => s.index === 2,
                )?.keyA;
                if (!sector2KeyA) {
                    throw '無法讀取餘額';
                }
                const balance = await nfcService.readCardBalance(sector2KeyA);
                setCardBalance(balance);

                if (card.tags.includes('KuoKuangCard')) {
                    const sector11KeyA = card.sectors.find(
                        (s) => s.index === 11,
                    )?.keyA;
                    if (sector11KeyA) {
                        const kuoKuangPoints =
                            await nfcService.readCardKuoKuangPoints(
                                sector11KeyA,
                            );
                        setCardKuoKuangPoints(kuoKuangPoints);
                        setIsKuoKuangCard(true);
                    } else {
                        ToastAndroid.show(
                            '缺少讀取國光點數所需的金鑰',
                            ToastAndroid.SHORT,
                        );
                    }
                }

                if (card.type === CardType.EASY_CARD) {
                    const sector7KeyA = card.sectors.find(
                        (s) => s.index === 7,
                    )?.keyA;
                    const sector8KeyA = card.sectors.find(
                        (s) => s.index === 8,
                    )?.keyA;
                    if (sector7KeyA && sector8KeyA) {
                        const { purchaseDateString: purchaseDate, expiryDateString: expiryDate } =
                            await nfcService.readTPassInfo(
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
                        } else {
                            setTPassPurchaseDate('未購買');
                        }
                    } else {
                        ToastAndroid.show(
                            '缺少讀取通勤月票資訊所需的金鑰',
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
                    {isReadingCard && <ProgressBar />}
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
            <Modal
                animationType="slide"
                transparent={true}
                visible={isShowingResult}
                onRequestClose={() => {
                    setIsReady(false);
                    setIsReadingCard(false);
                    setIsShowingResult(false);
                    setIsKuoKuangCard(false);
                    setIsTPassPurchased(false);
                }}
            >
                <View
                    style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <View
                        style={{
                            margin: 20,
                            backgroundColor: isDarkMode ? '#303030' : '#FAFAFA',
                            borderRadius: 10,
                            paddingHorizontal: 30,
                            paddingVertical: 50,
                            shadowColor: isDarkMode ? 'white' : 'black',
                            shadowRadius: 2,
                            elevation: 5,
                        }}
                    >
                        <Image
                            source={
                                cardType == CardType.I_PASS
                                    ? require('./image/ipass.png')
                                    : cardType == CardType.EASY_CARD
                                    ? require('./image/easycard.png')
                                    : cardType == CardType.HAPPY_CASH
                                    ? require('./image/happycash.png')
                                    : require('./image/unknown.png')
                            }
                        />
                        <Text
                            style={{
                                marginTop: 20,
                                textAlign: 'center',
                                fontSize: 26,
                                fontWeight: '400',
                                color: isDarkMode ? 'white' : 'black',
                            }}
                        >
                            {cardName}
                        </Text>
                        <View
                            style={{
                                marginTop: 20,
                                justifyContent: 'center',
                                alignItems: 'flex-start',
                            }}
                        >
                            <View
                                style={{
                                    flexDirection: 'row',
                                }}
                            >
                                <Text
                                    style={{
                                        flex: 1,
                                        fontSize: 20,
                                        fontWeight: '400',
                                        color: isDarkMode ? 'white' : 'black',
                                    }}
                                >
                                    卡片餘額：
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 20,
                                        fontWeight: '400',
                                        color: isDarkMode ? 'white' : 'black',
                                    }}
                                >
                                    {cardBalance} 元
                                </Text>
                            </View>
                            {isKuoKuangCard && (
                                <View
                                    style={{
                                        flexDirection: 'row',
                                    }}
                                >
                                    <Text
                                        style={{
                                            flex: 1,
                                            fontSize: 20,
                                            fontWeight: '400',
                                            color: isDarkMode
                                                ? 'white'
                                                : 'black',
                                        }}
                                    >
                                        國光點數：
                                    </Text>
                                    <Text
                                        style={{
                                            fontSize: 20,
                                            fontWeight: '400',
                                            color: isDarkMode
                                                ? 'white'
                                                : 'black',
                                        }}
                                    >
                                        {cardKuoKuangPoints} 點
                                    </Text>
                                </View>
                            )}
                            {isTPassPurchased && (
                                <View
                                    style={{
                                        width: '100%',
                                    }}
                                >
                                    <Text
                                        style={{
                                            marginTop: 20,
                                            textAlign: 'center',
                                            fontSize: 24,
                                            fontWeight: '400',
                                            color: isDarkMode
                                                ? 'white'
                                                : 'black',
                                        }}
                                    >
                                        基北北桃通勤月票
                                    </Text>
                                    <View
                                        style={{
                                            marginTop: 5,
                                            flexDirection: 'row',
                                        }}
                                    >
                                        <Text
                                            style={{
                                                flex: 1,
                                                fontSize: 20,
                                                fontWeight: '400',
                                                color: isDarkMode
                                                    ? 'white'
                                                    : 'black',
                                            }}
                                        >
                                            購買日期：
                                        </Text>
                                        <Text
                                            style={{
                                                fontSize: 20,
                                                fontWeight: '400',
                                                color: isDarkMode
                                                    ? 'white'
                                                    : 'black',
                                            }}
                                        >
                                            {tPassPurchaseDate}
                                        </Text>
                                    </View>
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                        }}
                                    >
                                        <Text
                                            style={{
                                                flex: 1,
                                                fontSize: 20,
                                                fontWeight: '400',
                                                color: isDarkMode
                                                    ? 'white'
                                                    : 'black',
                                            }}
                                        >
                                            到期日期：
                                        </Text>
                                        <Text
                                            style={{
                                                fontSize: 20,
                                                fontWeight: '400',
                                                color: isDarkMode
                                                    ? 'white'
                                                    : 'black',
                                            }}
                                        >
                                            {tPassExpiryDate}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
};

export default App;
