import React, { useEffect } from 'react';
import {
    StatusBar,
    StyleSheet,
    Text,
    ToastAndroid,
    useColorScheme,
    View,
} from 'react-native';
import { CardResultModal } from '../components/CardResultModal';
import { ReaderStatus } from '../components/ReaderStatus';
import { useCardReader } from '../hooks/useCardReader';

export function CardReaderScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const isDarkMode = colorScheme === 'dark';
    const styles = isDarkMode ? darkThemeStyles : lightThemeStyles;
    const { status, result, error, startScanning, acknowledgeError, dismissResult } =
        useCardReader();

    useEffect(() => {
        startScanning();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (error) {
            ToastAndroid.show(error, ToastAndroid.SHORT);
            acknowledgeError();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error]);

    return (
        <>
            <StatusBar
                barStyle={isDarkMode ? 'light-content' : 'dark-content'}
                backgroundColor={isDarkMode ? 'black' : 'white'}
            />
            <View style={styles.body}>
                <Text style={styles.appName}>HolyCard</Text>
                <ReaderStatus status={status} darkMode={isDarkMode} />
            </View>
            <CardResultModal
                result={result}
                visible={status === 'success'}
                darkMode={isDarkMode}
                onClose={dismissResult}
            />
        </>
    );
}

const baseStyles = {
    body: {
        flex: 1,
        paddingTop: 32,
        paddingHorizontal: 24,
    },
    appName: {
        fontSize: 24,
        fontWeight: '600' as const,
    },
};

const lightThemeStyles = StyleSheet.create({
    body: {
        ...baseStyles.body,
        backgroundColor: 'white',
    },
    appName: {
        ...baseStyles.appName,
        color: 'black',
    },
});

const darkThemeStyles = StyleSheet.create({
    body: {
        ...baseStyles.body,
        backgroundColor: 'black',
    },
    appName: {
        ...baseStyles.appName,
        color: 'white',
    },
});
