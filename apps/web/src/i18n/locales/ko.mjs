export default {
    app: {
        title: '블록 생성기'
    },
    settings: {
        label: '설정',
        sectionsLabel: '설정 항목',
        hide: '설정 숨기기',
        show: '설정 표시'
    },
    tabs: {
        generation: '생성',
        rendering: '렌더링'
    },
    generation: {
        title: '생성',
        generateCount: '생성 개수',
        blockCountMin: '최소 블록 개수',
        blockCountMax: '최대 블록 개수',
        rows: '행',
        columns: '열',
        height: '높이',
        density: '밀도',
        allowDuplicates: '중복 허용',
        start: '시작',
        generating: '생성 중...',
        blocks: '블록',
        previousBlock: '이전 블록',
        nextBlock: '다음 블록',
        blockData: '블록 데이터',
        overlay: '블록 생성 중...'
    },
    rendering: {
        title: '렌더링',
        defaults: '기본값',
        background: '배경',
        blockColor: '블록 색상',
        edgeColor: '모서리 색상',
        edgeThickness: '모서리 두께',
        cameraDistance: '카메라 거리',
        cameraAngle: '카메라 각도',
        cameraHeight: '카메라 높이'
    },
    lighting: {
        title: '조명',
        followCamera: '카메라 따라가기',
        angle: '조명 각도',
        height: '조명 높이',
        ambient: '환경광',
        directional: '방향광'
    },
    blockMeta: {
        index: '인덱스',
        cubes: '큐브',
        size: '크기',
        id: 'ID'
    },
    preview: {
        label: '블록 미리보기'
    },
    language: {
        selector: '언어',
        english: '영어',
        korean: '한국어',
        japanese: '일본어'
    },
    status: {
        ready: '준비됨',
        generating: '블록 생성 중... 제한 시간은 {seconds}초입니다.',
        noBlocks: '생성된 블록이 없습니다.',
        generated: '블록 {count}개를 생성했습니다.',
        saveBeforeGeneration: 'JPG로 저장하기 전에 블록을 생성해 주세요.'
    },
    errors: {
        outOfRange: '{label} 값이 허용 범위를 벗어났습니다.',
        minGreaterThanMax: '최소 블록 개수는 최대 블록 개수보다 클 수 없습니다.',
        exceedsCapacity: '최대 블록 개수는 현재 용량인 {capacity}개를 초과할 수 없습니다.',
        timeout: '{seconds}초 안에 생성하지 못했습니다. 블록 개수를 줄이거나 행, 열 또는 높이를 늘려 주세요.',
        generationFailed: '블록을 생성하지 못했습니다.'
    }
};
