import React, { useEffect } from 'react';
import {
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    ToastAndroid,
    useColorScheme,
    View,
} from 'react-native';
import { CardResultModal } from '../components/CardResultModal';
import { HistoryModal } from '../components/HistoryModal';
import { useCardReader } from '../hooks/useCardReader';
import {
    deleteHistoryEntry,
    loadHistory,
} from '../services/historyStorage';
import { CardReadResult } from '../types';

export function CardReaderScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const isDarkMode = colorScheme === 'dark';
    const styles = isDarkMode ? darkThemeStyles : lightThemeStyles;
    const [history, setHistory] = React.useState<CardReadResult[]>([]);
    const [historyVisible, setHistoryVisible] = React.useState(false);
    const [historySearch, setHistorySearch] = React.useState('');
    const [selectedHistoryEntry, setSelectedHistoryEntry] =
        React.useState<CardReadResult | null>(null);
    const {
        status,
        result,
        error,
        startScanning,
        acknowledgeError,
        dismissResult,
    } = useCardReader();

    useEffect(() => {
        startScanning();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        loadHistory()
            .then(setHistory)
            .catch(() => setHistory([]));
    }, []);

    useEffect(() => {
        if (result) {
            loadHistory()
                .then(setHistory)
                .catch(() => setHistory([]));
        }
    }, [result]);

    useEffect(() => {
        if (status === 'reading') {
            setHistoryVisible(false);
            setSelectedHistoryEntry(null);
        }
    }, [status]);

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
                <View style={styles.header}>
                    <Text style={styles.appName}>HolyCard</Text>
                    <Pressable
                        onPress={() => setHistoryVisible(true)}
                        style={styles.historyButton}
                    >
                        <Text style={styles.historyButtonText}>歷史</Text>
                    </Pressable>
                </View>
                <View style={styles.centerView}>
                    <Text style={styles.centerText}>
                        {status === 'reading' ? '正在讀取...' : '請感應卡片'}
                    </Text>
                </View>
            </View>
            <HistoryModal
                visible={historyVisible}
                darkMode={isDarkMode}
                history={history}
                historySearch={historySearch}
                onChangeSearch={setHistorySearch}
                onClose={() => setHistoryVisible(false)}
                onSelect={(entry) => {
                    setHistoryVisible(false);
                    setSelectedHistoryEntry(entry);
                }}
                onDelete={async (entry) => {
                    await deleteHistoryEntry(entry.card.uid);
                    setHistory((currentHistory) =>
                        currentHistory.filter(
                            (historyEntry) =>
                                historyEntry.card.uid !== entry.card.uid,
                        ),
                    );
                    if (selectedHistoryEntry?.card.uid === entry.card.uid) {
                        setSelectedHistoryEntry(null);
                    }
                }}
            />
            <CardResultModal
                result={result}
                visible={result !== null}
                darkMode={isDarkMode}
                footerReadAt
                onClose={dismissResult}
            />
            <CardResultModal
                result={selectedHistoryEntry}
                visible={selectedHistoryEntry !== null}
                darkMode={isDarkMode}
                footerReadAt
                onClose={() => {
                    setSelectedHistoryEntry(null);
                    setHistoryVisible(true);
                }}
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
    header: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        marginBottom: 24,
    },
    appName: {
        fontSize: 24,
        fontWeight: '600' as const,
    },
    historyButton: {
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    historyButtonText: {
        fontSize: 18,
        fontWeight: '500' as const,
    },
    centerView: {
        flex: 1,
        justifyContent: 'center' as const,
    },
    centerText: {
        textAlign: 'center' as const,
        fontSize: 24,
        fontWeight: '400' as const,
    },
};

const lightThemeStyles = StyleSheet.create({
    body: {
        ...baseStyles.body,
        backgroundColor: 'white',
    },
    header: baseStyles.header,
    appName: {
        ...baseStyles.appName,
        color: 'black',
    },
    historyButton: baseStyles.historyButton,
    historyButtonText: {
        ...baseStyles.historyButtonText,
        color: 'black',
    },
    centerView: baseStyles.centerView,
    centerText: {
        ...baseStyles.centerText,
        color: 'black',
    },
});

const darkThemeStyles = StyleSheet.create({
    body: {
        ...baseStyles.body,
        backgroundColor: 'black',
    },
    header: baseStyles.header,
    appName: {
        ...baseStyles.appName,
        color: 'white',
    },
    historyButton: baseStyles.historyButton,
    historyButtonText: {
        ...baseStyles.historyButtonText,
        color: 'white',
    },
    centerView: baseStyles.centerView,
    centerText: {
        ...baseStyles.centerText,
        color: 'white',
    },
});
