/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * Generated with the TypeScript template
 * https://github.com/react-native-community/react-native-template-typescript
 *
 * @format
 */

import React from 'react';
import { StatusBar, Text, useColorScheme, View } from 'react-native';

const App = () => {
    const isDarkMode = useColorScheme() === 'dark';

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
