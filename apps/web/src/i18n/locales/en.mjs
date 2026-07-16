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
    language: {
        selector: 'Language',
        english: 'English',
        korean: 'Korean',
        japanese: 'Japanese'
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
