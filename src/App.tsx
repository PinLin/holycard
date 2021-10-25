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
import { Image, Modal, StatusBar, Text, ToastAndroid, useColorScheme, View } from 'react-native';
import { Card, CardType } from './model/card';
import { nfcUtil } from './util/nfc';

nfcUtil.init();

const App = () => {
    const isDarkMode = useColorScheme() === 'dark';
    const [isReady, setIsReady] = useState(false);
    const [isReading, setIsReading] = useState(false);
    const [isShowing, setIsShowing] = useState(false);
    const [cardType, setCardType] = useState(CardType.Unknown);
    const [cardName, setCardName] = useState('');
    const [cardBalance, setCardBalance] = useState(0);

    if (!isReady) {
        nfcUtil.requestMifareClassic(async () => {
            setIsReading(true);

            const uid = await nfcUtil.getCardUid();
            const response = await fetch(`https://card.pinlin.me/card/${uid}`);
            if (!response.ok) {
                throw "卡片未註冊";
            }
            const card = (await response.json()) as Card;

            const key = card.keys.find(key => key.type.toLowerCase() == '2a');
            if (!key) {
                throw "卡片未註冊";
            }
            const key2A = nfcUtil.convertKey(key.key);
            const balance = await nfcUtil.getCardBalance(key2A);

            setCardName(card.name);
            setCardType(card.type);
            setCardBalance(balance);
            setIsShowing(true);
        }).catch((e) => {
            ToastAndroid.show(`${e}`, ToastAndroid.SHORT);

            setIsReady(false);
            setIsReading(false);
        });

        setIsReady(true);
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
                >HolyCard</Text>
                <View
                    style={{
                        flex: 1,
                        justifyContent: 'center',
                    }}
                >
                    {
                        isReading &&
                        <ProgressBar />
                    }
                    {
                        !isReading &&
                        <Text
                            style={{
                                textAlign: 'center',
                                fontSize: 24,
                                fontWeight: '400',
                                color: isDarkMode ? 'white' : 'black',
                            }}
                        >請感應卡片</Text>
                    }
                </View>
            </View>
            <Modal
                animationType='slide'
                transparent={true}
                visible={isShowing}
                onRequestClose={() => {
                    setIsReady(false);
                    setIsReading(false);
                    setIsShowing(false);
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
                                cardType == CardType.IPass ? require('./image/ipass.png') :
                                    cardType == CardType.EasyCard ? require('./image/easycard.png') :
                                        cardType == CardType.HappyCash ? require('./image/happycash.png') :
                                            require('./image/unknown.png')
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
                        >{cardName}</Text>
                        <Text
                            style={{
                                marginTop: 30,
                                textAlign: 'center',
                                fontSize: 24,
                                fontWeight: '400',
                                color: isDarkMode ? 'white' : 'black',
                            }}
                        >卡片餘額：{cardBalance} 元</Text>
                    </View>
                </View>
            </Modal>
        </>
    );
};

export default App;
