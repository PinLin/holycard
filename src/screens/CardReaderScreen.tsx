import React, { useEffect } from 'react';
import { MenuView } from '@react-native-menu/menu';
import {
    StatusBar,
    StyleSheet,
    Text,
    ToastAndroid,
    useColorScheme,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardResultModal } from '../components/CardResultModal';
import { HistoryModal } from '../components/HistoryModal';
import { KeyServerModal } from '../components/KeyServerModal';
import { useCardReader } from '../hooks/useCardReader';
import { deleteHistoryEntry, loadHistory } from '../services/historyStorage';
import {
    loadKeyServerUrl,
    saveKeyServerUrl,
} from '../services/settingsStorage';
import { CardReadResult } from '../types';

export function CardReaderScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const isDarkMode = colorScheme === 'dark';
    const styles = isDarkMode ? darkThemeStyles : lightThemeStyles;
    const insets = useSafeAreaInsets();
    const [history, setHistory] = React.useState<CardReadResult[]>([]);
    const [historyVisible, setHistoryVisible] = React.useState(false);
    const [historySearch, setHistorySearch] = React.useState('');
    const [selectedHistoryEntry, setSelectedHistoryEntry] =
        React.useState<CardReadResult | null>(null);
    const [keyServerVisible, setKeyServerVisible] = React.useState(false);
    const [keyServerUrl, setKeyServerUrl] = React.useState<string | null>(null);
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
        loadKeyServerUrl()
            .then(setKeyServerUrl)
            .catch(() => {});
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
            {/* targetSdk 35 起畫面會延伸到系統列底下，留白要加上系統列高度。 */}
            <View
                style={[
                    styles.body,
                    {
                        paddingTop: styles.body.paddingTop + insets.top,
                        paddingBottom: insets.bottom,
                    },
                ]}
            >
                <View style={styles.header}>
                    <Text style={styles.appName}>HolyCard</Text>
                    <MenuView
                        actions={[
                            { id: 'history', title: '歷史紀錄' },
                            { id: 'key-server', title: '編輯金鑰來源' },
                        ]}
                        onPressAction={({ nativeEvent }) => {
                            if (nativeEvent.event === 'history') {
                                setHistoryVisible(true);
                            } else if (nativeEvent.event === 'key-server') {
                                setKeyServerVisible(true);
                            }
                        }}
                    >
                        <View
                            style={styles.menuButton}
                            accessible
                            accessibilityLabel="選單"
                        >
                            <Text style={styles.menuButtonText}>⋮</Text>
                        </View>
                    </MenuView>
                </View>
                <View style={styles.centerView}>
                    <Text style={styles.centerText}>
                        {status === 'reading' ? '正在讀取...' : '請感應卡片'}
                    </Text>
                </View>
            </View>
            <KeyServerModal
                visible={keyServerVisible}
                darkMode={isDarkMode}
                currentUrl={keyServerUrl}
                onClose={() => setKeyServerVisible(false)}
                onSave={async (url) => {
                    try {
                        await saveKeyServerUrl(url);
                        setKeyServerUrl(url);
                        setKeyServerVisible(false);
                        ToastAndroid.show(
                            url ? '已儲存金鑰來源' : '已清除金鑰來源',
                            ToastAndroid.SHORT,
                        );
                    } catch {
                        ToastAndroid.show('儲存失敗', ToastAndroid.SHORT);
                    }
                }}
            />
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
    menuButton: {
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    menuButtonText: {
        fontSize: 24,
        fontWeight: '600' as const,
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
    menuButton: baseStyles.menuButton,
    menuButtonText: {
        ...baseStyles.menuButtonText,
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
    menuButton: baseStyles.menuButton,
    menuButtonText: {
        ...baseStyles.menuButtonText,
        color: 'white',
    },
    centerView: baseStyles.centerView,
    centerText: {
        ...baseStyles.centerText,
        color: 'white',
    },
});
