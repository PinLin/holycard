import { useState } from 'react';
import { CardUnavailableError } from '../error/cardUnavailableError';
import { FailedToReadCardError } from '../error/failedToReadCardError';
import { MissingNecessaryKeysError } from '../error/missingNecessaryKeysError';
import { getCard } from '../services/cardService';
import {
    initializeNfc,
    readBalance,
    readKuokuangPoints,
    readTpassInfo,
    requestMifareClassic,
} from '../services/nfcService';
import {
    CardReadResult,
    CardType,
    TpassInfo,
    CardReaderStatus,
} from '../types';

export function useCardReader() {
    const [status, setStatus] = useState<CardReaderStatus>('ready');
    const [result, setResult] = useState<CardReadResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function startScanning() {
        await initializeNfc();
        setStatus('ready');
        setResult(null);
        setError(null);

        try {
            const nextResult = await requestMifareClassic(async (uid) => {
                setStatus('reading');
                setError(null);

                const card = await getCard(uid);
                const balance = await readBalance(card);

                const warnings: string[] = [];

                let kuokuangPoints: number | undefined;
                if (card.is_kuokuang_card) {
                    try {
                        kuokuangPoints = await readKuokuangPoints(card);
                    } catch (err) {
                        if (err instanceof MissingNecessaryKeysError) {
                            warnings.push('缺少讀取國光點數的金鑰');
                        } else {
                            throw err;
                        }
                    }
                }

                let tpass: TpassInfo | undefined;
                if (
                    !card.is_kuokuang_card &&
                    card.type === CardType.EASY_CARD
                ) {
                    try {
                        tpass = await readTpassInfo(card);
                    } catch (err) {
                        if (err instanceof MissingNecessaryKeysError) {
                            warnings.push('缺少讀取通勤月票資訊的金鑰');
                        } else {
                            throw err;
                        }
                    }
                }

                return {
                    card,
                    balance,
                    kuokuangPoints,
                    tpass,
                    warnings,
                };
            });

            setStatus('success');
            setResult(nextResult);
            setError(null);
        } catch (err) {
            setStatus('ready');
            setResult(null);
            if (err instanceof CardUnavailableError) {
                setError('找不到這張卡片的資訊，無法讀取');
            } else {
                setError('讀取卡片失敗，請再試一次');
            }
        }
    }

    async function retryScanning() {
        await startScanning();
    }

    async function dismissResult() {
        setStatus('ready');
        setResult(null);
        setError(null);
        await startScanning();
    }

    async function acknowledgeError() {
        setError(null);
        await startScanning();
    }

    return {
        status,
        result,
        error,
        startScanning,
        retryScanning,
        acknowledgeError,
        dismissResult,
    };
}
