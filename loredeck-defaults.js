/**
 * loredeck-defaults.js -- Saga
 * Built-in Loredeck identifiers and fallback metadata.
 */

export const HP_LEGACY_LOREDECK_ID = 'hp-golden-trio';
export const DEFAULT_HP_LOREDECK_ID = 'hp-core';
export const DEFAULT_HP_LOREDECK_FOLDER_ID = 'folder_harry-potter__golden-trio';
export const DEFAULT_HP_LOREDECK_UPDATED_AT = 1780617600000;

const HP_LIBRARY_PATH = Object.freeze(['Harry Potter', 'Golden Trio']);
const HP_SOURCE = Object.freeze({ kind: 'bundled', url: '' });

const HP_SPLIT_LOREDECKS = Object.freeze([
    {
        packId: 'hp-core',
        title: 'Harry Potter: Core',
        description: 'Reusable Hogwarts, magical Britain, school-cycle, and world-rule scaffolding for Harry Potter Golden Trio Loredecks.',
        era: 'Golden Trio Core',
        familyOrder: 10,
        tags: ['fandom:harry-potter', 'era:golden-trio', 'structure:split-loredeck', 'quality:human-vetted', 'scope:core'],
        stats: {
            entryCount: 74,
            categoryCounts: { character: 47, faction: 1, item: 4, knowledge: 9, location: 4, rule: 1, spell: 6, timeline: 2 },
            timelineAnchorCount: 22,
            timelineWindowCount: 6,
        },
    },
    {
        packId: 'hp-year-1-philosophers-stone',
        title: "Harry Potter Year 1: Philosopher's Stone",
        description: "Year 1 Golden Trio Loredeck for Philosopher's Stone, from pre-Hogwarts discovery through the Stone incident aftermath.",
        era: "Year 1: Philosopher's Stone",
        familyOrder: 20,
        tags: ['fandom:harry-potter', 'era:golden-trio', 'structure:split-loredeck', 'quality:human-vetted', 'school-year:1'],
        stats: {
            entryCount: 45,
            categoryCounts: { character: 15, event: 18, item: 5, knowledge: 3, relationship: 2, timeline: 2 },
            timelineAnchorCount: 55,
            timelineWindowCount: 9,
        },
    },
    {
        packId: 'hp-year-2-chamber-of-secrets',
        title: 'Harry Potter Year 2: Chamber of Secrets',
        description: 'Year 2 Golden Trio Loredeck for Dobby, the Chamber attacks, Polyjuice investigation, and the basilisk climax.',
        era: 'Year 2: Chamber of Secrets',
        familyOrder: 30,
        tags: ['fandom:harry-potter', 'era:golden-trio', 'structure:split-loredeck', 'quality:human-vetted', 'school-year:2'],
        stats: {
            entryCount: 43,
            categoryCounts: { character: 17, event: 13, item: 1, knowledge: 8, location: 2, spell: 1, timeline: 1 },
            timelineAnchorCount: 55,
            timelineWindowCount: 9,
        },
    },
    {
        packId: 'hp-year-3-prisoner-of-azkaban',
        title: 'Harry Potter Year 3: Prisoner of Azkaban',
        description: 'Year 3 Golden Trio Loredeck for Sirius, Dementors, Hogsmeade, Patronus training, Buckbeak, and the Time-Turner rescue.',
        era: 'Year 3: Prisoner of Azkaban',
        familyOrder: 40,
        tags: ['fandom:harry-potter', 'era:golden-trio', 'structure:split-loredeck', 'quality:human-vetted', 'school-year:3'],
        stats: {
            entryCount: 46,
            categoryCounts: { character: 14, event: 13, item: 5, knowledge: 6, location: 3, relationship: 1, spell: 3, timeline: 1 },
            timelineAnchorCount: 55,
            timelineWindowCount: 9,
        },
    },
    {
        packId: 'hp-year-4-goblet-of-fire',
        title: 'Harry Potter Year 4: Goblet of Fire',
        description: 'Year 4 Golden Trio Loredeck for the Quidditch World Cup, Triwizard Tournament, graveyard return, and Voldemort aftermath.',
        era: 'Year 4: Goblet of Fire',
        familyOrder: 50,
        tags: ['fandom:harry-potter', 'era:golden-trio', 'structure:split-loredeck', 'quality:human-vetted', 'school-year:4'],
        stats: {
            entryCount: 53,
            categoryCounts: { character: 17, event: 18, faction: 1, knowledge: 7, location: 2, relationship: 1, spell: 4, timeline: 3 },
            timelineAnchorCount: 56,
            timelineWindowCount: 9,
        },
    },
    {
        packId: 'hp-year-5-order-of-the-phoenix',
        title: 'Harry Potter Year 5: Order of the Phoenix',
        description: 'Year 5 Golden Trio Loredeck for Ministry denial, Umbridge, Dumbledore’s Army, Occlumency, OWLs, and the Department of Mysteries.',
        era: 'Year 5: Order of the Phoenix',
        familyOrder: 60,
        tags: ['fandom:harry-potter', 'era:golden-trio', 'structure:split-loredeck', 'quality:human-vetted', 'school-year:5'],
        stats: {
            entryCount: 53,
            categoryCounts: { character: 20, event: 11, faction: 7, knowledge: 6, location: 4, spell: 2, timeline: 3 },
            timelineAnchorCount: 55,
            timelineWindowCount: 10,
        },
    },
    {
        packId: 'hp-year-6-half-blood-prince',
        title: 'Harry Potter Year 6: Half-Blood Prince',
        description: 'Year 6 Golden Trio Loredeck for Slughorn, the Prince book, Draco suspicion, Apparition lessons, Horcrux memory, Sectumsempra, and the Tower crisis.',
        era: 'Year 6: Half-Blood Prince',
        familyOrder: 70,
        tags: ['fandom:harry-potter', 'era:golden-trio', 'structure:split-loredeck', 'quality:human-vetted', 'school-year:6'],
        stats: {
            entryCount: 53,
            categoryCounts: { character: 18, event: 14, faction: 2, item: 3, knowledge: 8, location: 1, relationship: 2, spell: 2, timeline: 3 },
            timelineAnchorCount: 57,
            timelineWindowCount: 15,
        },
    },
    {
        packId: 'hp-year-7-deathly-hallows',
        title: 'Harry Potter Year 7: Deathly Hallows',
        description: 'Year 7 Golden Trio Loredeck for the Seven Potters, Horcrux hunt, Hallows, Malfoy Manor, Shell Cottage, Gringotts, Hogwarts return, and Battle of Hogwarts.',
        era: 'Year 7: Deathly Hallows',
        familyOrder: 80,
        tags: ['fandom:harry-potter', 'era:golden-trio', 'structure:split-loredeck', 'quality:human-vetted', 'school-year:7'],
        stats: {
            entryCount: 63,
            categoryCounts: { character: 29, event: 16, item: 4, knowledge: 5, location: 3, relationship: 2, timeline: 4 },
            timelineAnchorCount: 70,
            timelineWindowCount: 18,
        },
    },
    {
        packId: 'hp-epilogue-post-war',
        title: 'Harry Potter: Post-War Years & Epilogue',
        description: 'Post-war Golden Trio Loredeck for wizarding reconstruction, Ministry reforms, Harry as an Auror, the 2014 Quidditch World Cup, and the 2017 new-generation platform scene.',
        era: 'Post-War Years & Epilogue',
        familyOrder: 90,
        tags: ['fandom:harry-potter', 'era:golden-trio', 'structure:split-loredeck', 'quality:human-vetted', 'scope:post-war', 'era:post-war'],
        stats: {
            entryCount: 5,
            categoryCounts: { event: 3, location: 1, timeline: 1 },
            timelineAnchorCount: 29,
            timelineWindowCount: 7,
        },
    },
]);

function buildHpLoredeckRecord(deck) {
    return Object.freeze({
        packId: deck.packId,
        type: 'bundled',
        title: deck.title,
        description: deck.description,
        fandom: 'Harry Potter',
        era: deck.era,
        author: 'Saga',
        version: '0.1.0',
        entrySchemaVersion: 3,
        manifest: `Loredecks/${deck.packId}/loredeck.json`,
        source: HP_SOURCE,
        tags: deck.tags,
        library: {
            suggestedPath: HP_LIBRARY_PATH,
            familyOrder: deck.familyOrder,
        },
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: `${deck.title} Loredeck cover`,
            },
        },
        stats: deck.stats,
        installedAt: DEFAULT_HP_LOREDECK_UPDATED_AT,
        updatedAt: DEFAULT_HP_LOREDECK_UPDATED_AT,
    });
}

function buildHpLoredeckContext(deck) {
    return Object.freeze({
        schemaVersion: 1,
        packId: deck.packId,
        contextType: 'calendar',
        label: '',
        sceneDate: '',
        subjectiveDate: '',
        contextSortKey: null,
        contextSortKeyFrom: null,
        contextSortKeyTo: null,
        anchorId: '',
        anchorFrom: '',
        anchorTo: '',
        arc: '',
        phase: '',
        season: '',
        episode: '',
        chapter: '',
        issue: '',
        quest: '',
        gameStage: '',
        alias: '',
        notes: '',
        branchId: 'main',
        confidence: 0,
        manualLock: false,
        source: 'unknown',
        updatedAt: 0,
    });
}

export const DEFAULT_HP_LOREDECK_LIBRARY_RECORDS = Object.freeze(HP_SPLIT_LOREDECKS.map(buildHpLoredeckRecord));
export const DEFAULT_HP_LOREDECK_LIBRARY_PACKS = Object.freeze(Object.fromEntries(
    DEFAULT_HP_LOREDECK_LIBRARY_RECORDS.map(record => [record.packId, record])
));
export const DEFAULT_HP_LOREDECK_CONTEXTS = Object.freeze(Object.fromEntries(
    HP_SPLIT_LOREDECKS.map(deck => [deck.packId, buildHpLoredeckContext(deck)])
));
export const DEFAULT_HP_LOREDECK_STACK = Object.freeze([]);
export const DEFAULT_HP_LOREDECK_IDS = Object.freeze(HP_SPLIT_LOREDECKS.map(deck => deck.packId));

export function isDefaultHarryPotterLoredeckId(packId = '') {
    return DEFAULT_HP_LOREDECK_IDS.includes(String(packId || '').trim());
}
