import React from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import { CardReadResult } from '../types';
import { CardSummary } from './CardSummary';

interface CardResultModalProps {
    result: CardReadResult | null;
    visible: boolean;
    darkMode: boolean;
    onClose: () => void;
    footerReadAt?: boolean;
}

export function CardResultModal({
    result,
    visible,
    darkMode,
    onClose,
    footerReadAt,
}: CardResultModalProps) {
    if (!result) {
        return null;
    }

    return (
        <Modal
            animationType="slide"
            transparent
            visible={visible}
            onRequestClose={onClose}
        >
            <Pressable style={styles.container} onPress={onClose}>
                <Pressable onPress={() => {}}>
                    <CardSummary
                        result={result}
                        darkMode={darkMode}
                        footerReadAt={footerReadAt}
                    />
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
