import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { CardReadResult, CardType } from '../types';
import { getDateString } from '../utils';

interface CardSummaryProps {
    result: CardReadResult;
    darkMode: boolean;
}

export function CardSummary({ result, darkMode }: CardSummaryProps) {
    const styles = darkMode ? darkThemeStyles : lightThemeStyles;

    return (
        <View style={styles.body}>
            <CardBrandImage type={result.card.type} />
            <Text style={styles.cardNumber}>{result.card.number}</Text>
            <SummaryRow
                label="卡片餘額："
                value={`${result.balance} 元`}
                styles={styles}
            />
            {result.kuokuangPoints !== undefined && (
                <SummaryRow
                    label="國光點數："
                    value={`${result.kuokuangPoints} 點`}
                    styles={styles}
                />
            )}
            {result.tpass?.purchaseDate && (
                <>
                    <Text style={styles.tpass}>基北北桃通勤月票</Text>
                    <SummaryRow
                        label="購買日期："
                        value={
                            result.tpass.purchaseDate
                                ? getDateString(result.tpass.purchaseDate)
                                : '未購買'
                        }
                        styles={styles}
                    />
                    <SummaryRow
                        label="到期日期："
                        value={
                            result.tpass.expiryDate
                                ? getDateString(result.tpass.expiryDate)
                                : '未啟用'
                        }
                        styles={styles}
                    />
                </>
            )}
            <WarningList
                warnings={result.warnings}
                warningStyle={styles.warning}
            />
        </View>
    );
}

function CardBrandImage({ type }: { type: CardType }) {
    return (
        <Image
            source={
                type === CardType.I_PASS
                    ? require('../image/ipass.png')
                    : type === CardType.EASY_CARD
                    ? require('../image/easycard.png')
                    : type === CardType.HAPPY_CASH
                    ? require('../image/happycash.png')
                    : require('../image/unknown.png')
            }
        />
    );
}

function SummaryRow({
    label,
    value,
    styles,
}: {
    label: string;
    value: string;
    styles: typeof lightThemeStyles;
}) {
    return (
        <View style={styles.row}>
            <Text style={styles.rowKey}>{label}</Text>
            <Text style={styles.rowValue}>{value}</Text>
        </View>
    );
}

function WarningList({
    warnings,
    warningStyle,
}: {
    warnings: CardReadResult['warnings'];
    warningStyle: typeof lightThemeStyles.warning;
}) {
    return warnings.map((warning) => (
        <Text key={warning} style={warningStyle}>
            {warning}
        </Text>
    ));
}

const baseStyles = {
    body: {
        margin: 20,
        borderRadius: 10,
        paddingHorizontal: 30,
        paddingVertical: 50,
        shadowRadius: 2,
        elevation: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardNumber: {
        marginTop: 20,
        marginBottom: 5,
        fontSize: 26,
    },
    tpass: {
        marginTop: 20,
        marginBottom: 5,
        fontSize: 24,
    },
    row: {
        flexDirection: 'row' as const,
    },
    rowKey: {
        fontSize: 20,
        flex: 1,
    },
    rowValue: {
        fontSize: 20,
    },
    warning: {
        marginTop: 16,
        fontSize: 16,
        textAlign: 'center' as const,
    },
};

const lightThemeStyles = StyleSheet.create({
    body: {
        ...baseStyles.body,
        backgroundColor: '#FAFAFA',
        shadowColor: 'black',
    },
    cardNumber: {
        ...baseStyles.cardNumber,
        color: 'black',
    },
    tpass: {
        ...baseStyles.tpass,
        color: 'black',
    },
    row: baseStyles.row,
    rowKey: {
        ...baseStyles.rowKey,
        color: 'black',
    },
    rowValue: {
        ...baseStyles.rowValue,
        color: 'black',
    },
    warning: {
        ...baseStyles.warning,
        color: '#8A5B00',
    },
});

const darkThemeStyles = StyleSheet.create({
    body: {
        ...baseStyles.body,
        backgroundColor: '#303030',
        shadowColor: 'white',
    },
    cardNumber: {
        ...baseStyles.cardNumber,
        color: 'white',
    },
    tpass: {
        ...baseStyles.tpass,
        color: 'white',
    },
    row: baseStyles.row,
    rowKey: {
        ...baseStyles.rowKey,
        color: 'white',
    },
    rowValue: {
        ...baseStyles.rowValue,
        color: 'white',
    },
    warning: {
        ...baseStyles.warning,
        color: '#FFD27D',
    },
});
