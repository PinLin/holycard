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
import { StatusBar, Text, ToastAndroid, useColorScheme, View } from 'react-native';
import { Card } from './model/card';
import { nfcUtil } from './util/nfc';

nfcUtil.init();

const App = () => {
    const isDarkMode = useColorScheme() === 'dark';
    const [isReady, setIsReady] = useState(false);

    async function readCard() {
        try {
            await nfcUtil.startRequestMifareClassic();
            const uid = await nfcUtil.getCardUid();

            const response = await fetch(`https://card.pinlin.me/card/${uid}`);
            if (!response.ok) {
                throw "卡片未註冊";
            }
            const card = (await response.json()) as Card;
            const key2A = card.keys.find(key => key.type == '2a')?.key;
            
            ToastAndroid.show(`Key 2A: ${key2A}`, ToastAndroid.SHORT);
        } catch (e) {
            console.log(e);
            ToastAndroid.show(`${e}`, ToastAndroid.SHORT);
        } finally {
            await nfcUtil.stopRequestMifareClassic();
            setIsReady(false);
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
                <Text
                    style={{
                        flex: 1,
                        textAlignVertical: 'center',
                        textAlign: 'center',
                        fontSize: 24,
                        fontWeight: '400',
                        color: isDarkMode ? 'white' : 'black',
                    }}
                >請感應卡片</Text>
            </View>
        </>
    );
};

export default App;
