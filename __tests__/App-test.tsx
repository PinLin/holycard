/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../src/App';

jest.mock('../src/hooks/useCardReader', () => ({
    useCardReader: () => ({
        status: 'ready',
        result: null,
        error: null,
        startScanning: jest.fn(() => Promise.resolve()),
        acknowledgeError: jest.fn(),
        dismissResult: jest.fn(),
    }),
}));

jest.mock('../src/services/historyStorage', () => ({
    loadHistory: jest.fn(() => new Promise(() => {})),
}));

test('renders correctly', async () => {
    await ReactTestRenderer.act(() => {
        ReactTestRenderer.create(<App />);
    });
});
