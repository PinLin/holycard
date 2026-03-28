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
        retryScanning: jest.fn(),
        acknowledgeError: jest.fn(),
        dismissResult: jest.fn(),
    }),
}));

test('renders correctly', async () => {
    await ReactTestRenderer.act(() => {
        ReactTestRenderer.create(<App />);
    });
});
