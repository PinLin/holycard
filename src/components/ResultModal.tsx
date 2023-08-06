import React from 'react';
import { Image, Modal, Text, useColorScheme, View } from 'react-native';
import { CardType } from '../model/card.model';

interface ResultModalProps {
    cardType: CardType;
    cardName: string;
    cardBalance: number;
    isKuoKuangCard: boolean;
    cardKuoKuangPoints: number;
    isTPassPurchased: boolean;
    tPassPurchaseDate: string;
    tPassExpiryDate: string;
    onRequestClose: () => void;
}

export const ResultModal = (props: ResultModalProps) => {
    const isDarkMode = useColorScheme() === 'dark';

    return (
        <Modal
            animationType="slide"
            transparent={true}
            onRequestClose={props.onRequestClose}
        >
            <View
                style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                <View
                    style={{
                        margin: 20,
                        backgroundColor: isDarkMode ? '#303030' : '#FAFAFA',
                        borderRadius: 10,
                        paddingHorizontal: 30,
                        paddingVertical: 50,
                        shadowColor: isDarkMode ? 'white' : 'black',
                        shadowRadius: 2,
                        elevation: 5,
                    }}
                >
                    <Image
                        source={
                            props.cardType == CardType.I_PASS
                                ? require('../image/ipass.png')
                                : props.cardType == CardType.EASY_CARD
                                ? require('../image/easycard.png')
                                : props.cardType == CardType.HAPPY_CASH
                                ? require('../image/happycash.png')
                                : require('../image/unknown.png')
                        }
                    />
                    <Text
                        style={{
                            marginTop: 20,
                            textAlign: 'center',
                            fontSize: 26,
                            fontWeight: '400',
                            color: isDarkMode ? 'white' : 'black',
                        }}
                    >
                        {props.cardName}
                    </Text>
                    <View
                        style={{
                            marginTop: 20,
                            justifyContent: 'center',
                            alignItems: 'flex-start',
                        }}
                    >
                        <View
                            style={{
                                flexDirection: 'row',
                            }}
                        >
                            <Text
                                style={{
                                    flex: 1,
                                    fontSize: 20,
                                    fontWeight: '400',
                                    color: isDarkMode ? 'white' : 'black',
                                }}
                            >
                                卡片餘額：
                            </Text>
                            <Text
                                style={{
                                    fontSize: 20,
                                    fontWeight: '400',
                                    color: isDarkMode ? 'white' : 'black',
                                }}
                            >
                                {props.cardBalance} 元
                            </Text>
                        </View>
                        {props.isKuoKuangCard && (
                            <View
                                style={{
                                    flexDirection: 'row',
                                }}
                            >
                                <Text
                                    style={{
                                        flex: 1,
                                        fontSize: 20,
                                        fontWeight: '400',
                                        color: isDarkMode ? 'white' : 'black',
                                    }}
                                >
                                    國光點數：
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 20,
                                        fontWeight: '400',
                                        color: isDarkMode ? 'white' : 'black',
                                    }}
                                >
                                    {props.cardKuoKuangPoints} 點
                                </Text>
                            </View>
                        )}
                        {props.isTPassPurchased && (
                            <View
                                style={{
                                    width: '100%',
                                }}
                            >
                                <Text
                                    style={{
                                        marginTop: 20,
                                        textAlign: 'center',
                                        fontSize: 24,
                                        fontWeight: '400',
                                        color: isDarkMode ? 'white' : 'black',
                                    }}
                                >
                                    基北北桃通勤月票
                                </Text>
                                <View
                                    style={{
                                        marginTop: 5,
                                        flexDirection: 'row',
                                    }}
                                >
                                    <Text
                                        style={{
                                            flex: 1,
                                            fontSize: 20,
                                            fontWeight: '400',
                                            color: isDarkMode
                                                ? 'white'
                                                : 'black',
                                        }}
                                    >
                                        購買日期：
                                    </Text>
                                    <Text
                                        style={{
                                            fontSize: 20,
                                            fontWeight: '400',
                                            color: isDarkMode
                                                ? 'white'
                                                : 'black',
                                        }}
                                    >
                                        {props.tPassPurchaseDate}
                                    </Text>
                                </View>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                    }}
                                >
                                    <Text
                                        style={{
                                            flex: 1,
                                            fontSize: 20,
                                            fontWeight: '400',
                                            color: isDarkMode
                                                ? 'white'
                                                : 'black',
                                        }}
                                    >
                                        到期日期：
                                    </Text>
                                    <Text
                                        style={{
                                            fontSize: 20,
                                            fontWeight: '400',
                                            color: isDarkMode
                                                ? 'white'
                                                : 'black',
                                        }}
                                    >
                                        {props.tPassExpiryDate}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};
