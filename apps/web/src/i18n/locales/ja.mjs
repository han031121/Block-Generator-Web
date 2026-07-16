export default {
    app: {
        title: 'ブロックジェネレーター'
    },
    settings: {
        label: '設定',
        sectionsLabel: '設定項目',
        hide: '設定を非表示',
        show: '設定を表示'
    },
    tabs: {
        generation: '生成',
        rendering: 'レンダリング'
    },
    generation: {
        title: '生成',
        generateCount: '生成数',
        blockCountMin: '最小ブロック数',
        blockCountMax: '最大ブロック数',
        rows: '行数',
        columns: '列数',
        height: '高さ',
        density: '密度',
        allowDuplicates: '重複を許可',
        start: '生成する',
        generating: '生成中…',
        blocks: 'ブロック',
        previousBlock: '前のブロック',
        nextBlock: '次のブロック',
        blockData: 'ブロックデータ',
        overlay: 'ブロックを生成中…'
    },
    rendering: {
        title: 'レンダリング',
        defaults: '初期値に戻す',
        background: '背景色',
        blockColor: 'ブロックの色',
        edgeColor: 'エッジの色',
        edgeThickness: 'エッジの太さ',
        cameraDistance: 'カメラの距離',
        cameraAngle: 'カメラの角度',
        cameraHeight: 'カメラの高さ'
    },
    lighting: {
        title: 'ライティング',
        followCamera: 'カメラに追従',
        angle: 'ライトの角度',
        height: 'ライトの高さ',
        ambient: '環境光',
        directional: '平行光'
    },
    blockMeta: {
        index: 'インデックス',
        cubes: 'キューブ数',
        size: 'サイズ',
        id: 'ID'
    },
    preview: {
        label: 'ブロックプレビュー'
    },
    language: {
        selector: '言語',
        english: '英語',
        korean: '韓国語',
        japanese: '日本語'
    },
    status: {
        ready: '準備完了',
        generating: 'ブロックを生成中です… タイムアウトは{seconds}秒です。',
        noBlocks: 'ブロックが生成されませんでした。',
        generated: '{count}個のブロックを生成しました。',
        saveBeforeGeneration: 'JPG形式で保存する前に、ブロックを生成してください。'
    },
    errors: {
        outOfRange: '{label}は入力可能な範囲外です。',
        minGreaterThanMax: '最小ブロック数は、最大ブロック数以下に設定してください。',
        exceedsCapacity: '最大ブロック数が、現在のサイズで配置可能な上限（{capacity}個）を超えています。',
        timeout: '{seconds}秒以内に生成できませんでした。ブロック数を減らすか、行数・列数・高さのいずれかを増やしてください。',
        generationFailed: 'ブロックを生成できませんでした。'
    }
};
