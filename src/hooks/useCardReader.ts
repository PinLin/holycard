import { useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';
import { CardUnavailableError } from '../error/cardUnavailableError';
import { readCard } from '../services/cardReader';
import { saveHistoryEntry } from '../services/historyStorage';
import {
    CardScanHandle,
    initializeNfc,
    startCardScanning,
} from '../services/nfcService';
import { CardReadResult, CardReaderStatus } from '../types';

export function useCardReader() {
    const [status, setStatus] = useState<CardReaderStatus>('ready');
    const [result, setResult] = useState<CardReadResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const scanRef = useRef<CardScanHandle | null>(null);

    async function startScanning() {
        await initializeNfc();
        if (scanRef.current) {
            // Reader mode stays registered across taps; don't start a second one.
            return;
        }

        scanRef.current = startCardScanning<CardReadResult>(readCard, {
            onReady: () => setStatus('ready'),
            onReading: () => {
                // Reader mode suppresses the system's tag-detected haptic, so
                // give our own on-tap feedback. Vibration only controls duration
                // (no amplitude), so this can't match the system's heavier NFC
                // haptic — a haptic-feedback lib would be needed for that.
                Vibration.vibrate(200);
                setStatus('reading');
                setResult(null);
                setError(null);
            },
            onResult: (raw) => {
                const nextHistoryEntry: CardReadResult = {
                    ...raw,
                    readAt: new Date(),
                };
                setResult(nextHistoryEntry);
                setError(null);
                setStatus('ready');
                saveHistoryEntry(nextHistoryEntry).catch(() => {});
            },
            onError: (err) => {
                setStatus('ready');
                setResult(null);
                if (err instanceof CardUnavailableError) {
                    setError('找不到這張卡片的資訊，無法讀取');
                } else {
                    setError('讀取卡片失敗，請再試一次');
                }
            },
        });
    }

    useEffect(() => {
        return () => {
            scanRef.current?.stop();
            scanRef.current = null;
        };
    }, []);

    function dismissResult() {
        setStatus('ready');
        setResult(null);
        setError(null);
    }

    function acknowledgeError() {
        setError(null);
    }

    return {
        status,
        result,
        error,
        startScanning,
        acknowledgeError,
        dismissResult,
    };
}
