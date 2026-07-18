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
    utilities: {
        label: '빠른 도구',
        github: '새 탭에서 GitHub 저장소 열기',
        githubTitle: 'GitHub 저장소'
    },
    language: {
        selector: '언어',
        english: '영어',
        korean: '한국어',
        japanese: '일본어'
    },
    help: {
        eyebrow: '안내',
        open: '사용 방법',
        close: '도움말 닫기',
        title: '사용 방법',
        intro: '블록을 생성하고 원하는 모습으로 조정한 뒤 이미지로 저장할 수 있습니다.',
        step1Title: '생성 조건 설정',
        step1Body: '생성 개수, 크기, 밀도 등의 조건을 정한 뒤 시작을 선택합니다.',
        step2Title: '블록 둘러보기',
        step2Body: '화살표 버튼으로 생성된 블록을 하나씩 확인합니다.',
        step3Title: '화면 조정',
        step3Body: '렌더링 탭에서 색상, 카메라, 조명을 조정합니다. 미리보기를 드래그하면 회전하고 스크롤하면 확대하거나 축소할 수 있습니다.',
        step4Title: 'JPG로 저장',
        step4Body: '원하는 화면이 완성되면 JPG 버튼을 선택합니다.',
        shortcuts: '키보드 단축키',
        generateShortcut: '블록 생성',
        browseShortcut: '이전 / 다음 블록',
        saveShortcut: 'JPG 저장'
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
