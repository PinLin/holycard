import AsyncStorage from '@react-native-async-storage/async-storage';
import { CardReadResult } from '../types';

const HISTORY_STORAGE_KEY = 'card-read-history';

function deserializeHistoryEntry(entry: CardReadResult): CardReadResult {
    return {
        ...entry,
        readAt: entry.readAt ? new Date(entry.readAt) : undefined,
        tpass: entry.tpass
            ? {
                  purchaseDate: entry.tpass.purchaseDate
                      ? new Date(entry.tpass.purchaseDate)
                      : null,
                  expiryDate: entry.tpass.expiryDate
                      ? new Date(entry.tpass.expiryDate)
                      : null,
              }
            : undefined,
    };
}

export async function loadHistory(): Promise<CardReadResult[]> {
    const serializedHistory = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
    if (!serializedHistory) {
        return [];
    }

    const history = JSON.parse(serializedHistory) as CardReadResult[];

    return history.map(deserializeHistoryEntry);
}

export async function saveHistoryEntry(entry: CardReadResult) {
    const history = await loadHistory();
    const nextHistory = [
        entry,
        ...history.filter(
            (historyEntry) => historyEntry.card.uid !== entry.card.uid,
        ),
    ];

    return AsyncStorage.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify(nextHistory),
    );
}

export async function deleteHistoryEntry(cardUid: string) {
    const history = await loadHistory();
    const nextHistory = history.filter(
        (historyEntry) => historyEntry.card.uid !== cardUid,
    );

    return AsyncStorage.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify(nextHistory),
    );
}
