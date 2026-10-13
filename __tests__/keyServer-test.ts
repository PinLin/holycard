import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { KeyServerNotSetError } from '../src/error/keyServerNotSetError';
import { getCard } from '../src/services/cardService';
import {
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
        expect(normalizeKeyServerUrl('  https://keys.example.com/api/ ')).toBe(
            'https://keys.example.com/api',
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
        expect(normalizeKeyServerUrl('HTTPS://Keys.Example.com/')).toBe(
            'https://keys.example.com',
        );
        expect(normalizeKeyServerUrl('https://A.example.com/Keys')).toBe(
            'https://a.example.com/Keys',
        );
    });
});

describe('key server setting', () => {
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
        mockedGetItem.mockResolvedValue('https://keys.example.com');
        mockedGetPassword.mockResolvedValue(false);

        await getCard('ABCD1234');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            'https://keys.example.com/ABCD1234',
        );
        expect(mockedGetPassword).toHaveBeenCalledWith({
            service: 'card:https://keys.example.com:ABCD1234',
        });
    });

    test('cached keys are returned and refreshed from the same server', async () => {
        mockedGetItem.mockResolvedValue('https://keys.example.com');
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
            'card:https://keys.example.com:ABCD1234',
        );
    });
});
