import React, { useEffect } from 'react';
import {
    Image,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    ToastAndroid,
    useColorScheme,
    View,
} from 'react-native';
import { getCardBrandImageSource } from '../components/CardSummary';
import { CardResultModal } from '../components/CardResultModal';
import { useCardReader } from '../hooks/useCardReader';
import {
    deleteHistoryEntry,
    loadHistory,
} from '../services/historyStorage';
import { CardReadResult } from '../types';
import { getDateTimeString } from '../utils';

export function CardReaderScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const isDarkMode = colorScheme === 'dark';
    const styles = isDarkMode ? darkThemeStyles : lightThemeStyles;
    const [history, setHistory] = React.useState<CardReadResult[]>([]);
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

    const normalizedSearch = historySearch.replace(/\s+/g, '');
    const filteredHistory = history.filter((entry) =>
        entry.card.number.replace(/\s+/g, '').includes(normalizedSearch),
    );

    return (
        <>
            <StatusBar
                barStyle={isDarkMode ? 'light-content' : 'dark-content'}
                backgroundColor={isDarkMode ? 'black' : 'white'}
            />
            <View style={styles.body}>
                <View style={styles.header}>
                    <Text style={styles.appName}>HolyCard</Text>
                    <Text style={styles.statusText}>
                        {status === 'reading' ? '正在讀取...' : '請感應卡片'}
                    </Text>
                </View>
                <TextInput
                    value={historySearch}
                    onChangeText={setHistorySearch}
                    placeholder="搜尋卡號"
                    placeholderTextColor={isDarkMode ? '#999' : '#666'}
                    style={styles.searchInput}
                />
                <ScrollView contentContainerStyle={styles.historyList}>
                    {filteredHistory.length === 0 ? (
                        <Text style={styles.historyEmpty}>尚無讀卡紀錄</Text>
                    ) : (
                        filteredHistory.map((entry) => (
                            <View
                                key={`${entry.card.number}-${entry.readAt}`}
                                style={styles.historyCard}
                            >
                                <Pressable
                                    style={styles.historyCardContent}
                                    onPress={() => setSelectedHistoryEntry(entry)}
                                >
                                    <Image
                                        source={getCardBrandImageSource(
                                            entry.card.type,
                                        )}
                                        style={styles.historyCardImage}
                                    />
                                    <View style={styles.historyCardText}>
                                        <Text
                                            style={styles.historyCardNumber}
                                            numberOfLines={1}
                                            adjustsFontSizeToFit
                                            minimumFontScale={0.7}
                                        >
                                            {entry.card.number}
                                        </Text>
                                        <Text style={styles.historyCardMeta}>
                                            {getDateTimeString(entry.readAt)}
                                        </Text>
                                    </View>
                                </Pressable>
                                <Pressable
                                    style={styles.deleteButton}
                                    accessibilityRole="button"
                                    accessibilityLabel={`移除 ${entry.card.number} 的歷史紀錄`}
                                    onPress={async () => {
                                        await deleteHistoryEntry(
                                            entry.card.uid,
                                        );
                                        setHistory((currentHistory) =>
                                            currentHistory.filter(
                                                (historyEntry) =>
                                                    historyEntry.card.uid !==
                                                    entry.card.uid,
                                            ),
                                        );
                                        if (
                                            selectedHistoryEntry?.card.uid ===
                                            entry.card.uid
                                        ) {
                                            setSelectedHistoryEntry(null);
                                        }
                                    }}
                                >
                                    <Text style={styles.deleteButtonText}>
                                        ×
                                    </Text>
                                </Pressable>
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>
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
                onClose={() => setSelectedHistoryEntry(null)}
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
    },
    appName: {
        fontSize: 24,
        fontWeight: '600' as const,
    },
    statusText: {
        fontSize: 18,
        fontWeight: '400' as const,
    },
    searchInput: {
        marginTop: 24,
        marginBottom: 16,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 18,
    },
    historyList: {
        paddingBottom: 24,
    },
    historyCard: {
        borderRadius: 12,
        paddingVertical: 14,
        paddingLeft: 14,
        paddingRight: 12,
        marginBottom: 12,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
    },
    historyCardContent: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        flex: 1,
    },
    historyCardImage: {
        width: 42,
        height: 42,
        resizeMode: 'contain' as const,
        marginRight: 14,
    },
    historyCardText: {
        flex: 1,
    },
    historyCardNumber: {
        fontSize: 20,
        fontWeight: '600' as const,
        marginBottom: 4,
        flexShrink: 1,
    },
    historyCardMeta: {
        fontSize: 12,
    },
    deleteButton: {
        marginLeft: 12,
        width: 32,
        height: 32,
        borderRadius: 999,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
    },
    deleteButtonText: {
        fontSize: 22,
        lineHeight: 24,
    },
    historyEmpty: {
        fontSize: 18,
        textAlign: 'center' as const,
        paddingTop: 32,
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
    header: baseStyles.header,
    statusText: {
        ...baseStyles.statusText,
        color: 'black',
    },
    searchInput: {
        ...baseStyles.searchInput,
        borderColor: '#B0B0B0',
        color: 'black',
    },
    historyList: baseStyles.historyList,
    historyCard: {
        ...baseStyles.historyCard,
        backgroundColor: '#F3F3F3',
    },
    historyCardContent: baseStyles.historyCardContent,
    historyCardImage: baseStyles.historyCardImage,
    historyCardText: baseStyles.historyCardText,
    historyCardNumber: {
        ...baseStyles.historyCardNumber,
        color: 'black',
    },
    historyCardMeta: {
        ...baseStyles.historyCardMeta,
        color: '#333',
    },
    deleteButton: {
        ...baseStyles.deleteButton,
        backgroundColor: '#E5E5E5',
    },
    deleteButtonText: {
        ...baseStyles.deleteButtonText,
        color: '#555',
    },
    historyEmpty: {
        ...baseStyles.historyEmpty,
        color: '#666',
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
    header: baseStyles.header,
    statusText: {
        ...baseStyles.statusText,
        color: 'white',
    },
    searchInput: {
        ...baseStyles.searchInput,
        borderColor: '#666',
        color: 'white',
        backgroundColor: '#1E1E1E',
    },
    historyList: baseStyles.historyList,
    historyCard: {
        ...baseStyles.historyCard,
        backgroundColor: '#1E1E1E',
    },
    historyCardContent: baseStyles.historyCardContent,
    historyCardImage: baseStyles.historyCardImage,
    historyCardText: baseStyles.historyCardText,
    historyCardNumber: {
        ...baseStyles.historyCardNumber,
        color: 'white',
    },
    historyCardMeta: {
        ...baseStyles.historyCardMeta,
        color: '#DDD',
    },
    deleteButton: {
        ...baseStyles.deleteButton,
        backgroundColor: '#383838',
    },
    deleteButtonText: {
        ...baseStyles.deleteButtonText,
        color: '#DDD',
    },
    historyEmpty: {
        ...baseStyles.historyEmpty,
        color: '#AAA',
    },
});
