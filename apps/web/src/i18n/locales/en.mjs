export default {
    app: {
        title: 'Block Generator'
    },
    settings: {
        label: 'Settings',
        sectionsLabel: 'Settings sections',
        hide: 'Hide settings',
        show: 'Show settings'
    },
    tabs: {
        generation: 'Generation',
        rendering: 'Rendering'
    },
    generation: {
        title: 'Generation',
        generateCount: 'Generate count',
        blockCountMin: 'Block count min',
        blockCountMax: 'Block count max',
        rows: 'Rows',
        columns: 'Columns',
        height: 'Height',
        density: 'Density',
        allowDuplicates: 'Allow duplicates',
        start: 'Start',
        generating: 'Generating...',
        blocks: 'Blocks',
        previousBlock: 'Previous block',
        nextBlock: 'Next block',
        blockData: 'Block data',
        overlay: 'Generating blocks...'
    },
    rendering: {
        title: 'Render',
        defaults: 'Defaults',
        background: 'Background',
        blockColor: 'Block color',
        edgeColor: 'Edge color',
        edgeThickness: 'Edge thickness',
        cameraDistance: 'Camera distance',
        cameraAngle: 'Camera angle',
        cameraHeight: 'Camera height'
    },
    lighting: {
        title: 'Light',
        followCamera: 'Follow camera',
        angle: 'Light angle',
        height: 'Light height',
        ambient: 'Ambient light',
        directional: 'Directional light'
    },
    blockMeta: {
        index: 'Index',
        cubes: 'Cubes',
        size: 'Size',
        id: 'ID'
    },
    preview: {
        label: 'Block preview'
    },
    utilities: {
        label: 'Quick tools',
        github: 'Open GitHub repository in a new tab',
        githubTitle: 'GitHub repository'
    },
    language: {
        selector: 'Language',
        english: 'English',
        korean: 'Korean',
        japanese: 'Japanese'
    },
    help: {
        eyebrow: 'GUIDE',
        open: 'How to use',
        close: 'Close help',
        title: 'How to use',
        intro: 'Generate a block, adjust it to the view you want, and save it as an image.',
        step1Title: 'Set generation conditions',
        step1Body: 'Choose the count, size, density, and other conditions, then select Start.',
        step2Title: 'Browse blocks',
        step2Body: 'Use the arrow buttons to inspect each generated block.',
        step3Title: 'Adjust the view',
        step3Body: 'Open Rendering to change colors, camera, and lighting. Drag the preview to rotate it and scroll to zoom.',
        step4Title: 'Save as JPG',
        step4Body: 'Select JPG when the preview is ready.',
        shortcuts: 'Keyboard shortcuts',
        generateShortcut: 'Generate blocks',
        browseShortcut: 'Previous / next block',
        saveShortcut: 'Save JPG'
    },
    status: {
        ready: 'Ready',
        generating: 'Generating blocks... Timeout after {seconds} seconds.',
        noBlocks: 'No blocks were generated.',
        generated: 'Generated {count} blocks.',
        saveBeforeGeneration: 'Generate a block before saving JPG.'
    },
    errors: {
        outOfRange: '{label} is outside the allowed range.',
        minGreaterThanMax: 'Block count min cannot be greater than block count max.',
        exceedsCapacity: 'Block count max cannot exceed the current capacity {capacity}.',
        timeout: 'Generation timed out after {seconds} seconds. Reduce block count or increase Rows, Columns, or Height.',
        generationFailed: 'Block generation failed.'
    }
};
