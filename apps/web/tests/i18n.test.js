const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');

function flattenKeys(value, prefix = '') {
    return Object.entries(value).flatMap(([key, child]) => {
        const childKey = prefix ? `${prefix}.${key}` : key;
        return typeof child === 'string' ? [childKey] : flattenKeys(child, childKey);
    });
}

test('English, Korean, and Japanese translations expose the same keys', async () => {
    const [{ default: en }, { default: ko }, { default: ja }] = await Promise.all([
        import('../src/i18n/locales/en.mjs'),
        import('../src/i18n/locales/ko.mjs'),
        import('../src/i18n/locales/ja.mjs')
    ]);
    const englishKeys = flattenKeys(en).sort();

    assert.deepEqual(flattenKeys(ko).sort(), englishKeys);
    assert.deepEqual(flattenKeys(ja).sort(), englishKeys);
});

test('every translation key referenced by the HTML exists', async () => {
    const [{ default: en }, html] = await Promise.all([
        import('../src/i18n/locales/en.mjs'),
        fs.readFile(path.resolve(__dirname, '../public/index.html'), 'utf8')
    ]);
    const availableKeys = new Set(flattenKeys(en));
    const referencedKeys = Array.from(
        html.matchAll(/data-i18n(?:-aria-label|-title)?="([^"]+)"/g),
        (match) => match[1]
    );

    assert.ok(referencedKeys.length > 0);
    for (const key of referencedKeys) {
        assert.ok(availableKeys.has(key), `Missing translation key: ${key}`);
    }
});

test('the i18n module switches locales and interpolates values', async () => {
    const { getLocale, setLocale, t } = await import('../src/i18n/index.mjs');

    assert.equal(setLocale('ko-KR'), true);
    assert.equal(getLocale(), 'ko');
    assert.equal(t('status.generated', { count: 3 }), '블록 3개를 생성했습니다.');

    assert.equal(setLocale('ja-JP'), true);
    assert.equal(getLocale(), 'ja');
    assert.equal(t('status.generated', { count: 3 }), '3個のブロックを生成しました。');

    assert.equal(setLocale('unsupported'), false);
    assert.equal(getLocale(), 'ja');
});
