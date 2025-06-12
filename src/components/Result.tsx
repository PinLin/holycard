import React from 'react';
import { Image, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { Card, CardType } from '../model/card.model';

interface ResultProps {
    card: Card;
    balance: number;
    kuoKuangPoints: number;
    isTpassPurchased: boolean;
    tpassPurchaseDate: string;
    tpassExpiryDate: string;
}

export const Result = (props: ResultProps) => {
    const colorScheme = useColorScheme() ?? 'light';
    const styles = colorScheme === 'light' ? lightThemeStyles : darkThemeStyles;

    return (
        <View style={styles.body}>
            <Image
                source={
                    props.card.type === CardType.I_PASS
                        ? require('../image/ipass.png')
                        : props.card.type === CardType.EASY_CARD
                        ? require('../image/easycard.png')
                        : props.card.type === CardType.HAPPY_CASH
                        ? require('../image/happycash.png')
                        : require('../image/unknown.png')
                }
            />
            <Text style={styles.cardNumber}>{props.card.number}</Text>
            <View style={styles.row}>
                <Text style={styles.rowKey}>卡片餘額：</Text>
                <Text style={styles.rowValue}>{props.balance} 元</Text>
            </View>
            {props.card.is_kuokuang_card && (
                <View style={styles.row}>
                    <Text style={styles.rowKey}>國光點數：</Text>
                    <Text style={styles.rowValue}>
                        {props.kuoKuangPoints} 點
                    </Text>
                </View>
            )}
            {props.isTpassPurchased && (
                <>
                    <Text style={styles.tpass}>基北北桃通勤月票</Text>
                    <View style={styles.row}>
                        <Text style={styles.rowKey}>購買日期：</Text>
                        <Text style={styles.rowValue}>
                            {props.tpassPurchaseDate}
                        </Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.rowKey}>到期日期：</Text>
                        <Text style={styles.rowValue}>
                            {props.tpassExpiryDate}
                        </Text>
                    </View>
                </>
            )}
        </View>
    );
};

const lightThemeStyles = StyleSheet.create({
    body: {
        margin: 20,
        backgroundColor: '#FAFAFA',
        borderRadius: 10,
        paddingHorizontal: 30,
        paddingVertical: 50,
        shadowColor: 'black',
        shadowRadius: 2,
        elevation: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardNumber: {
        color: 'black',
        marginTop: 20,
        marginBottom: 5,
        fontSize: 26,
    },
    tpass: {
        color: 'black',
        marginTop: 20,
        marginBottom: 5,
        fontSize: 24,
    },
    row: {
        flexDirection: 'row',
    },
    rowKey: {
        color: 'black',
        fontSize: 20,
        flex: 1,
    },
    rowValue: {
        color: 'black',
        fontSize: 20,
    },
});
const darkThemeStyles = StyleSheet.create({
    body: {
        margin: 20,
        backgroundColor: '#303030',
        borderRadius: 10,
        paddingHorizontal: 30,
        paddingVertical: 50,
        shadowColor: 'white',
        shadowRadius: 2,
        elevation: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardNumber: {
        color: 'white',
        marginTop: 20,
        marginBottom: 5,
        fontSize: 26,
    },
    tpass: {
        color: 'white',
        marginTop: 20,
        marginBottom: 5,
        fontSize: 24,
    },
    row: {
        flexDirection: 'row',
    },
    rowKey: {
        color: 'white',
        fontSize: 20,
        flex: 1,
    },
    rowValue: {
        color: 'white',
        fontSize: 20,
    },
});
