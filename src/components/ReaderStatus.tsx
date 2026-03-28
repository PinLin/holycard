import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CardReaderStatus } from '../types';

interface ReaderStatusProps {
    status: CardReaderStatus;
    darkMode: boolean;
}

const statusTextMap: Record<CardReaderStatus, string> = {
    ready: '請感應卡片',
    reading: '正在讀取...',
    success: '請感應卡片',
};

export function ReaderStatus({ status, darkMode }: ReaderStatusProps) {
    const styles = darkMode ? darkThemeStyles : lightThemeStyles;

    return (
        <View style={styles.container}>
            <Text style={styles.text}>{statusTextMap[status]}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
    },
});

const lightThemeStyles = StyleSheet.create({
    container: styles.container,
    text: {
        textAlign: 'center',
        fontSize: 24,
        fontWeight: '400',
        color: 'black',
    },
});

const darkThemeStyles = StyleSheet.create({
    container: styles.container,
    text: {
        textAlign: 'center',
        fontSize: 24,
        fontWeight: '400',
        color: 'white',
    },
});
