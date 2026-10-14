import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_SERVER_STORAGE_KEY = 'key-server-url';

export const KEY_SERVER_UID_PLACEHOLDER = '{uid}';

export function hasUidPlaceholder(url: string): boolean {
    return url.includes(KEY_SERVER_UID_PLACEHOLDER);
}

export function buildKeyUrl(serverUrl: string, uid: string): string {
    return serverUrl.split(KEY_SERVER_UID_PLACEHOLDER).join(uid);
}

/**
 * 回傳去掉結尾斜線、scheme 與主機轉小寫的網址，沒有 {uid} 時在結尾補上 /{uid}；
 * 不是 http(s) 網址或帶查詢字串時回傳 null。
 */
export function normalizeKeyServerUrl(input: string): string | null {
    const match = input
        .trim()
        .replace(/\/+$/, '')
        .match(/^(https?:\/\/[^\s/?#]+)(\/[^\s?#]*)?$/i);
    if (!match) {
        return null;
    }
    const url = match[1].toLowerCase() + (match[2] ?? '');
    return hasUidPlaceholder(url)
        ? url
        : `${url}/${KEY_SERVER_UID_PLACEHOLDER}`;
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
