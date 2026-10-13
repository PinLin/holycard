import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_SERVER_STORAGE_KEY = 'key-server-url';

/** 回傳去掉結尾斜線、scheme 與主機轉小寫的網址；不是 http(s) 網址或帶查詢字串時回傳 null。 */
export function normalizeKeyServerUrl(input: string): string | null {
    const match = input
        .trim()
        .replace(/\/+$/, '')
        .match(/^(https?:\/\/[^\s/?#]+)(\/[^\s?#]*)?$/i);
    if (!match) {
        return null;
    }
    return match[1].toLowerCase() + (match[2] ?? '');
}

/** 未設定或讀取失敗時回傳 null。 */
export async function loadKeyServerUrl(): Promise<string | null> {
    try {
        const stored = await AsyncStorage.getItem(KEY_SERVER_STORAGE_KEY);
        return stored ? normalizeKeyServerUrl(stored) : null;
    } catch {
        return null;
    }
}

/** 傳入 null 會清除設定。 */
export async function saveKeyServerUrl(url: string | null): Promise<void> {
    if (url === null) {
        await AsyncStorage.removeItem(KEY_SERVER_STORAGE_KEY);
        return;
    }
    await AsyncStorage.setItem(KEY_SERVER_STORAGE_KEY, url);
}
