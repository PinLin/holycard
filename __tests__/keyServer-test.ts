import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { KeyServerNotSetError } from '../src/error/keyServerNotSetError';
import { getCard } from '../src/services/cardService';
import {
    buildKeyUrl,
    hasUidPlaceholder,
    loadKeyServerUrl,
    normalizeKeyServerUrl,
    saveKeyServerUrl,
} from '../src/services/settingsStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

jest.mock('react-native-keychain', () => ({
    getGenericPassword: jest.fn(),
    setGenericPassword: jest.fn(),
    ACCESSIBLE: { AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK' },
}));

const mockedGetItem = AsyncStorage.getItem as jest.Mock;
const mockedGetPassword = Keychain.getGenericPassword as jest.Mock;
const mockedSetPassword = Keychain.setGenericPassword as jest.Mock;
const card = {
    uid: 'ABCD1234',
    type: 1,
    number: '1',
    nickname: '',
    sectors: [],
};

beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(card),
    }) as any;
});

describe('normalizeKeyServerUrl', () => {
    test('trims spaces and trailing slashes', () => {
        expect(
            normalizeKeyServerUrl('  https://keys.example.com/api/{uid}/ '),
        ).toBe('https://keys.example.com/api/{uid}');
    });

    test('沒有 {uid} 時在結尾補上 /{uid}（含舊設定）', () => {
        expect(normalizeKeyServerUrl('https://card.example.com/card/')).toBe(
            'https://card.example.com/card/{uid}',
        );
        expect(normalizeKeyServerUrl('http://192.168.1.10:8080')).toBe(
            'http://192.168.1.10:8080/{uid}',
        );
    });

    test('rejects non-http(s) input', () => {
        expect(normalizeKeyServerUrl('keys.example.com')).toBeNull();
        expect(normalizeKeyServerUrl('ftp://keys.example.com')).toBeNull();
        expect(normalizeKeyServerUrl('')).toBeNull();
    });

    test('rejects query strings and fragments', () => {
        expect(normalizeKeyServerUrl('https://a.example.com/?x=1')).toBeNull();
        expect(normalizeKeyServerUrl('https://a.example.com#x')).toBeNull();
    });

    test('lowercases scheme and host but keeps the path', () => {
        expect(normalizeKeyServerUrl('HTTPS://Keys.Example.com/{uid}')).toBe(
            'https://keys.example.com/{uid}',
        );
        expect(normalizeKeyServerUrl('https://A.example.com/Keys/{uid}')).toBe(
            'https://a.example.com/Keys/{uid}',
        );
    });
});

describe('{uid} 佔位符', () => {
    test('網址有 {uid} 時替換成 UID，可放在路徑中間或帶副檔名', () => {
        expect(
            buildKeyUrl('https://nas.local/keys/{uid}.json', 'A13FD62C'),
        ).toBe('https://nas.local/keys/A13FD62C.json');
        expect(buildKeyUrl('https://h/{uid}/card/{uid}', '55E99122')).toBe(
            'https://h/55E99122/card/55E99122',
        );
    });

    test('只認小寫的 {uid}', () => {
        expect(hasUidPlaceholder('https://h/{uid}.json')).toBe(true);
        expect(hasUidPlaceholder('https://h/{UID}.json')).toBe(false);
        expect(hasUidPlaceholder('https://h/uid.json')).toBe(false);
    });

    test('正規化保留 {uid}，照樣去結尾斜線、主機轉小寫', () => {
        expect(
            normalizeKeyServerUrl(' HTTPS://NAS.Local/Keys/{uid}.json/ '),
        ).toBe('https://nas.local/Keys/{uid}.json');
        expect(normalizeKeyServerUrl('https://{uid}.keys.example.com')).toBe(
            'https://{uid}.keys.example.com',
        );
    });
});

describe('key server setting', () => {
    test('舊版存的網址（沒有 {uid}）讀出時補上 /{uid}', async () => {
        mockedGetItem.mockResolvedValueOnce('https://card.example.com/card');
        expect(await loadKeyServerUrl()).toBe(
            'https://card.example.com/card/{uid}',
        );
    });

    test('is null when nothing or garbage is stored', async () => {
        mockedGetItem.mockResolvedValueOnce(null);
        expect(await loadKeyServerUrl()).toBeNull();
        mockedGetItem.mockResolvedValueOnce('not a url');
        expect(await loadKeyServerUrl()).toBeNull();
    });

    test('is null when storage throws', async () => {
        mockedGetItem.mockRejectedValueOnce(new Error('boom'));
        expect(await loadKeyServerUrl()).toBeNull();
    });

    test('saving a server stores it', async () => {
        await saveKeyServerUrl('https://keys.example.com');
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
            'key-server-url',
            'https://keys.example.com',
        );
    });

    test('saving null clears the setting', async () => {
        await saveKeyServerUrl(null);
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('key-server-url');
        expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });
});

describe('getCard with key server', () => {
    test('throws KeyServerNotSetError without a server and never hits network or cache', async () => {
        mockedGetItem.mockResolvedValue(null);

        await expect(getCard('ABCD1234')).rejects.toBeInstanceOf(
            KeyServerNotSetError,
        );
        expect(globalThis.fetch).not.toHaveBeenCalled();
        expect(mockedGetPassword).not.toHaveBeenCalled();
    });

    test('configured server is queried and cached per server', async () => {
        mockedGetItem.mockResolvedValue('https://keys.example.com/{uid}');
        mockedGetPassword.mockResolvedValue(false);

        await getCard('ABCD1234');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            'https://keys.example.com/ABCD1234',
        );
        expect(mockedGetPassword).toHaveBeenCalledWith({
            service: 'card:https://keys.example.com/{uid}:ABCD1234',
        });
    });

    test('網址樣板的 {uid} 被替換後才送出請求', async () => {
        mockedGetItem.mockResolvedValue('https://nas.local/keys/{uid}.json');
        mockedGetPassword.mockResolvedValue(false);

        await getCard('ABCD1234');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            'https://nas.local/keys/ABCD1234.json',
        );
    });

    test('cached keys are returned and refreshed from the same server', async () => {
        mockedGetItem.mockResolvedValue('https://keys.example.com/{uid}');
        mockedGetPassword.mockResolvedValue({
            password: JSON.stringify({ ...card, nickname: 'cached' }),
        });

        const result = await getCard('ABCD1234');
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(result.nickname).toBe('cached');
        expect(globalThis.fetch).toHaveBeenCalledWith(
            'https://keys.example.com/ABCD1234',
        );
        expect(mockedSetPassword.mock.calls[0][2].service).toBe(
            'card:https://keys.example.com/{uid}:ABCD1234',
        );
    });
});
