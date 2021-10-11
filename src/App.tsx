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
import { StatusBar, Text, ToastAndroid, useColorScheme, View } from 'react-native';
import { Card } from './model/card';
import { nfcUtil } from './util/nfc';

nfcUtil.init();

const App = () => {
    const isDarkMode = useColorScheme() === 'dark';
    const [isReady, setIsReady] = useState(false);
    const [isReading, setIsReading] = useState(false);

    async function readCard() {
        try {
            await nfcUtil.startRequestMifareClassic();
            setIsReading(true);
            const uid = await nfcUtil.getCardUid();

            const response = await fetch(`https://card.pinlin.me/card/${uid}`);
            if (!response.ok) {
                throw "卡片未註冊";
            }
            const card = (await response.json()) as Card;

            const key = card.keys.find(key => key.type == '2a');
            if (!key) {
                throw "卡片未註冊";
            }
            const key2A = nfcUtil.convertKey(key.key);
            const balance = await nfcUtil.getCardBalance(key2A);

            ToastAndroid.show(`Balance: ${balance}`, ToastAndroid.SHORT);
        } catch (e) {
            console.log(e);
            ToastAndroid.show(`${e}`, ToastAndroid.SHORT);
        } finally {
            await nfcUtil.stopRequestMifareClassic();
            setIsReady(false);
            setIsReading(false);
        }
    }

    if (!isReady) {
        readCard();
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
        </>
    );
};

export default App;
