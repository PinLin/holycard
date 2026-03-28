import { getDateString } from '../src/utils';

test('formats dates as yyyy/mm/dd', () => {
    expect(getDateString(new Date(2026, 2, 27))).toBe('2026/03/27');
});
