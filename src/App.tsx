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
import { Card, CardType } from './model/card';
import { NfcService } from './service/nfc.service';

const nfcService = new NfcService();

nfcService.init();

const App = () => {
    const isDarkMode = useColorScheme() === 'dark';
    const [isReady, setIsReady] = useState(false);
    const [isReadingCard, setIsReadingCard] = useState(false);
    const [isShowingResult, setIsShowingResult] = useState(false);
    const [cardType, setCardType] = useState(CardType.Unknown);
    const [cardName, setCardName] = useState('');
    const [cardBalance, setCardBalance] = useState(0);

    const [isKuoKuangCard, setIsKuoKuangCard] = useState(false);
    const [cardKuoKuangPoints, setCardKuoKuangPoints] = useState(0);

    async function readCard() {
        setIsReady(true);

        try {
            await nfcService.requestMifareClassic(async () => {
                setIsReadingCard(true);

                const uid = await nfcService.readCardUid();
                const response = await fetch(
                    `https://card.pinlin.me/card/${uid}`,
                );
                if (!response.ok) {
                    throw '查無卡片資料';
                }

                const card: Card = await response.json();
                setCardName(card.name);
                setCardType(card.type);

                const sector2KeyA = card.keys.find(
                    (key) => key.type.toLowerCase() == '2a',
                )?.key;
                if (!sector2KeyA) {
                    throw '無法讀取餘額';
                }
                const balance = await nfcService.readCardBalance(sector2KeyA);
                setCardBalance(balance);

                const sector11KeyA = card.keys.find(
                    (key) => key.type.toLowerCase() == '11a',
                )?.key;
                if (sector11KeyA) {
                    const kuoKuangPoints =
                        await nfcService.readCardKuoKuangPoints(sector11KeyA);
                    setCardKuoKuangPoints(kuoKuangPoints);
                    setIsKuoKuangCard(true);
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
                                cardType == CardType.IPass
                                    ? require('./image/ipass.png')
                                    : cardType == CardType.EasyCard
                                    ? require('./image/easycard.png')
                                    : cardType == CardType.HappyCash
                                    ? require('./image/happycash.png')
                                    : require('./image/unknown.png')
                            }
                        />
                        <Text
                            style={{
                                marginTop: 30,
                                textAlign: 'center',
                                fontSize: 24,
                                fontWeight: '400',
                                color: isDarkMode ? 'white' : 'black',
                            }}
                        >
                            {cardName}
                        </Text>
                        <Text
                            style={{
                                marginTop: 30,
                                textAlign: 'center',
                                fontSize: 24,
                                fontWeight: '400',
                                color: isDarkMode ? 'white' : 'black',
                            }}
                        >
                            卡片餘額：{cardBalance} 元
                        </Text>
                        {isKuoKuangCard && (
                            <Text
                                style={{
                                    textAlign: 'center',
                                    fontSize: 24,
                                    fontWeight: '400',
                                    color: isDarkMode ? 'white' : 'black',
                                }}
                            >
                                國光點數：{cardKuoKuangPoints} 點
                            </Text>
                        )}
                    </View>
                </View>
            </Modal>
        </>
    );
};

export default App;
