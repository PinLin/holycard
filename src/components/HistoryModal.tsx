import React from 'react';
import {
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';
import { CardReadResult } from '../types';
import { getDateTimeString } from '../utils';
import { getCardBrandImageSource } from './CardSummary';

interface HistoryModalProps {
    visible: boolean;
    darkMode: boolean;
    history: CardReadResult[];
    historySearch: string;
    onChangeSearch: (value: string) => void;
    onClose: () => void;
    onSelect: (entry: CardReadResult) => void;
    onDelete: (entry: CardReadResult) => void;
}

export function HistoryModal({
    visible,
    darkMode,
    history,
    historySearch,
    onChangeSearch,
    onClose,
    onSelect,
    onDelete,
}: HistoryModalProps) {
    const { width } = useWindowDimensions();
    const styles = darkMode ? darkThemeStyles : lightThemeStyles;
    const isWideScreen = width >= 700;
    const normalizedSearch = historySearch.replace(/\s+/g, '');
    const filteredHistory = history.filter((entry) =>
        entry.card.number.replace(/\s+/g, '').includes(normalizedSearch),
    );

    return (
        <Modal
            animationType="slide"
            transparent
            visible={visible}
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable
                    style={[
                        styles.container,
                        isWideScreen && styles.wideContainer,
                    ]}
                    onPress={() => {}}
                >
                    <View style={styles.header}>
                        <Text style={styles.title}>歷史紀錄</Text>
                    </View>
                    <TextInput
                        value={historySearch}
                        onChangeText={onChangeSearch}
                        placeholder="搜尋卡號"
                        placeholderTextColor={darkMode ? '#999' : '#666'}
                        style={styles.searchInput}
                    />
                    <ScrollView contentContainerStyle={styles.historyList}>
                        {filteredHistory.length === 0 ? (
                            <Text style={styles.historyEmpty}>
                                尚無讀卡紀錄
                            </Text>
                        ) : (
                            filteredHistory.map((entry) => (
                                <View
                                    key={`${entry.card.uid}-${entry.readAt?.toString()}`}
                                    style={styles.historyCard}
                                >
                                    <Pressable
                                        style={styles.historyCardContent}
                                        onPress={() => onSelect(entry)}
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
                                                {entry.readAt
                                                    ? getDateTimeString(
                                                          entry.readAt,
                                                      )
                                                    : ''}
                                            </Text>
                                        </View>
                                    </Pressable>
                                    <Pressable
                                        style={styles.deleteButton}
                                        accessibilityRole="button"
                                        accessibilityLabel={`移除 ${entry.card.number} 的歷史紀錄`}
                                        onPress={() => onDelete(entry)}
                                    >
                                        <Text style={styles.deleteButtonText}>
                                            ×
                                        </Text>
                                    </Pressable>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const baseStyles = {
    overlay: {
        flex: 1,
        justifyContent: 'center' as const,
        padding: 20,
        backgroundColor: 'transparent',
    },
    container: {
        borderRadius: 18,
        maxHeight: '85%' as const,
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 12,
    },
    wideContainer: {
        width: 560,
        maxWidth: '100%' as const,
        alignSelf: 'center' as const,
    },
    header: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        marginBottom: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: '600' as const,
    },
    searchInput: {
        marginBottom: 16,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 18,
    },
    historyList: {
        paddingBottom: 12,
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
    overlay: baseStyles.overlay,
    container: {
        ...baseStyles.container,
        backgroundColor: '#FAFAFA',
    },
    wideContainer: baseStyles.wideContainer,
    header: baseStyles.header,
    title: {
        ...baseStyles.title,
        color: 'black',
    },
    searchInput: {
        ...baseStyles.searchInput,
        borderColor: '#D8D8D8',
        color: 'black',
        backgroundColor: 'white',
    },
    historyList: baseStyles.historyList,
    historyCard: {
        ...baseStyles.historyCard,
        backgroundColor: 'white',
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
        backgroundColor: '#F0F0F0',
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
    overlay: baseStyles.overlay,
    container: {
        ...baseStyles.container,
        backgroundColor: '#303030',
    },
    wideContainer: baseStyles.wideContainer,
    header: baseStyles.header,
    title: {
        ...baseStyles.title,
        color: 'white',
    },
    searchInput: {
        ...baseStyles.searchInput,
        borderColor: '#4A4A4A',
        color: 'white',
        backgroundColor: '#3A3A3A',
    },
    historyList: baseStyles.historyList,
    historyCard: {
        ...baseStyles.historyCard,
        backgroundColor: '#3A3A3A',
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
        backgroundColor: '#4A4A4A',
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
