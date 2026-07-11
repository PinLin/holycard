import AsyncStorage from '@react-native-async-storage/async-storage';
import { CardReadResult, CardType } from '../types';

const HISTORY_STORAGE_KEY = 'card-read-history';

const KEY_MISSING_WARNINGS = [
    '缺少讀取國光點數的金鑰',
    '缺少讀取通勤月票資訊的金鑰',
];

/**
 * History entries written before `serverKeysUsed` existed don't record whether
 * the read used a server-provided key. Entries that already carry the boolean
 * migrate directly from it; older entries with the interim `keyedFields` array
 * count as server-keyed when non-empty; the oldest entries are inferred, with
 * every ambiguous case treated as "used server key" per product decision.
 */
function migrateServerKeysUsed(entry: any): boolean {
    if (typeof entry.serverKeysUsed === 'boolean') {
        return entry.serverKeysUsed;
    }
    // 舊紀錄可能帶 keyedFields(前一版)：非空即用了金鑰。
    if (Array.isArray(entry.keyedFields)) {
        return entry.keyedFields.length > 0;
    }
    // 最舊：反推。明確的免金鑰 applet 讀取 → false；灰色地帶 → true。
    const confidentKeylessApplet =
        entry.card?.type === CardType.EASY_CARD &&
        entry.kuokuangPoints === undefined &&
        !(entry.warnings ?? []).some((w: string) =>
            KEY_MISSING_WARNINGS.includes(w),
        ) &&
        (entry.card?.sectors?.length ?? 0) === 0;
    return !confidentKeylessApplet;
}

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
        serverKeysUsed: migrateServerKeysUsed(entry),
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
