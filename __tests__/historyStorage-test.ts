import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    deleteHistoryEntry,
    loadHistory,
    saveHistoryEntry,
} from '../src/services/historyStorage';
import { CardReadResult, CardType } from '../src/types';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
}));

const sampleEntry = (overrides?: Partial<CardReadResult>): CardReadResult => ({
    card: {
        uid: 'uid-1',
        type: CardType.EASY_CARD,
        number: '1234567890',
        nickname: '測試卡',
        is_kuokuang_card: false,
        sectors: [],
    },
    balance: 100,
    warnings: [],
    tpass: {
        purchaseDate: new Date('2026-03-29T00:00:00.000Z'),
        expiryDate: new Date('2026-04-29T00:00:00.000Z'),
    },
    readAt: new Date('2026-03-29T12:00:00.000Z'),
    ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
});

test('returns empty history when nothing is stored', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);

    await expect(loadHistory()).resolves.toEqual([]);
});

test('deserializes stored dates when loading history', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify([sampleEntry()]),
    );

    const history = await loadHistory();

    expect(history).toHaveLength(1);
    expect(history[0].readAt).toBeInstanceOf(Date);
    expect(history[0].tpass?.purchaseDate).toBeInstanceOf(Date);
    expect(history[0].tpass?.expiryDate).toBeInstanceOf(Date);
});

test('overwrites older entry for the same card uid', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify([
            sampleEntry({
                balance: 50,
                readAt: new Date('2026-03-28T12:00:00.000Z'),
            }),
        ]),
    );
    jest.mocked(AsyncStorage.setItem).mockResolvedValue();

    await saveHistoryEntry(
        sampleEntry({
            balance: 80,
            readAt: new Date('2026-03-29T12:00:00.000Z'),
        }),
    );

    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(jest.mocked(AsyncStorage.setItem).mock.calls[0][1]).toContain(
        '"balance":80',
    );
    expect(jest.mocked(AsyncStorage.setItem).mock.calls[0][1]).not.toContain(
        '"balance":50',
    );
});

test('(a) infers serverKeysUsed false for a confidently keyless applet read', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify([sampleEntry()]),
    );

    const history = await loadHistory();

    expect(history[0].serverKeysUsed).toBe(false);
});

test('(b) infers serverKeysUsed true for an ambiguous entry (has kuokuangPoints)', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify([sampleEntry({ kuokuangPoints: 10 })]),
    );

    const history = await loadHistory();

    expect(history[0].serverKeysUsed).toBe(true);
});

test('(b) infers serverKeysUsed true for an ambiguous entry (non-empty sectors)', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify([
            sampleEntry({
                card: {
                    ...sampleEntry().card,
                    sectors: [{ index: 2, keyA: 'AA', keyB: null }],
                },
            }),
        ]),
    );

    const history = await loadHistory();

    expect(history[0].serverKeysUsed).toBe(true);
});

test('(b) infers serverKeysUsed true for an ambiguous entry (missing-key warning)', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify([
            sampleEntry({ warnings: ['缺少讀取國光點數的金鑰'] }),
        ]),
    );

    const history = await loadHistory();

    expect(history[0].serverKeysUsed).toBe(true);
});

test('(c) keeps an existing serverKeysUsed value as-is instead of re-inferring', async () => {
    // Stored `false` must win despite the entry's fields (kuokuangPoints)
    // making the inference branch return true.
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify([
            { ...sampleEntry({ kuokuangPoints: 10 }), serverKeysUsed: false },
        ]),
    );

    const history = await loadHistory();

    expect(history[0].serverKeysUsed).toBe(false);
});

test('(d) migrates a legacy non-empty keyedFields array to serverKeysUsed true', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify([{ ...sampleEntry(), keyedFields: ['balance'] }]),
    );

    const history = await loadHistory();

    expect(history[0].serverKeysUsed).toBe(true);
});

test('(d) migrates a legacy empty keyedFields array to serverKeysUsed false', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify([
            { ...sampleEntry({ kuokuangPoints: 10 }), keyedFields: [] },
        ]),
    );

    const history = await loadHistory();

    expect(history[0].serverKeysUsed).toBe(false);
});

test('removes entry by card uid', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify([
            sampleEntry(),
            sampleEntry({
                card: {
                    ...sampleEntry().card,
                    uid: 'uid-2',
                    number: '9999999999',
                },
            }),
        ]),
    );
    jest.mocked(AsyncStorage.setItem).mockResolvedValue();

    await deleteHistoryEntry('uid-1');

    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(jest.mocked(AsyncStorage.setItem).mock.calls[0][1]).not.toContain(
        '1234567890',
    );
    expect(jest.mocked(AsyncStorage.setItem).mock.calls[0][1]).toContain(
        '9999999999',
    );
});
