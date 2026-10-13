import React, { useEffect, useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { normalizeKeyServerUrl } from '../services/settingsStorage';

interface KeyServerModalProps {
    visible: boolean;
    darkMode: boolean;
    currentUrl: string | null;
    onClose: () => void;
    onSave: (url: string | null) => void;
}

export function KeyServerModal({
    visible,
    darkMode,
    currentUrl,
    onClose,
    onSave,
}: KeyServerModalProps) {
    const styles = darkMode ? darkThemeStyles : lightThemeStyles;
    const [input, setInput] = useState(currentUrl ?? '');
    const [invalid, setInvalid] = useState(false);

    useEffect(() => {
        if (visible) {
            setInput(currentUrl ?? '');
            setInvalid(false);
        }
    }, [visible, currentUrl]);

    const unchanged = input.trim() === (currentUrl ?? '');

    const handleSave = () => {
        if (input.trim() === '') {
            onSave(null);
            return;
        }
        const url = normalizeKeyServerUrl(input);
        if (!url) {
            setInvalid(true);
            return;
        }
        onSave(url);
    };

    return (
        <Modal
            animationType="slide"
            transparent
            visible={visible}
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.container} onPress={() => {}}>
                    <Text style={styles.title}>金鑰來源</Text>
                    <View style={styles.inputBox}>
                        <TextInput
                            value={input}
                            onChangeText={(value) => {
                                setInput(value);
                                setInvalid(false);
                            }}
                            placeholder="https://"
                            placeholderTextColor={darkMode ? '#777' : '#999'}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                            style={styles.input}
                        />
                        {input !== '' && (
                            <Pressable
                                onPress={() => {
                                    setInput('');
                                    setInvalid(false);
                                }}
                                hitSlop={10}
                                accessibilityRole="button"
                                accessibilityLabel="清除"
                                style={styles.clearButton}
                            >
                                <Text style={styles.clearText}>✕</Text>
                            </Pressable>
                        )}
                    </View>
                    {invalid && (
                        <Text style={styles.error}>
                            請輸入 http:// 或 https:// 開頭的網址
                        </Text>
                    )}
                    <View style={styles.actions}>
                        <Pressable
                            onPress={onClose}
                            hitSlop={4}
                            style={styles.cancelButton}
                        >
                            <Text style={styles.cancelText}>取消</Text>
                        </Pressable>
                        <Pressable
                            onPress={handleSave}
                            disabled={unchanged}
                            hitSlop={4}
                            style={[
                                styles.saveButton,
                                unchanged && styles.saveButtonDisabled,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.saveText,
                                    unchanged && styles.saveTextDisabled,
                                ]}
                            >
                                儲存
                            </Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const baseStyles = {
    overlay: {
        flex: 1,
        justifyContent: 'center' as const,
        padding: 24,
        backgroundColor: 'transparent',
    },
    container: {
        width: '100%' as const,
        maxWidth: 480,
        alignSelf: 'center' as const,
        borderRadius: 18,
        padding: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: '600' as const,
        marginBottom: 16,
    },
    inputBox: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        borderWidth: 1,
        borderRadius: 8,
        paddingRight: 8,
    },
    input: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
    },
    clearButton: {
        width: 28,
        height: 28,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
    },
    clearText: {
        fontSize: 16,
    },
    error: {
        color: '#d32f2f',
        fontSize: 14,
        marginTop: 8,
    },
    actions: {
        flexDirection: 'row' as const,
        justifyContent: 'flex-end' as const,
        alignItems: 'center' as const,
        gap: 8,
        marginTop: 20,
    },
    cancelButton: {
        height: 40,
        paddingHorizontal: 16,
        justifyContent: 'center' as const,
    },
    cancelText: {
        fontSize: 15,
        fontWeight: '500' as const,
    },
    saveButton: {
        height: 40,
        paddingHorizontal: 20,
        borderRadius: 20,
        justifyContent: 'center' as const,
    },
    saveButtonDisabled: {},
    saveText: {
        fontSize: 15,
        fontWeight: '600' as const,
    },
    saveTextDisabled: {},
};

const lightThemeStyles = StyleSheet.create({
    ...baseStyles,
    container: { ...baseStyles.container, backgroundColor: '#FAFAFA' },
    title: { ...baseStyles.title, color: 'black' },
    inputBox: { ...baseStyles.inputBox, borderColor: '#D8D8D8' },
    input: { ...baseStyles.input, color: 'black' },
    clearText: { ...baseStyles.clearText, color: '#8A8A8A' },
    cancelText: { ...baseStyles.cancelText, color: '#555' },
    saveButton: { ...baseStyles.saveButton, backgroundColor: '#1F1F1F' },
    saveButtonDisabled: { backgroundColor: '#E0E0E0' },
    saveText: { ...baseStyles.saveText, color: 'white' },
    saveTextDisabled: { color: '#999' },
});

const darkThemeStyles = StyleSheet.create({
    ...baseStyles,
    container: { ...baseStyles.container, backgroundColor: '#303030' },
    title: { ...baseStyles.title, color: 'white' },
    inputBox: { ...baseStyles.inputBox, borderColor: '#4A4A4A' },
    input: { ...baseStyles.input, color: 'white' },
    clearText: { ...baseStyles.clearText, color: '#9A9A9A' },
    cancelText: { ...baseStyles.cancelText, color: '#DDD' },
    saveButton: { ...baseStyles.saveButton, backgroundColor: '#E8E8E8' },
    saveButtonDisabled: { backgroundColor: '#4A4A4A' },
    saveText: { ...baseStyles.saveText, color: '#1A1A1A' },
    saveTextDisabled: { color: '#888' },
});
