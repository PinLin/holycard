import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
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
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <View style={styles.container}>
                <CardSummary
                    result={result}
                    darkMode={darkMode}
                    footerReadAt={footerReadAt}
                />
            </View>
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
