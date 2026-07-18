const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('../../../modules/blockRenderer/node_modules/playwright-core');

const { startServer } = require('../src/server');

const EDGE_PATH = process.env.PLAYWRIGHT_EDGE_PATH ??
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

test('runs the web generation flow and renders a nonblank Three.js canvas', {
    skip: fs.existsSync(EDGE_PATH) ? false : `Edge executable not found: ${EDGE_PATH}`
}, async (t) => {
    const { server, port } = await startServer(5193);
    t.after(() => server.close());

    const browser = await chromium.launch({
        executablePath: EDGE_PATH,
        headless: true
    });
    t.after(() => browser.close());

    const page = await browser.newPage({
        locale: 'en-US',
        viewport: { width: 1280, height: 920 }
    });
    const fontClient = await page.context().newCDPSession(page);
    await fontClient.send('DOM.enable');
    await fontClient.send('CSS.enable');

    const readPlatformFonts = async (selector) => {
        const { root } = await fontClient.send('DOM.getDocument');
        const { nodeId } = await fontClient.send('DOM.querySelector', {
            nodeId: root.nodeId,
            selector
        });
        const { fonts } = await fontClient.send('CSS.getPlatformFontsForNode', {
            nodeId
        });

        return fonts.map((font) => ({
            familyName: font.familyName,
            postScriptName: font.postScriptName
        }));
    };
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });

    const readLayoutState = async () => page.evaluate(() => {
        const canvasRect = document.querySelector('.canvas-wrap').getBoundingClientRect();
        const toolbar = document.querySelector('#utilityToolbar');
        const toolbarRect = toolbar.getBoundingClientRect();
        const scrollElement = document.scrollingElement;

        return {
            pageScrollsVertically: scrollElement.scrollHeight > scrollElement.clientHeight,
            settingsOverflowY: getComputedStyle(
                document.querySelector('.settings-scroll')
            ).overflowY,
            panelAriaHidden: document.querySelector('#settingsPanel')
                .getAttribute('aria-hidden'),
            toggleExpanded: document.querySelector('#settingsToggleButton')
                .getAttribute('aria-expanded'),
            toggleLabel: document.querySelector('#settingsToggleButton')
                .getAttribute('aria-label'),
            canvasInsideViewport: canvasRect.left >= 0 &&
                canvasRect.top >= 0 &&
                canvasRect.right <= window.innerWidth + 1 &&
                canvasRect.bottom <= window.innerHeight + 1,
            toolbarInsideViewport: toolbarRect.left >= 0 &&
                toolbarRect.top >= 0 &&
                toolbarRect.right <= window.innerWidth + 1 &&
                toolbarRect.bottom <= window.innerHeight + 1,
            toolbarDoesNotOverlapCanvas: toolbarRect.left >= canvasRect.right ||
                toolbarRect.right <= canvasRect.left ||
                toolbarRect.top >= canvasRect.bottom ||
                toolbarRect.bottom <= canvasRect.top,
            toolbarDirection: getComputedStyle(toolbar).flexDirection,
            canvasWidth: canvasRect.width,
            canvasHeight: canvasRect.height
        };
    });

    let layoutState = await readLayoutState();
    assert.equal(layoutState.pageScrollsVertically, false);
    assert.equal(layoutState.settingsOverflowY, 'auto');
    assert.equal(layoutState.panelAriaHidden, 'false');
    assert.equal(layoutState.toggleExpanded, 'true');
    assert.equal(layoutState.toggleLabel, 'Hide settings');
    assert.equal(layoutState.canvasInsideViewport, true);
    assert.equal(layoutState.toolbarInsideViewport, true);
    assert.equal(layoutState.toolbarDoesNotOverlapCanvas, true);
    assert.equal(layoutState.toolbarDirection, 'column');
    assert.equal(layoutState.canvasWidth, layoutState.canvasHeight);

    let languageState = await page.evaluate(() => {
        const switcher = document.querySelector('#languageSwitcher');
        const toolbar = document.querySelector('#utilityToolbar');
        const toolbarRect = toolbar.getBoundingClientRect();
        const menu = document.querySelector('#languageMenu');
        const menuButton = document.querySelector('#languageMenuButton');

        return {
            locale: document.documentElement.lang,
            toolbarPosition: getComputedStyle(toolbar).position,
            switcherPosition: getComputedStyle(switcher).position,
            toolbarRightGap: window.innerWidth - toolbarRect.right,
            toolbarBottomGap: window.innerHeight - toolbarRect.bottom,
            toolbarControlIds: Array.from(toolbar.children, (element) => element.id),
            menuHidden: menu.hidden,
            menuRole: menu.getAttribute('role'),
            menuExpanded: menuButton.getAttribute('aria-expanded'),
            menuButtonText: menuButton.innerText.trim(),
            hasGlobeIcon: menuButton.querySelector('svg') !== null,
            optionRoles: Array.from(menu.querySelectorAll('[data-locale]'))
                .map((button) => button.getAttribute('role')),
            pressedLocales: Array.from(
                document.querySelectorAll('.language-button[aria-checked="true"]')
            ).map((button) => button.dataset.locale)
        };
    });
    assert.deepEqual(languageState, {
        locale: 'en',
        toolbarPosition: 'fixed',
        switcherPosition: 'relative',
        toolbarRightGap: 18,
        toolbarBottomGap: 18,
        toolbarControlIds: ['helpButton', 'githubLink', 'languageSwitcher'],
        menuHidden: true,
        menuRole: 'menu',
        menuExpanded: 'false',
        menuButtonText: '',
        hasGlobeIcon: true,
        optionRoles: ['menuitemradio', 'menuitemradio', 'menuitemradio'],
        pressedLocales: ['en']
    });

    await page.click('#languageMenuButton');
    assert.equal(await page.locator('#languageMenu').getAttribute('hidden'), null);
    assert.equal(
        await page.locator('#languageMenuButton').getAttribute('aria-expanded'),
        'true'
    );
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#languageMenu').getAttribute('hidden'), '');
    assert.equal(
        await page.evaluate(() => document.activeElement?.id),
        'languageMenuButton'
    );

    const githubState = await page.$eval('#githubLink', (link) => ({
        href: link.href,
        target: link.target,
        rel: link.rel,
        label: link.getAttribute('aria-label'),
        hasIcon: link.querySelector('.github-mark') !== null
    }));
    assert.deepEqual(githubState, {
        href: 'https://github.com/han031121/Block-Generator-Web',
        target: '_blank',
        rel: 'noopener noreferrer',
        label: 'Open GitHub repository in a new tab',
        hasIcon: true
    });

    await page.click('#helpButton');
    assert.equal(await page.$eval('#helpDialog', (dialog) => dialog.open), true);
    assert.equal(await page.textContent('#helpDialogTitle'), 'How to use');
    assert.equal(
        await page.locator('#helpCloseButton').getAttribute('aria-label'),
        'Close help'
    );
    await page.screenshot({
        path: path.join(os.tmpdir(), 'block-generator-web-help.png'),
        fullPage: true
    });
    await page.click('#helpCloseButton');
    assert.equal(await page.$eval('#helpDialog', (dialog) => dialog.open), false);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'helpButton');

    await page.click('#helpButton');
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('#helpDialog', (dialog) => dialog.open), false);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'helpButton');

    const selectLocale = async (locale) => {
        await page.click('#languageMenuButton');
        await page.click(`.language-button[data-locale="${locale}"]`);
        assert.equal(await page.locator('#languageMenu').getAttribute('hidden'), '');
        assert.equal(
            await page.locator('#languageMenuButton').getAttribute('aria-expanded'),
            'false'
        );
    };

    const initialFontState = await page.evaluate(() => ({
        fontSynthesis: getComputedStyle(document.documentElement).fontSynthesis,
        koreanButtonFont: getComputedStyle(
            document.querySelector('.language-button[lang="ko"]')
        ).fontFamily,
        japaneseButtonFont: getComputedStyle(
            document.querySelector('.language-button[lang="ja"]')
        ).fontFamily,
        languageButtonWeights: Array.from(
            document.querySelectorAll('.language-button'),
            (button) => getComputedStyle(button).fontWeight
        )
    }));
    assert.equal(initialFontState.fontSynthesis, 'none');
    assert.match(initialFontState.koreanButtonFont, /Pretendard Variable/);
    assert.match(initialFontState.japaneseButtonFont, /Pretendard JP Variable/);
    assert.deepEqual(initialFontState.languageButtonWeights, ['500', '500', '500']);

    const iconButtonState = await page.evaluate(() => {
        const panelRect = document.querySelector('#settingsPanel')
            .getBoundingClientRect();
        const toggleRect = document.querySelector('#settingsToggleButton')
            .getBoundingClientRect();
        const prevRect = document.querySelector('#prevButton').getBoundingClientRect();
        const nextRect = document.querySelector('#nextButton').getBoundingClientRect();

        return {
            toggleText: document.querySelector('#settingsToggleButton').innerText.trim(),
            prevText: document.querySelector('#prevButton').innerText.trim(),
            nextText: document.querySelector('#nextButton').innerText.trim(),
            toggleWidth: toggleRect.width,
            toggleHeight: toggleRect.height,
            toggleLeft: toggleRect.left,
            panelRight: panelRect.right,
            prevWidth: prevRect.width,
            prevHeight: prevRect.height,
            nextWidth: nextRect.width,
            nextHeight: nextRect.height
        };
    });
    assert.equal(iconButtonState.toggleText, '');
    assert.equal(iconButtonState.prevText, '');
    assert.equal(iconButtonState.nextText, '');
    assert.equal(iconButtonState.toggleWidth, 38);
    assert.equal(iconButtonState.toggleHeight, 64);
    assert.equal(iconButtonState.toggleLeft, iconButtonState.panelRight);
    assert.equal(iconButtonState.prevWidth, iconButtonState.prevHeight);
    assert.equal(iconButtonState.nextWidth, iconButtonState.nextHeight);

    let generatedContentState = await page.evaluate(() => ({
        downloadDisabled: document.querySelector('#downloadButton').disabled,
        renderingTabDisabled: document.querySelector('#renderingTab').disabled,
        renderingPanelDisabled: document.querySelector('#renderingPanel')
            .getAttribute('aria-disabled'),
        renderingControlsDisabled: document.querySelector('#renderingControls').disabled,
        backgroundColorDisabled: document.querySelector('#backgroundColor')
            .matches(':disabled'),
        resetRenderDisabled: document.querySelector('#resetRenderButton')
            .matches(':disabled')
    }));
    assert.deepEqual(generatedContentState, {
        downloadDisabled: true,
        renderingTabDisabled: false,
        renderingPanelDisabled: 'true',
        renderingControlsDisabled: true,
        backgroundColorDisabled: true,
        resetRenderDisabled: true
    });

    await page.locator('#generationTab').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(
        await page.locator('#renderingTab').getAttribute('aria-selected'),
        'true'
    );
    assert.equal(await page.locator('#renderingPanel').getAttribute('hidden'), null);
    await page.keyboard.press('ArrowLeft');
    assert.equal(
        await page.locator('#generationTab').getAttribute('aria-selected'),
        'true'
    );

    const initialRenderValues = await page.evaluate(() => ({
        cameraDistance: document.querySelector('#cameraDistance').value,
        cameraAzimuth: document.querySelector('#cameraAzimuthDeg').value,
        cameraElevation: document.querySelector('#cameraElevationDeg').value
    }));
    const initialCanvasBox = await page.locator('#renderCanvas').boundingBox();
    assert.ok(initialCanvasBox);
    await page.mouse.move(
        initialCanvasBox.x + initialCanvasBox.width / 2,
        initialCanvasBox.y + initialCanvasBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
        initialCanvasBox.x + initialCanvasBox.width / 2 + 40,
        initialCanvasBox.y + initialCanvasBox.height / 2 - 20
    );
    await page.mouse.up();
    await page.mouse.wheel(0, -100);
    assert.deepEqual(await page.evaluate(() => ({
        cameraDistance: document.querySelector('#cameraDistance').value,
        cameraAzimuth: document.querySelector('#cameraAzimuthDeg').value,
        cameraElevation: document.querySelector('#cameraElevationDeg').value
    })), initialRenderValues);

    await page.click('#startButton');
    await page.waitForFunction(
        () => !document.querySelector('#generationOverlay')?.hidden,
        null,
        { timeout: 5000 }
    );
    let generationUiState = await page.evaluate(() => ({
        statusText: document.querySelector('#status').textContent,
        statusState: document.querySelector('#status').dataset.state,
        statusBusy: document.querySelector('#status').getAttribute('aria-busy'),
        formBusy: document.querySelector('#generatorForm').getAttribute('aria-busy'),
        overlayHidden: document.querySelector('#generationOverlay').hidden,
        startDisabled: document.querySelector('#startButton').disabled,
        startText: document.querySelector('#startButton').textContent
    }));
    assert.deepEqual(generationUiState, {
        statusText: 'Generating blocks... Timeout after 10 seconds.',
        statusState: 'loading',
        statusBusy: 'true',
        formBusy: 'true',
        overlayHidden: false,
        startDisabled: true,
        startText: 'Generating...'
    });

    await page.waitForFunction(
        () => document.querySelector('#status')?.textContent.includes('Generated'),
        null,
        { timeout: 30000 }
    );
    generationUiState = await page.evaluate(() => ({
        statusState: document.querySelector('#status').dataset.state,
        statusBusy: document.querySelector('#status').getAttribute('aria-busy'),
        formBusy: document.querySelector('#generatorForm').getAttribute('aria-busy'),
        overlayHidden: document.querySelector('#generationOverlay').hidden,
        startDisabled: document.querySelector('#startButton').disabled,
        startText: document.querySelector('#startButton').textContent
    }));
    assert.deepEqual(generationUiState, {
        statusState: 'success',
        statusBusy: 'false',
        formBusy: 'false',
        overlayHidden: true,
        startDisabled: false,
        startText: 'Start'
    });

    let blockPositionText = await page.textContent('#blockPosition');
    assert.equal(blockPositionText, '1 / 300');

    generatedContentState = await page.evaluate(() => ({
        downloadDisabled: document.querySelector('#downloadButton').disabled,
        renderingTabDisabled: document.querySelector('#renderingTab').disabled,
        renderingPanelDisabled: document.querySelector('#renderingPanel')
            .getAttribute('aria-disabled'),
        renderingControlsDisabled: document.querySelector('#renderingControls').disabled,
        backgroundColorDisabled: document.querySelector('#backgroundColor')
            .matches(':disabled'),
        resetRenderDisabled: document.querySelector('#resetRenderButton')
            .matches(':disabled')
    }));
    assert.deepEqual(generatedContentState, {
        downloadDisabled: false,
        renderingTabDisabled: false,
        renderingPanelDisabled: 'false',
        renderingControlsDisabled: false,
        backgroundColorDisabled: false,
        resetRenderDisabled: false
    });

    const blockMetaState = await page.evaluate(() => {
        const identifyBlock = document.querySelector('#blockMeta .block-identify-code');
        const identifyCode = identifyBlock?.querySelector('code');
        const identifyStyle = identifyBlock ? getComputedStyle(identifyBlock) : null;
        const labels = Array.from(
            document.querySelectorAll('#blockMeta .block-meta-label')
        );
        const blockDataTitle = document.querySelector('.block-data-title');

        return {
            hasIdentifyBlock: identifyBlock !== null,
            hasIdentifyCode: identifyCode !== null,
            identifyTextLength: identifyCode?.textContent.length ?? 0,
            whiteSpace: identifyStyle?.whiteSpace ?? null,
            overflowWrap: identifyStyle?.overflowWrap ?? null,
            overflowX: identifyStyle?.overflowX ?? null,
            labelTexts: labels.map((label) => label.textContent),
            labelWeights: labels.map((label) => getComputedStyle(label).fontWeight),
            blockDataTitleText: blockDataTitle?.textContent ?? null,
            blockDataTitleWeight: blockDataTitle ?
                getComputedStyle(blockDataTitle).fontWeight :
                null
        };
    });
    assert.equal(blockMetaState.hasIdentifyBlock, true);
    assert.equal(blockMetaState.hasIdentifyCode, true);
    assert.ok(blockMetaState.identifyTextLength > 0);
    assert.equal(blockMetaState.whiteSpace, 'pre-wrap');
    assert.equal(blockMetaState.overflowWrap, 'anywhere');
    assert.equal(blockMetaState.overflowX, 'hidden');
    assert.deepEqual(blockMetaState.labelTexts, ['Index', 'Cubes', 'Size', 'ID']);
    assert.ok(blockMetaState.labelWeights.every((weight) => Number(weight) >= 700));
    assert.equal(blockMetaState.blockDataTitleText, 'Block data');
    assert.ok(Number(blockMetaState.blockDataTitleWeight) >= 700);

    const readTranslatedUiState = async () => page.evaluate(() => ({
        locale: document.documentElement.lang,
        title: document.title,
        generationTab: document.querySelector('#generationTab').textContent.trim(),
        generateCountLabel: document.querySelector(
            '[data-i18n="generation.generateCount"]'
        ).textContent,
        statusText: document.querySelector('#status').textContent,
        settingsLabel: document.querySelector('#settingsPanel').getAttribute('aria-label'),
        helpTitle: document.querySelector('#helpDialogTitle').textContent,
        helpButtonLabel: document.querySelector('#helpButton').getAttribute('aria-label'),
        githubLinkLabel: document.querySelector('#githubLink').getAttribute('aria-label'),
        metaLabels: Array.from(
            document.querySelectorAll('#blockMeta .block-meta-label')
        ).map((label) => label.textContent),
        pressedLocales: Array.from(
            document.querySelectorAll('.language-button[aria-checked="true"]')
        ).map((button) => button.dataset.locale)
    }));
    const readLocalizedFontState = async () => page.evaluate(() => {
        const rootStyle = getComputedStyle(document.documentElement);
        const brandStyle = getComputedStyle(document.querySelector('.brand'));
        const tabStyle = getComputedStyle(document.querySelector('.tab-button'));
        const groupTitleStyle = getComputedStyle(
            document.querySelector('.group-title')
        );
        const blockDataTitleStyle = getComputedStyle(
            document.querySelector('.block-data-title')
        );

        return {
            fontFamily: rootStyle.fontFamily,
            fontSynthesis: rootStyle.fontSynthesis,
            rootWeight: rootStyle.fontWeight,
            brandWeight: brandStyle.fontWeight,
            tabFontSize: tabStyle.fontSize,
            groupTitleFontSize: groupTitleStyle.fontSize,
            blockDataTitleFontSize: blockDataTitleStyle.fontSize,
            languageButtonWeights: Array.from(
                document.querySelectorAll('.language-button'),
                (button) => getComputedStyle(button).fontWeight
            )
        };
    });

    await selectLocale('ko');
    languageState = await readTranslatedUiState();
    assert.deepEqual(languageState, {
        locale: 'ko',
        title: '블록 생성기',
        generationTab: '생성',
        generateCountLabel: '생성 개수',
        statusText: '블록 300개를 생성했습니다.',
        settingsLabel: '설정',
        helpTitle: '사용 방법',
        helpButtonLabel: '사용 방법',
        githubLinkLabel: '새 탭에서 GitHub 저장소 열기',
        metaLabels: ['인덱스', '큐브', '크기', 'ID'],
        pressedLocales: ['ko']
    });
    let localizedFontState = await readLocalizedFontState();
    assert.match(localizedFontState.fontFamily, /^"Pretendard Variable"/);
    assert.equal(localizedFontState.fontSynthesis, 'none');
    assert.equal(localizedFontState.rootWeight, '400');
    assert.equal(localizedFontState.brandWeight, '700');
    assert.equal(localizedFontState.tabFontSize, '14px');
    assert.equal(localizedFontState.groupTitleFontSize, '15px');
    assert.equal(localizedFontState.blockDataTitleFontSize, '14px');
    assert.deepEqual(localizedFontState.languageButtonWeights, ['500', '500', '500']);
    assert.deepEqual(
        await readPlatformFonts(
            '#generationPanel .control-group:nth-child(2) .group-title'
        ),
        [{
            familyName: 'Pretendard Variable',
            postScriptName: 'PretendardVariable-Bold'
        }]
    );
    assert.deepEqual(
        await readPlatformFonts('#status'),
        [{
            familyName: 'Pretendard Variable',
            postScriptName: 'PretendardVariable'
        }]
    );
    assert.equal(new URL(page.url()).searchParams.get('lang'), 'ko');
    await page.screenshot({
        path: path.join(os.tmpdir(), 'block-generator-web-ko.png'),
        fullPage: true
    });

    await selectLocale('ja');
    languageState = await readTranslatedUiState();
    assert.deepEqual(languageState, {
        locale: 'ja',
        title: 'ブロックジェネレーター',
        generationTab: '生成',
        generateCountLabel: '生成数',
        statusText: '300個のブロックを生成しました。',
        settingsLabel: '設定',
        helpTitle: '使い方',
        helpButtonLabel: '使い方',
        githubLinkLabel: 'GitHubリポジトリを新しいタブで開く',
        metaLabels: ['インデックス', 'キューブ数', 'サイズ', 'ID'],
        pressedLocales: ['ja']
    });
    localizedFontState = await readLocalizedFontState();
    assert.match(localizedFontState.fontFamily, /^"Pretendard JP Variable"/);
    assert.equal(localizedFontState.fontSynthesis, 'none');
    assert.equal(localizedFontState.rootWeight, '400');
    assert.equal(localizedFontState.brandWeight, '700');
    assert.equal(localizedFontState.tabFontSize, '14px');
    assert.equal(localizedFontState.groupTitleFontSize, '15px');
    assert.equal(localizedFontState.blockDataTitleFontSize, '14px');
    assert.deepEqual(localizedFontState.languageButtonWeights, ['500', '500', '500']);
    assert.deepEqual(
        await readPlatformFonts(
            '#generationPanel .control-group:nth-child(2) .group-title'
        ),
        [{
            familyName: 'Pretendard JP Variable',
            postScriptName: 'PretendardJPVariable-Bold'
        }]
    );
    await page.screenshot({
        path: path.join(os.tmpdir(), 'block-generator-web-ja.png'),
        fullPage: true
    });

    await selectLocale('en');
    languageState = await readTranslatedUiState();
    assert.deepEqual(languageState, {
        locale: 'en',
        title: 'Block Generator',
        generationTab: 'Generation',
        generateCountLabel: 'Generate count',
        statusText: 'Generated 300 blocks.',
        settingsLabel: 'Settings',
        helpTitle: 'How to use',
        helpButtonLabel: 'How to use',
        githubLinkLabel: 'Open GitHub repository in a new tab',
        metaLabels: ['Index', 'Cubes', 'Size', 'ID'],
        pressedLocales: ['en']
    });
    localizedFontState = await readLocalizedFontState();
    assert.match(localizedFontState.fontFamily, /^"Pretendard Variable"/);
    assert.equal(localizedFontState.fontSynthesis, 'none');
    assert.equal(localizedFontState.rootWeight, '400');
    assert.equal(localizedFontState.brandWeight, '700');
    assert.equal(localizedFontState.tabFontSize, '14px');
    assert.equal(localizedFontState.groupTitleFontSize, '15px');
    assert.equal(localizedFontState.blockDataTitleFontSize, '14px');
    assert.deepEqual(localizedFontState.languageButtonWeights, ['500', '500', '500']);
    assert.deepEqual(
        await readPlatformFonts(
            '#generationPanel .control-group:nth-child(2) .group-title'
        ),
        [{
            familyName: 'Pretendard Variable',
            postScriptName: 'PretendardVariable-Bold'
        }]
    );
    assert.deepEqual(
        await readPlatformFonts('#status'),
        [{
            familyName: 'Pretendard Variable',
            postScriptName: 'PretendardVariable'
        }]
    );

    const timeoutState = await page.evaluate(async () => {
        const {
            generateBlockJson,
            isBlockGenerationTimeoutError
        } = await import('/src/api/blockGeneratorWasm.mjs');

        try {
            await generateBlockJson({
                generate_count: 300,
                block_count_min: 5,
                block_count_max: 15,
                max_r: 4,
                max_c: 4,
                max_h: 5,
                density: 0,
                allow_duplicate: false
            }, { timeoutMs: 0 });

            return { timedOut: false };
        } catch (error) {
            return {
                timedOut: isBlockGenerationTimeoutError(error),
                name: error.name,
                message: error.message
            };
        }
    });
    assert.deepEqual(timeoutState, {
        timedOut: true,
        name: 'BlockGenerationTimeoutError',
        message: 'Block generation timed out after 0 seconds.'
    });

    await page.click('#nextButton');
    blockPositionText = await page.textContent('#blockPosition');
    assert.equal(blockPositionText, '2 / 300');

    await page.click('#prevButton');
    blockPositionText = await page.textContent('#blockPosition');
    assert.equal(blockPositionText, '1 / 300');

    await page.locator('#renderCanvas').evaluate((canvas) => canvas.focus());
    await page.keyboard.press('.');
    blockPositionText = await page.textContent('#blockPosition');
    assert.equal(blockPositionText, '2 / 300');

    await page.keyboard.press(',');
    blockPositionText = await page.textContent('#blockPosition');
    assert.equal(blockPositionText, '1 / 300');

    await page.fill('#generateCount', '2');
    await page.locator('#renderCanvas').evaluate((canvas) => canvas.focus());
    await page.keyboard.press('g');
    await page.waitForFunction(
        () => document.querySelector('#blockPosition')?.textContent === '1 / 2',
        null,
        { timeout: 30000 }
    );
    blockPositionText = await page.textContent('#blockPosition');
    assert.equal(blockPositionText, '1 / 2');

    await page.click('#settingsToggleButton');
    layoutState = await readLayoutState();
    assert.equal(layoutState.pageScrollsVertically, false);
    assert.equal(layoutState.panelAriaHidden, 'true');
    assert.equal(layoutState.toggleExpanded, 'false');
    assert.equal(layoutState.toggleLabel, 'Show settings');
    assert.equal(layoutState.canvasInsideViewport, true);

    await page.click('#settingsToggleButton');
    layoutState = await readLayoutState();
    assert.equal(layoutState.panelAriaHidden, 'false');
    assert.equal(layoutState.toggleExpanded, 'true');
    assert.equal(layoutState.toggleLabel, 'Hide settings');
    assert.equal(layoutState.canvasInsideViewport, true);

    let tabState = await page.evaluate(() => ({
        generationSelected: document.querySelector('#generationTab')
            .getAttribute('aria-selected'),
        renderingSelected: document.querySelector('#renderingTab')
            .getAttribute('aria-selected'),
        generationHidden: document.querySelector('#generationPanel').hidden,
        renderingHidden: document.querySelector('#renderingPanel').hidden
    }));
    assert.deepEqual(tabState, {
        generationSelected: 'true',
        renderingSelected: 'false',
        generationHidden: false,
        renderingHidden: true
    });

    await page.click('#renderingTab');
    tabState = await page.evaluate(() => ({
        generationSelected: document.querySelector('#generationTab')
            .getAttribute('aria-selected'),
        renderingSelected: document.querySelector('#renderingTab')
            .getAttribute('aria-selected'),
        generationHidden: document.querySelector('#generationPanel').hidden,
        renderingHidden: document.querySelector('#renderingPanel').hidden
    }));
    assert.deepEqual(tabState, {
        generationSelected: 'false',
        renderingSelected: 'true',
        generationHidden: true,
        renderingHidden: false
    });

    let lightPositionState = await page.evaluate(() => ({
        followsCamera: document.querySelector('#lightFollowsCamera').checked,
        lightAzimuthDisabled: document.querySelector('#lightAzimuthDeg').disabled,
        lightAzimuthValueDisabled: document.querySelector('#lightAzimuthDegValue').disabled,
        lightElevationDisabled: document.querySelector('#lightElevationDeg').disabled,
        lightElevationValueDisabled: document.querySelector('#lightElevationDegValue').disabled,
        cameraAzimuth: document.querySelector('#cameraAzimuthDeg').value,
        cameraElevation: document.querySelector('#cameraElevationDeg').value,
        lightAzimuth: document.querySelector('#lightAzimuthDeg').value,
        lightElevation: document.querySelector('#lightElevationDeg').value
    }));
    assert.equal(lightPositionState.followsCamera, false);
    assert.equal(lightPositionState.lightAzimuthDisabled, false);
    assert.equal(lightPositionState.lightAzimuthValueDisabled, false);
    assert.equal(lightPositionState.lightElevationDisabled, false);
    assert.equal(lightPositionState.lightElevationValueDisabled, false);

    await page.check('#lightFollowsCamera');
    lightPositionState = await page.evaluate(() => ({
        followsCamera: document.querySelector('#lightFollowsCamera').checked,
        lightAzimuthDisabled: document.querySelector('#lightAzimuthDeg').disabled,
        lightAzimuthValueDisabled: document.querySelector('#lightAzimuthDegValue').disabled,
        lightElevationDisabled: document.querySelector('#lightElevationDeg').disabled,
        lightElevationValueDisabled: document.querySelector('#lightElevationDegValue').disabled,
        cameraAzimuth: document.querySelector('#cameraAzimuthDeg').value,
        cameraElevation: document.querySelector('#cameraElevationDeg').value,
        lightAzimuth: document.querySelector('#lightAzimuthDeg').value,
        lightElevation: document.querySelector('#lightElevationDeg').value
    }));
    assert.equal(lightPositionState.followsCamera, true);
    assert.equal(lightPositionState.lightAzimuthDisabled, true);
    assert.equal(lightPositionState.lightAzimuthValueDisabled, true);
    assert.equal(lightPositionState.lightElevationDisabled, true);
    assert.equal(lightPositionState.lightElevationValueDisabled, true);
    assert.equal(lightPositionState.lightAzimuth, lightPositionState.cameraAzimuth);
    assert.equal(lightPositionState.lightElevation, lightPositionState.cameraElevation);

    await page.fill('#edgeThicknessValue', '8');
    let syncedValues = await page.evaluate(() => ({
        range: document.querySelector('#edgeThickness').value,
        number: document.querySelector('#edgeThicknessValue').value
    }));
    assert.deepEqual(syncedValues, { range: '8', number: '8' });

    await page.fill('#directionalLightIntensityValue', '6');
    syncedValues = await page.evaluate(() => ({
        range: document.querySelector('#directionalLightIntensity').value,
        number: document.querySelector('#directionalLightIntensityValue').value
    }));
    assert.deepEqual(syncedValues, { range: '6', number: '6' });

    await page.locator('#cameraDistance').evaluate((control) => {
        control.value = '16';
        control.dispatchEvent(new Event('input', { bubbles: true }));
    });
    syncedValues = await page.evaluate(() => ({
        range: document.querySelector('#cameraDistance').value,
        number: document.querySelector('#cameraDistanceValue').value
    }));
    assert.deepEqual(syncedValues, { range: '16', number: '16' });

    await page.locator('#cameraAzimuthDeg').evaluate((control) => {
        control.value = '90';
        control.dispatchEvent(new Event('input', { bubbles: true }));
    });
    lightPositionState = await page.evaluate(() => ({
        cameraAzimuth: document.querySelector('#cameraAzimuthDeg').value,
        cameraAzimuthValue: document.querySelector('#cameraAzimuthDegValue').value,
        lightAzimuth: document.querySelector('#lightAzimuthDeg').value,
        lightAzimuthValue: document.querySelector('#lightAzimuthDegValue').value
    }));
    assert.deepEqual(lightPositionState, {
        cameraAzimuth: '90',
        cameraAzimuthValue: '90',
        lightAzimuth: '90',
        lightAzimuthValue: '90'
    });

    const cameraElevationBeforeDrag = await page.evaluate(() =>
        Number(document.querySelector('#cameraElevationDeg').value)
    );

    const canvasBox = await page.locator('#renderCanvas').boundingBox();
    assert.ok(canvasBox);

    await page.mouse.move(
        canvasBox.x + canvasBox.width / 2,
        canvasBox.y + canvasBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
        canvasBox.x + canvasBox.width / 2 + 40,
        canvasBox.y + canvasBox.height / 2 - 20
    );
    await page.mouse.up();

    lightPositionState = await page.evaluate(() => ({
        cameraAzimuth: Number(document.querySelector('#cameraAzimuthDeg').value),
        cameraAzimuthValue: Number(document.querySelector('#cameraAzimuthDegValue').value),
        cameraElevation: Number(document.querySelector('#cameraElevationDeg').value),
        cameraElevationValue: Number(document.querySelector('#cameraElevationDegValue').value),
        lightAzimuth: Number(document.querySelector('#lightAzimuthDeg').value),
        lightAzimuthValue: Number(document.querySelector('#lightAzimuthDegValue').value),
        lightElevation: Number(document.querySelector('#lightElevationDeg').value),
        lightElevationValue: Number(document.querySelector('#lightElevationDegValue').value)
    }));
    assert.deepEqual(lightPositionState, {
        cameraAzimuth: 76,
        cameraAzimuthValue: 76,
        cameraElevation: cameraElevationBeforeDrag - 7,
        cameraElevationValue: cameraElevationBeforeDrag - 7,
        lightAzimuth: 76,
        lightAzimuthValue: 76,
        lightElevation: cameraElevationBeforeDrag - 7,
        lightElevationValue: cameraElevationBeforeDrag - 7
    });

    await page.mouse.wheel(0, -100);
    syncedValues = await page.evaluate(() => ({
        range: document.querySelector('#cameraDistance').value,
        number: document.querySelector('#cameraDistanceValue').value
    }));
    assert.deepEqual(syncedValues, { range: '15.5', number: '15.5' });

    await page.uncheck('#lightFollowsCamera');
    lightPositionState = await page.evaluate(() => ({
        lightAzimuthDisabled: document.querySelector('#lightAzimuthDeg').disabled,
        lightAzimuthValueDisabled: document.querySelector('#lightAzimuthDegValue').disabled,
        lightElevationDisabled: document.querySelector('#lightElevationDeg').disabled,
        lightElevationValueDisabled: document.querySelector('#lightElevationDegValue').disabled
    }));
    assert.deepEqual(lightPositionState, {
        lightAzimuthDisabled: false,
        lightAzimuthValueDisabled: false,
        lightElevationDisabled: false,
        lightElevationValueDisabled: false
    });

    await page.screenshot({
        path: path.join(os.tmpdir(), 'block-generator-web-smoke.png'),
        fullPage: true
    });

    const readCanvasMetrics = async () => page.$eval('#renderCanvas', (canvas) => {
        const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        let darkPixels = 0;
        let nonBackgroundPixels = 0;
        let luminanceSum = 0;
        let luminanceCount = 0;

        gl.finish();
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const a = pixels[i + 3];

            if (a === 0) {
                continue;
            }

            if (Math.abs(r - 246) > 5 || Math.abs(g - 247) > 5 || Math.abs(b - 249) > 5) {
                nonBackgroundPixels += 1;
                luminanceSum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
                luminanceCount += 1;
            }

            if (r < 45 && g < 45 && b < 45) {
                darkPixels += 1;
            }
        }

        return {
            width: canvas.width,
            height: canvas.height,
            darkPixels,
            nonBackgroundPixels,
            averageLuminance: luminanceCount > 0 ? luminanceSum / luminanceCount : 0,
            hasJpgDataUrl: canvas.toDataURL('image/jpeg', 0.95)
                .startsWith('data:image/jpeg;base64,')
        };
    });

    let metrics = await readCanvasMetrics();
    assert.equal(metrics.width, 1200);
    assert.equal(metrics.height, 1200);
    assert.ok(metrics.nonBackgroundPixels > 1000);
    assert.ok(metrics.darkPixels > 50);
    assert.equal(metrics.hasJpgDataUrl, true);

    const rendererReuseState = await page.evaluate(async () => {
        const { DEFAULT_RENDER_OPTIONS, ThreeBlockRenderer } =
            await import('/modules/blockRenderer/src/core/index.mjs');
        const canvas = document.createElement('canvas');
        const renderer = new ThreeBlockRenderer(canvas, DEFAULT_RENDER_OPTIONS);
        const block = {
            index: 1,
            size: { r: 2, c: 2, h: 2 },
            center: { r: 0.5, c: 0.5, h: 0.5 },
            cubes: [
                { r: 0, c: 0, h: 0 },
                { r: 0, c: 1, h: 0 },
                { r: 1, c: 0, h: 0 },
                { r: 1, c: 1, h: 1 }
            ]
        };

        renderer.render(block, DEFAULT_RENDER_OPTIONS);

        const initialBlockGroup = renderer.blockGroup;
        const initialBlockMaterial = renderer.blockMaterial;
        const initialEdgeOverlay = renderer.edgeOverlay;
        const initialEdgeMaterial = renderer.edgeMaterial;

        renderer.render(block, {
            ...DEFAULT_RENDER_OPTIONS,
            backgroundColor: '#ffffff',
            blockColor: '#ff0000',
            edgeColor: '#00ff00'
        });

        const colorOnlyState = {
            blockGroupReused: renderer.blockGroup === initialBlockGroup,
            blockMaterialReused: renderer.blockMaterial === initialBlockMaterial,
            edgeOverlayReused: renderer.edgeOverlay === initialEdgeOverlay,
            edgeMaterialReused: renderer.edgeMaterial === initialEdgeMaterial
        };

        renderer.render(block, {
            ...DEFAULT_RENDER_OPTIONS,
            cameraAzimuthDeg: 90
        });

        return {
            colorOnlyState,
            cameraState: {
                blockGroupReused: renderer.blockGroup === initialBlockGroup,
                edgeOverlayRebuilt: renderer.edgeOverlay !== initialEdgeOverlay
            }
        };
    });

    assert.deepEqual(rendererReuseState.colorOnlyState, {
        blockGroupReused: true,
        blockMaterialReused: true,
        edgeOverlayReused: true,
        edgeMaterialReused: true
    });
    assert.deepEqual(rendererReuseState.cameraState, {
        blockGroupReused: true,
        edgeOverlayRebuilt: true
    });

    await page.evaluate(() => {
        const originalClick = HTMLAnchorElement.prototype.click;
        window.__downloadClicks = [];
        window.__restoreAnchorClick = () => {
            HTMLAnchorElement.prototype.click = originalClick;
        };
        HTMLAnchorElement.prototype.click = function click() {
            window.__downloadClicks.push({
                download: this.download,
                href: this.href
            });
        };
    });
    await page.locator('#renderCanvas').evaluate((canvas) => canvas.focus());
    await page.keyboard.press('s');
    const downloadClicks = await page.evaluate(() => window.__downloadClicks);
    assert.equal(downloadClicks.length, 1);
    assert.match(downloadClicks[0].download, /^block-\d+\.jpg$/);
    assert.ok(downloadClicks[0].href.startsWith('data:image/jpeg;base64,'));
    await page.evaluate(() => window.__restoreAnchorClick());

    const litAverageLuminance = metrics.averageLuminance;
    await page.fill('#ambientLightIntensityValue', '0');
    await page.fill('#directionalLightIntensityValue', '0');
    metrics = await readCanvasMetrics();
    assert.ok(litAverageLuminance > metrics.averageLuminance + 20);

    await page.setViewportSize({ width: 390, height: 760 });
    await page.waitForFunction(() => {
        const canvasRect = document.querySelector('.canvas-wrap').getBoundingClientRect();
        return canvasRect.left >= 0 &&
            canvasRect.top >= 0 &&
            canvasRect.right <= window.innerWidth + 1 &&
            canvasRect.bottom <= window.innerHeight + 1;
    });
    layoutState = await readLayoutState();
    assert.equal(layoutState.pageScrollsVertically, false);
    assert.equal(layoutState.canvasInsideViewport, true);
    assert.equal(layoutState.toolbarInsideViewport, true);
    assert.equal(layoutState.toolbarDoesNotOverlapCanvas, true);
    assert.equal(layoutState.toolbarDirection, 'column');
    assert.equal(layoutState.canvasWidth, layoutState.canvasHeight);

    await page.click('#settingsToggleButton');
    layoutState = await readLayoutState();
    assert.equal(layoutState.panelAriaHidden, 'true');
    assert.equal(layoutState.toggleExpanded, 'false');
    assert.equal(layoutState.toggleLabel, 'Show settings');
    assert.equal(layoutState.canvasInsideViewport, true);
    assert.equal(layoutState.toolbarDoesNotOverlapCanvas, true);

    await page.screenshot({
        path: path.join(os.tmpdir(), 'block-generator-web-mobile-smoke.png'),
        fullPage: true
    });

    metrics = await readCanvasMetrics();
    assert.equal(metrics.width, 1200);
    assert.equal(metrics.height, 1200);
    assert.ok(metrics.nonBackgroundPixels > 1000);
    assert.equal(metrics.hasJpgDataUrl, true);
});
