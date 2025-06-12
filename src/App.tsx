/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * Generated with the TypeScript template
 * https://github.com/react-native-community/react-native-template-typescript
 *
 * @format
 */

import React, { useState } from 'react';
import {
    Modal,
    StatusBar,
    StyleSheet,
    Text,
    ToastAndroid,
    useColorScheme,
    View,
} from 'react-native';
import { Card, CardType } from './model/card.model';
import { NfcService } from './service/nfc.service';
import { Result } from './components/Result';
import { getDateString } from './utils';
import { MissingNecessaryKeysException } from './exception/missing-necessary-keys.exception';
import { InvalidKeysException } from './exception/invalid-keys.exception';

const nfcService = new NfcService();

function App(): React.JSX.Element {
    const colorScheme = useColorScheme() ?? 'light';
    const styles = colorScheme === 'light' ? lightThemeStyles : darkThemeStyles;

    const [isReady, setIsReady] = useState(false);
    const [isReadingCard, setIsReadingCard] = useState(false);
    const [isShowingResultModal, setIsShowingResultModal] = useState(false);
    const [currentCard, setCurrentCard] = useState<Card>({
        uid: '',
        type: CardType.UNKNOWN,
        number: '',
        nickname: '',
        is_kuokuang_card: false,
        sectors: [],
    });
    const [balance, setBalance] = useState(0);
    const [kuoKuangPoints, setKuoKuangPoints] = useState(0);
    const [isTpassPurchased, setIsTpassPurchased] = useState(false);
    const [tpassPurchaseDate, setTpassPurchaseDate] = useState('');
    const [tpassExpiryDate, setTpassExpiryDate] = useState('');

    async function readCard() {
        try {
            await nfcService.requestMifareClassic(async (uid: string) => {
                setIsReadingCard(true);

                const response = await fetch(
                    `https://card.pinlin.me/card/${uid}`,
                );
                if (!response.ok) {
                    ToastAndroid.show('查無卡片資料', ToastAndroid.SHORT);
                    setIsReady(false);
                    setIsReadingCard(false);
                    return;
                }
                const card: Card = await response.json();
                setCurrentCard(card);

                try {
                    setBalance(await nfcService.readBalance(card));
                } catch (err) {
                    let errorMessage = '發生未知的錯誤';
                    if (err instanceof MissingNecessaryKeysException) {
                        errorMessage = '缺少讀取餘額所需的金鑰 2A';
                    } else if (err instanceof InvalidKeysException) {
                        errorMessage = '讀取餘額所需的金鑰 2A 無效';
                    }
                    ToastAndroid.show(errorMessage, ToastAndroid.SHORT);
                    setIsReady(false);
                    setIsReadingCard(false);
                    return;
                }

                // 國光回數票悠遊卡
                if (card.is_kuokuang_card && card.type === CardType.EASY_CARD) {
                    try {
                        setKuoKuangPoints(
                            await nfcService.readKuoKuangPoints(card),
                        );
                    } catch (err) {
                        let errorMessage = '發生未知的錯誤';
                        if (err instanceof MissingNecessaryKeysException) {
                            errorMessage = '缺少讀取國光點數所需的金鑰 11A';
                        } else if (err instanceof InvalidKeysException) {
                            errorMessage = '讀取國光點數所需的金鑰 11A 無效';
                        }
                        ToastAndroid.show(errorMessage, ToastAndroid.SHORT);
                    }
                }

                // 查詢悠遊卡上的 TPASS 通勤月票資訊（不支援國光回數票悠遊卡）
                if (
                    card.type === CardType.EASY_CARD &&
                    !card.is_kuokuang_card
                ) {
                    try {
                        const { purchaseDate, expiryDate } =
                            await nfcService.readTpassInfo(card);
                        if (purchaseDate) {
                            setTpassPurchaseDate(getDateString(purchaseDate));
                            if (expiryDate) {
                                setTpassExpiryDate(getDateString(expiryDate));
                            } else {
                                setTpassExpiryDate('未啟用');
                            }
                            setIsTpassPurchased(true);
                        }
                    } catch (err) {
                        let errorMessage = '發生未知的錯誤';
                        if (err instanceof MissingNecessaryKeysException) {
                            errorMessage =
                                '缺少讀取通勤月票資訊所需的金鑰 3A 或 8A';
                        } else if (err instanceof InvalidKeysException) {
                            errorMessage =
                                '讀取通勤月票資訊所需的金鑰 3A 或 8A 無效';
                        }
                        ToastAndroid.show(errorMessage, ToastAndroid.SHORT);
                    }
                }

                setIsShowingResultModal(true);
            });
        } catch (err) {
            ToastAndroid.show(`${err}`, ToastAndroid.SHORT);

            setIsReady(false);
            setIsReadingCard(false);
        }
    }

    if (!isReady) {
        setIsReady(true);
        readCard();
    }

    return (
        <>
            <StatusBar
                barStyle={
                    colorScheme === 'light' ? 'dark-content' : 'light-content'
                }
                backgroundColor={colorScheme === 'light' ? 'white' : 'black'}
            />
            <View style={styles.body}>
                <Text style={styles.appName}>HolyCard</Text>
                <View style={styles.centerView}>
                    <Text style={styles.centerText}>
                        {isReadingCard ? '正在讀取...' : '請感應卡片'}
                    </Text>
                </View>
            </View>
            {isShowingResultModal && (
                <Modal
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => {
                        setIsReady(false);
                        setIsReadingCard(false);
                        setIsShowingResultModal(false);
                        setIsTpassPurchased(false);
                    }}
                >
                    <View style={styles.resultModal}>
                        <Result
                            card={currentCard}
                            balance={balance}
                            kuoKuangPoints={kuoKuangPoints}
                            isTpassPurchased={isTpassPurchased}
                            tpassPurchaseDate={tpassPurchaseDate}
                            tpassExpiryDate={tpassExpiryDate}
                        />
                    </View>
                </Modal>
            )}
        </>
    );
}

const lightThemeStyles = StyleSheet.create({
    body: {
        flex: 1,
        paddingTop: 32,
        paddingHorizontal: 24,
        backgroundColor: 'white',
    },
    appName: {
        fontSize: 24,
        fontWeight: '600',
        color: 'black',
    },
    centerView: {
        flex: 1,
        justifyContent: 'center',
    },
    centerText: {
        textAlign: 'center',
        fontSize: 24,
        fontWeight: '400',
        color: 'black',
    },
    resultModal: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
const darkThemeStyles = StyleSheet.create({
    body: {
        flex: 1,
        paddingTop: 32,
        paddingHorizontal: 24,
        backgroundColor: 'black',
    },
    appName: {
        fontSize: 24,
        fontWeight: '600',
        color: 'white',
    },
    centerView: {
        flex: 1,
        justifyContent: 'center',
    },
    centerText: {
        textAlign: 'center',
        fontSize: 24,
        fontWeight: '400',
        color: 'white',
    },
    resultModal: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default App;
