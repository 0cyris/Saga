/**
 * loredeck-defaults.js -- Saga
 * Built-in Loredeck identifiers and fallback metadata.
 */

export const HP_LEGACY_LOREDECK_ID = 'hp-golden-trio';
export const DEFAULT_HP_LOREDECK_ID = 'hp-core';
export const DEFAULT_HP_LOREDECK_FOLDER_ID = 'folder_harry-potter__golden-trio';
export const DEFAULT_HP_LOREDECK_UPDATED_AT = 1780876800000;
export const DEFAULT_LOTR_LOREDECK_UPDATED_AT = 1780876800000;
export const DEFAULT_MHA_LOREDECK_UPDATED_AT = 1780876800000;
export const DEFAULT_JJK_LOREDECK_UPDATED_AT = 1781136000000;
export const DEFAULT_ONE_PIECE_LOREDECK_UPDATED_AT = 1781654400000;
export const DEFAULT_STAR_TREK_LOREDECK_UPDATED_AT = 1781740800000;
export const DEFAULT_STAR_WARS_LEGENDS_LOREDECK_UPDATED_AT = 1780876800000;

const HP_LIBRARY_PATH = Object.freeze(['Harry Potter', 'Golden Trio']);
const LOTR_LIBRARY_PATH = Object.freeze(['Lord of The Rings', 'War of the Ring']);
const MHA_LIBRARY_PATH = Object.freeze(['My Hero Academia', 'Manga Main']);
const JJK_LIBRARY_PATH = Object.freeze(['Jujutsu Kaisen', 'Manga Main']);
const ONE_PIECE_LIBRARY_PATH = Object.freeze(['One Piece']);
const STAR_TREK_LIBRARY_PATH = Object.freeze(['Star Trek']);
const STAR_WARS_LEGENDS_LIBRARY_PATH = Object.freeze(['Star Wars', 'Legends']);
const HP_SOURCE = Object.freeze({ kind: 'bundled', url: '' });
const LOTR_SOURCE = Object.freeze({ kind: 'bundled', url: '' });
const MHA_SOURCE = Object.freeze({ kind: 'bundled', url: '' });
const JJK_SOURCE = Object.freeze({ kind: 'bundled', url: '' });
const ONE_PIECE_SOURCE = Object.freeze({ kind: 'bundled', url: '' });
const STAR_TREK_SOURCE = Object.freeze({ kind: 'bundled', url: 'https://memory-alpha.fandom.com/wiki/Portal:Main' });
const STAR_WARS_LEGENDS_SOURCE = Object.freeze({ kind: 'bundled', url: '' });
const ONE_PIECE_LOREDECK_VERSION_OVERRIDES = Object.freeze({
    'one-piece-orange-town': '0.4.1-orange-town-runtime-lore',
    'one-piece-syrup-village': '0.4.1-syrup-village-runtime-lore',
    'one-piece-baratie': '0.4.1-baratie-runtime-lore',
    'one-piece-arlong-park': '0.4.1-arlong-park-runtime-lore',
    'one-piece-loguetown': '0.4.1-loguetown-runtime-lore',
    'one-piece-warship-island': '0.4.1-warship-island-runtime-lore',
    'one-piece-reverse-mountain': '0.4.1-reverse-mountain-runtime-lore',
    'one-piece-whisky-peak': '0.4.1-whisky-peak-runtime-lore',
    'one-piece-little-garden': '0.4.1-little-garden-runtime-lore',
    'one-piece-drum-island': '0.4.1-drum-island-runtime-lore',
});
const STAR_TREK_LOREDECK_DESCRIPTION_OVERRIDES = Object.freeze({
    'star-trek-ds9-season-2': 'Draft season Loredeck for Star Trek: Deep Space Nine season 2, covering Bajoran coup d\'\u00e9tat, The Maquis, Mirror universe, Dominion introduction with season-local spoiler guards.',
});

const HP_SPLIT_LOREDECKS = Object.freeze([
    {
        "packId": "hp-core",
        "title": "Harry Potter: Core",
        "description": "Reusable Hogwarts, magical Britain, school-cycle, and world-rule scaffolding for Harry Potter Golden Trio Loredecks.",
        "era": "Golden Trio Core",
        "familyOrder": 10,
        "tags": [
            "era:golden-trio",
            "fandom:harry-potter",
            "quality:human-vetted",
            "quality:relevance-curated",
            "scope:core",
            "structure:split-loredeck"
        ],
        "stats": {
                  "entryCount": 80,
                  "categoryCounts": {
                            "character": 47,
                            "faction": 1,
                            "item": 4,
                            "knowledge": 12,
                            "location": 4,
                            "rule": 2,
                            "secret": 2,
                            "spell": 6,
                            "timeline": 2
                  },
                  "timelineAnchorCount": 22,
                  "timelineWindowCount": 6
        }
    },
    {
        "packId": "hp-year-1-philosophers-stone",
        "title": "Harry Potter Year 1: Philosopher's Stone",
        "description": "Year 1 Golden Trio Loredeck for Philosopher's Stone, from pre-Hogwarts discovery through the Stone incident aftermath.",
        "era": "Year 1: Philosopher's Stone",
        "familyOrder": 20,
        "tags": [
            "era:golden-trio",
            "fandom:harry-potter",
            "quality:human-vetted",
            "quality:relevance-curated",
            "school-year:1",
            "structure:split-loredeck"
        ],
        "stats": {
                  "entryCount": 52,
                  "categoryCounts": {
                            "character": 15,
                            "event": 18,
                            "item": 6,
                            "knowledge": 4,
                            "relationship": 3,
                            "secret": 5,
                            "timeline": 1
                  },
                  "timelineAnchorCount": 55,
                  "timelineWindowCount": 9
        }
    },
    {
        "packId": "hp-year-2-chamber-of-secrets",
        "title": "Harry Potter Year 2: Chamber of Secrets",
        "description": "Year 2 Golden Trio Loredeck for Dobby, the Chamber attacks, Polyjuice investigation, and the basilisk climax.",
        "era": "Year 2: Chamber of Secrets",
        "familyOrder": 30,
        "tags": [
            "era:golden-trio",
            "fandom:harry-potter",
            "quality:human-vetted",
            "quality:relevance-curated",
            "school-year:2",
            "structure:split-loredeck"
        ],
        "stats": {
                  "entryCount": 49,
                  "categoryCounts": {
                            "character": 17,
                            "event": 13,
                            "item": 1,
                            "knowledge": 10,
                            "location": 2,
                            "secret": 5,
                            "spell": 1
                  },
                  "timelineAnchorCount": 55,
                  "timelineWindowCount": 9
        }
    },
    {
        "packId": "hp-year-3-prisoner-of-azkaban",
        "title": "Harry Potter Year 3: Prisoner of Azkaban",
        "description": "Year 3 Golden Trio Loredeck for Sirius, Dementors, Hogsmeade, Patronus training, Buckbeak, and the Time-Turner rescue.",
        "era": "Year 3: Prisoner of Azkaban",
        "familyOrder": 40,
        "tags": [
            "era:golden-trio",
            "fandom:harry-potter",
            "quality:human-vetted",
            "quality:relevance-curated",
            "school-year:3",
            "structure:split-loredeck"
        ],
        "stats": {
                  "entryCount": 53,
                  "categoryCounts": {
                            "character": 14,
                            "event": 13,
                            "item": 5,
                            "knowledge": 7,
                            "location": 3,
                            "relationship": 1,
                            "secret": 6,
                            "spell": 4
                  },
                  "timelineAnchorCount": 55,
                  "timelineWindowCount": 9
        }
    },
    {
        "packId": "hp-year-4-goblet-of-fire",
        "title": "Harry Potter Year 4: Goblet of Fire",
        "description": "Year 4 Golden Trio Loredeck for the Quidditch World Cup, Triwizard Tournament, graveyard return, and Voldemort aftermath.",
        "era": "Year 4: Goblet of Fire",
        "familyOrder": 50,
        "tags": [
            "era:golden-trio",
            "fandom:harry-potter",
            "quality:human-vetted",
            "quality:relevance-curated",
            "school-year:4",
            "structure:split-loredeck"
        ],
        "stats": {
                  "entryCount": 60,
                  "categoryCounts": {
                            "character": 17,
                            "event": 19,
                            "faction": 2,
                            "knowledge": 7,
                            "location": 2,
                            "relationship": 2,
                            "secret": 5,
                            "spell": 4,
                            "timeline": 2
                  },
                  "timelineAnchorCount": 56,
                  "timelineWindowCount": 9
        }
    },
    {
        "packId": "hp-year-5-order-of-the-phoenix",
        "title": "Harry Potter Year 5: Order of the Phoenix",
        "description": "Year 5 Golden Trio Loredeck for Ministry denial, Umbridge, Dumbledore's Army, Occlumency, OWLs, and the Department of Mysteries.",
        "era": "Year 5: Order of the Phoenix",
        "familyOrder": 60,
        "tags": [
            "era:golden-trio",
            "fandom:harry-potter",
            "quality:human-vetted",
            "quality:relevance-curated",
            "school-year:5",
            "structure:split-loredeck"
        ],
        "stats": {
                  "entryCount": 62,
                  "categoryCounts": {
                            "character": 21,
                            "event": 11,
                            "faction": 8,
                            "knowledge": 6,
                            "location": 4,
                            "rule": 1,
                            "secret": 6,
                            "spell": 3,
                            "timeline": 2
                  },
                  "timelineAnchorCount": 55,
                  "timelineWindowCount": 10
        }
    },
    {
        "packId": "hp-year-6-half-blood-prince",
        "title": "Harry Potter Year 6: Half-Blood Prince",
        "description": "Year 6 Golden Trio Loredeck for Slughorn, the Prince book, Draco suspicion, Apparition lessons, Horcrux memory, Sectumsempra, and the Tower crisis.",
        "era": "Year 6: Half-Blood Prince",
        "familyOrder": 70,
        "tags": [
            "era:golden-trio",
            "fandom:harry-potter",
            "quality:human-vetted",
            "quality:relevance-curated",
            "school-year:6",
            "structure:split-loredeck"
        ],
        "stats": {
                  "entryCount": 59,
                  "categoryCounts": {
                            "character": 19,
                            "event": 13,
                            "faction": 2,
                            "item": 3,
                            "knowledge": 10,
                            "location": 1,
                            "relationship": 2,
                            "secret": 5,
                            "spell": 2,
                            "timeline": 2
                  },
                  "timelineAnchorCount": 57,
                  "timelineWindowCount": 15
        }
    },
    {
        "packId": "hp-year-7-deathly-hallows",
        "title": "Harry Potter Year 7: Deathly Hallows",
        "description": "Year 7 Golden Trio Loredeck for the Seven Potters, Horcrux hunt, Hallows, Malfoy Manor, Shell Cottage, Gringotts, Hogwarts return, and Battle of Hogwarts.",
        "era": "Year 7: Deathly Hallows",
        "familyOrder": 80,
        "tags": [
            "era:golden-trio",
            "fandom:harry-potter",
            "quality:human-vetted",
            "quality:relevance-curated",
            "school-year:7",
            "structure:split-loredeck"
        ],
        "stats": {
                  "entryCount": 76,
                  "categoryCounts": {
                            "character": 30,
                            "event": 16,
                            "faction": 1,
                            "item": 5,
                            "knowledge": 6,
                            "location": 3,
                            "relationship": 3,
                            "secret": 9,
                            "timeline": 3
                  },
                  "timelineAnchorCount": 70,
                  "timelineWindowCount": 18
        }
    },
    {
        "packId": "hp-epilogue-post-war",
        "title": "Harry Potter: Post-War Years & Epilogue",
        "description": "Post-war Golden Trio Loredeck for wizarding reconstruction, Ministry reforms, Harry as an Auror, the 2014 Quidditch World Cup, and the 2017 new-generation platform scene.",
        "era": "Post-War Years & Epilogue",
        "familyOrder": 90,
        "tags": [
            "era:golden-trio",
            "era:post-war",
            "fandom:harry-potter",
            "quality:human-vetted",
            "quality:relevance-curated",
            "scope:post-war",
            "structure:split-loredeck"
        ],
        "stats": {
            "entryCount": 7,
            "categoryCounts": {
                "event": 3,
                "knowledge": 1,
                "location": 1,
                "timeline": 2
            },
            "timelineAnchorCount": 29,
            "timelineWindowCount": 7
        }
    }
]);

const LOTR_SPLIT_LOREDECKS = Object.freeze([
    {
        packId: 'middle-earth-core',
        title: 'Middle-earth: Core',
        description: 'Core peoples, places, factions, artifacts, world rules, and spoiler-safe constraints for War of the Ring roleplay and fanfiction.',
        era: 'War of the Ring Core',
        familyOrder: 10,
        tags: ['fandom:middle-earth', 'era:war-of-the-ring', 'continuity:lotr-books', 'structure:split-loredeck', 'quality:draft-review', 'scope:core', 'density:hp-reference-band', 'quality:reviewed-draft', 'density:volume-reference-candidate', 'quality:v8-density-pass'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck Cover for Middle-earth: Core',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
            banner: {
                path: 'assets/banner.png',
                alt: 'Wide banner for Middle-earth: Core',
            },
        },
        stats: {
            entryCount: 81,
            categoryCounts: { character: 17, faction: 15, item: 3, knowledge: 9, location: 2, relationship: 1, rule: 34 },
            timelineAnchorCount: 7,
            timelineWindowCount: 5,
        },
    },
    {
        packId: 'middle-earth-fellowship-of-the-ring',
        title: 'Middle-earth: The Fellowship of the Ring',
        description: 'Book-specific Context, spoiler gates, status changes, and journey-state Lorecards for The Fellowship of the Ring in Tolkien book continuity.',
        era: 'The Fellowship of the Ring',
        familyOrder: 20,
        tags: ['fandom:middle-earth', 'era:war-of-the-ring', 'book:fellowship-of-the-ring', 'continuity:lotr-books', 'density:hp-reference-band', 'quality:reviewed-draft', 'density:volume-reference-candidate', 'quality:v8-density-pass'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck Cover for Middle-earth: The Fellowship of the Ring',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
            banner: {
                path: 'assets/banner.png',
                alt: 'Wide banner for Middle-earth: The Fellowship of the Ring',
            },
        },
        stats: {
            entryCount: 95,
            categoryCounts: { character: 22, event: 19, faction: 5, item: 4, knowledge: 15, location: 15, relationship: 6, rule: 8, timeline: 1 },
            timelineAnchorCount: 57,
            timelineWindowCount: 16,
        },
    },
    {
        packId: 'middle-earth-two-towers',
        title: 'Middle-earth: The Two Towers',
        description: "Context-gated War of the Ring lore for The Two Towers book arc, including Rohan, Isengard, Fangorn, Ithilien, Gollum, Faramir, Helm's Deep, and Cirith Ungol.",
        era: 'The Two Towers',
        familyOrder: 30,
        tags: ['fandom:middle-earth', 'era:war-of-the-ring', 'book:two-towers', 'continuity:lotr-books', 'density:hp-reference-band', 'quality:reviewed-draft', 'density:volume-reference-candidate', 'quality:v8-density-pass'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover for Middle-earth: The Two Towers',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
            banner: {
                path: 'assets/banner.png',
                alt: 'Wide banner for Middle-earth: The Two Towers',
            },
        },
        stats: {
            entryCount: 100,
            categoryCounts: { character: 29, event: 18, faction: 10, item: 1, knowledge: 9, location: 15, relationship: 11, rule: 5, secret: 1, timeline: 1 },
            timelineAnchorCount: 55,
            timelineWindowCount: 18,
        },
    },
    {
        packId: 'middle-earth-return-of-the-king',
        title: 'Middle-earth: The Return of the King',
        description: 'Context-gated War of the Ring lore for The Return of the King book arc, including Gondor, Rohan, Pelennor, Mordor, Mount Doom, Sauron\'s fall, Scouring of the Shire, and the Grey Havens.',
        era: 'The Return of the King',
        familyOrder: 40,
        tags: ['fandom:middle-earth', 'era:war-of-the-ring', 'book:return-of-the-king', 'continuity:lotr-books', 'density:hp-reference-band', 'quality:reviewed-draft', 'density:volume-reference-candidate', 'quality:v8-density-pass'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover for Middle-earth: The Return of the King',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
            banner: {
                path: 'assets/banner.png',
                alt: 'Wide banner for Middle-earth: The Return of the King',
            },
        },
        stats: {
            entryCount: 105,
            categoryCounts: { character: 25, event: 27, faction: 11, item: 4, knowledge: 11, location: 10, relationship: 10, rule: 4, secret: 3 },
            timelineAnchorCount: 69,
            timelineWindowCount: 19,
        },
    },
]);

const MHA_SPLIT_LOREDECKS = Object.freeze([
    {
        packId: 'mha-core',
        title: 'My Hero Academia: Core',
        description: 'Core Quirk society, hero system, U.A., factions, identity aliases, Quirk rules, and spoiler-safe knowledge gates for manga-primary My Hero Academia roleplay.',
        era: 'Main continuity core',
        familyOrder: 10,
        tags: ['fandom:mha', 'continuity:mha-manga-main', 'adaptation:manga', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck Cover for My Hero Academia: Core',
                aspect: '3:4',
                focalPoint: { x: 0.5, y: 0.42 },
            },
            banner: {
                path: 'assets/banner.png',
                alt: 'Wide banner for My Hero Academia: Core',
            },
        },
        stats: {
            entryCount: 121,
            categoryCounts: { character: 10, faction: 29, knowledge: 20, rule: 59, secret: 3 },
            timelineAnchorCount: 14,
            timelineWindowCount: 9,
        },
    },
    {
        packId: 'mha-ua-beginnings-usj',
        title: 'My Hero Academia: U.A. Beginnings and USJ',
        description: "Context-aware Lorecards for Izuku's origin, One For All transfer, U.A. entrance, early Class 1-A, Battle Trial, and the USJ attack.",
        era: 'U.A. Beginnings through USJ',
        familyOrder: 20,
        tags: ['fandom:mha', 'continuity:mha-manga-main', 'adaptation:manga', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck Cover for My Hero Academia: U.A. Beginnings and USJ',
                aspect: '3:4',
                focalPoint: { x: 0.5, y: 0.42 },
            },
            banner: {
                path: 'assets/banner.png',
                alt: 'Wide banner for My Hero Academia: U.A. Beginnings and USJ',
            },
        },
        stats: {
            entryCount: 75,
            categoryCounts: { character: 15, event: 35, knowledge: 8, relationship: 9, rule: 8 },
            timelineAnchorCount: 21,
            timelineWindowCount: 10,
        },
    },
    {
        packId: 'mha-sports-festival-stain-final-exams',
        title: 'My Hero Academia: Sports Festival, Stain, and Final Exams',
        description: 'Sports Festival, Hero Killer Stain/Hosu, workplace training, and Final Exams Context-aware Lorecards for manga-primary My Hero Academia.',
        era: 'Sports Festival through Final Exams',
        familyOrder: 30,
        tags: ['fandom:mha', 'continuity:mha-manga-main', 'adaptation:manga', 'arc:sports-festival', 'arc:hero-killer', 'arc:final-exams', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck Cover for My Hero Academia: Sports Festival, Stain, and Final Exams',
                aspect: '3:4',
                focalPoint: { x: 0.5, y: 0.42 },
            },
            banner: {
                path: 'assets/banner.png',
                alt: 'Wide banner for My Hero Academia: Sports Festival, Stain, and Final Exams',
            },
        },
        stats: {
            entryCount: 88,
            categoryCounts: { character: 27, event: 12, faction: 5, knowledge: 11, location: 1, relationship: 9, rule: 18, secret: 4, timeline: 1 },
            timelineAnchorCount: 38,
            timelineWindowCount: 13,
        },
    },
    {
        packId: 'mha-training-camp-kamino',
        title: 'My Hero Academia: Training Camp and Kamino',
        description: 'Forest Training Camp, Vanguard Action Squad, Bakugo capture, Hideout Raid, Kamino Ward, All Might vs All For One, and dorm transition Lorecards for manga-primary My Hero Academia.',
        era: 'Forest Training Camp through Kamino aftermath',
        familyOrder: 40,
        tags: ['fandom:mha', 'continuity:mha-manga-main', 'adaptation:manga', 'arc:forest-training-camp', 'arc:hideout-raid', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck Cover for My Hero Academia: Training Camp and Kamino',
                aspect: '3:4',
                focalPoint: { x: 0.5, y: 0.42 },
            },
            banner: {
                path: 'assets/banner.png',
                alt: 'Wide banner for My Hero Academia: Training Camp and Kamino',
            },
        },
        stats: {
            entryCount: 84,
            categoryCounts: { character: 17, event: 13, faction: 9, item: 1, knowledge: 16, location: 5, relationship: 5, rule: 10, secret: 7, timeline: 1 },
            timelineAnchorCount: 36,
            timelineWindowCount: 12,
        },
    },
    {
        packId: 'mha-license-hassaikai-remedial',
        title: 'My Hero Academia: License Exam and Shie Hassaikai',
        description: 'Provisional Hero License Exam, Shie Hassaikai raid, Eri/Overhaul, Mirio/Nighteye, and Remedial Course Context for manga-primary My Hero Academia roleplay and fanfiction.',
        era: 'Provisional Hero License Exam, Shie Hassaikai, and Remedial Course',
        familyOrder: 50,
        tags: ['fandom:mha', 'continuity:mha-manga-main', 'arc:provisional-license', 'arc:shie-hassaikai', 'arc:remedial-course', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover placeholder',
                aspect: '3:4',
                focalPoint: { x: 0.5, y: 0.42 },
            },
            banner: {
                path: 'assets/banner.png',
                alt: 'Wide banner placeholder',
            },
        },
        stats: {
            entryCount: 92,
            categoryCounts: { character: 18, event: 6, faction: 6, knowledge: 30, location: 2, relationship: 7, rule: 15, secret: 8 },
            timelineAnchorCount: 52,
            timelineWindowCount: 11,
        },
    },
    {
        packId: 'mha-school-festival-pro-hero',
        title: 'My Hero Academia: School Festival and Pro Hero',
        description: 'U.A. School Festival, Eri recovery, Gentle/La Brava, Pro Hero rankings, Endeavor/Hawks, High-End, Todoroki family pressure, and One For All vestige Context for manga-primary MHA roleplay and fanfiction.',
        era: 'U.A. School Festival and Pro Hero',
        familyOrder: 60,
        tags: ['fandom:mha', 'continuity:mha-manga-main', 'arc:school-festival', 'arc:pro-hero', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover placeholder',
                aspect: '3:4',
                focalPoint: { x: 0.5, y: 0.42 },
            },
            banner: {
                path: 'assets/banner.png',
                alt: 'Wide banner placeholder',
            },
        },
        stats: {
            entryCount: 108,
            categoryCounts: { character: 25, event: 8, faction: 8, item: 1, knowledge: 11, location: 2, relationship: 13, rule: 15, secret: 24, timeline: 1 },
            timelineAnchorCount: 29,
            timelineWindowCount: 7,
        },
    },
    {
        packId: 'mha-joint-training-villain-academia-endeavor-agency',
        title: 'My Hero Academia: Joint Training, Villain Academia, and Endeavor Agency',
        description: 'Joint Training, Blackwhip awakening, My Villain Academia, Meta Liberation Army, PLF formation, Endeavor Agency work studies, Hawks coded warning, Todoroki family pressure, and pre-war setup for manga-primary MHA roleplay and fanfiction.',
        era: 'Joint Training through Endeavor Agency',
        familyOrder: 70,
        tags: ['fandom:mha', 'continuity:mha-manga-main', 'arc:joint-training', 'arc:meta-liberation-army', 'arc:endeavor-agency', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover placeholder',
                aspect: '3:4',
                focalPoint: { x: 0.5, y: 0.42 },
            },
            banner: {
                path: 'assets/banner.png',
                alt: 'Wide banner placeholder',
            },
        },
        stats: {
            entryCount: 122,
            categoryCounts: { character: 23, event: 40, faction: 1, knowledge: 9, relationship: 7, rule: 26, secret: 15, timeline: 1 },
            timelineAnchorCount: 37,
            timelineWindowCount: 9,
        },
    },
    {
        packId: 'mha-paranormal-liberation-war',
        title: 'My Hero Academia: Paranormal Liberation War',
        description: 'Context-gated story-state, knowledge, ability, faction, and aftermath lore for the Paranormal Liberation War arc of manga-primary My Hero Academia.',
        era: 'Paranormal Liberation War and immediate aftermath',
        familyOrder: 80,
        tags: ['fandom:mha', 'continuity:mha-manga-main', 'arc:paranormal-liberation-war', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover placeholder for My Hero Academia: Paranormal Liberation War',
                aspect: '3:4',
                focalPoint: { x: 0.5, y: 0.42 },
            },
            banner: {
                path: 'assets/banner.png',
                alt: 'Wide banner placeholder for My Hero Academia: Paranormal Liberation War',
            },
        },
        stats: {
            entryCount: 102,
            categoryCounts: { character: 42, event: 23, faction: 7, knowledge: 2, location: 1, relationship: 3, rule: 7, secret: 17 },
            timelineAnchorCount: 44,
            timelineWindowCount: 11,
        },
    },
    {
        packId: 'mha-dark-hero-star-traitor',
        title: 'My Hero Academia: Dark Hero, Star and Stripe, and U.A. Traitor',
        description: 'Context-gated story-state, knowledge, ability, relationship, and spoiler-guard lore for Dark Hero, Star and Stripe, and U.A. Traitor material in manga-primary My Hero Academia.',
        era: 'Dark Hero through U.A. Traitor',
        familyOrder: 90,
        tags: ['fandom:mha', 'continuity:mha-manga-main', 'arc:dark-hero', 'arc:star-and-stripe', 'arc:ua-traitor', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover placeholder for My Hero Academia: Dark Hero, Star and Stripe, and U.A. Traitor',
                aspect: '3:4',
                focalPoint: { x: 0.5, y: 0.42 },
            },
            banner: {
                path: 'assets/banner.png',
                alt: 'Wide banner placeholder for My Hero Academia: Dark Hero, Star and Stripe, and U.A. Traitor',
            },
        },
        stats: {
            entryCount: 109,
            categoryCounts: { character: 32, event: 11, faction: 4, knowledge: 15, location: 3, relationship: 20, rule: 13, secret: 11 },
            timelineAnchorCount: 35,
            timelineWindowCount: 6,
        },
    },
    {
        packId: 'mha-final-war-epilogue',
        title: 'My Hero Academia: Final War and Epilogue',
        description: 'Context-gated story-state, battle-route, knowledge, ability, relationship, aftermath, and spoiler-guard lore for the Final War and Chapter 430 epilogue in manga-primary My Hero Academia.',
        era: 'Final War through Chapter 430 Epilogue',
        familyOrder: 100,
        tags: ['fandom:mha', 'continuity:mha-manga-main', 'arc:final-war', 'arc:epilogue', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover placeholder for My Hero Academia: Final War and Epilogue',
                aspect: '3:4',
                focalPoint: { x: 0.5, y: 0.42 },
            },
            banner: {
                path: 'assets/banner.png',
                alt: 'Wide banner placeholder for My Hero Academia: Final War and Epilogue',
            },
        },
        stats: {
            entryCount: 140,
            categoryCounts: { character: 47, event: 23, faction: 11, knowledge: 4, location: 3, relationship: 24, rule: 7, secret: 21 },
            timelineAnchorCount: 47,
            timelineWindowCount: 12,
        },
    },
    {
        packId: 'mha-post-series-more',
        title: 'My Hero Academia: Post-Series Extra - More',
        description: "Optional Chapter 431 'More' post-series extra overlay for manga-primary My Hero Academia. Adds adult-life, Quirk Counseling, relationship, ranking, and future-guard lore that should not leak into the default Chapter 430 epilogue deck.",
        era: "Post-series extra: Chapter 431 More",
        familyOrder: 110,
        tags: ['fandom:mha', 'continuity:mha-manga-main', 'arc:post-series-more', 'chapter:431-more', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover placeholder for My Hero Academia: Post-Series Extra - More',
                aspect: '3:4',
                focalPoint: { x: 0.5, y: 0.42 },
            },
            banner: {
                path: 'assets/banner.png',
                alt: 'Wide banner placeholder for My Hero Academia: Post-Series Extra - More',
            },
        },
        stats: {
            entryCount: 47,
            categoryCounts: { character: 12, event: 2, faction: 5, knowledge: 1, relationship: 15, rule: 4, secret: 2, timeline: 6 },
            timelineAnchorCount: 11,
            timelineWindowCount: 4,
        },
    },
]);

const JJK_SPLIT_LOREDECKS = Object.freeze([
    {
        packId: 'jjk-core',
        title: 'Jujutsu Kaisen: Core',
        description: 'Core cursed energy, jujutsu society, technique, Domain Expansion, Binding Vow, and spoiler-gate constraints for manga-primary Jujutsu Kaisen roleplay.',
        era: 'Manga Main Core',
        familyOrder: 10,
        tags: ['fandom:jjk', 'continuity:jjk-manga-main', 'adaptation:manga', 'scope:core', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover for Jujutsu Kaisen: Core',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
        },
        stats: {
            entryCount: 50,
            categoryCounts: { faction: 1, knowledge: 1, rule: 40, secret: 8 },
            timelineAnchorCount: 7,
            timelineWindowCount: 3,
        },
    },
    {
        packId: 'jjk-zero',
        title: 'Jujutsu Kaisen 0',
        description: "Prequel Loredeck for Yuta Okkotsu, Rika Orimoto, Tokyo Jujutsu High first-year dynamics, Suguru Geto's pre-mainline faction state, and the Night Parade climax.",
        era: 'Jujutsu Kaisen 0 Prequel',
        familyOrder: 20,
        tags: ['fandom:jjk', 'continuity:jjk-zero', 'adaptation:manga', 'arc:jjk-zero', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover for Jujutsu Kaisen 0',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
        },
        stats: {
            entryCount: 33,
            categoryCounts: { character: 9, event: 6, faction: 2, knowledge: 1, relationship: 6, rule: 6, secret: 3 },
            timelineAnchorCount: 7,
            timelineWindowCount: 3,
        },
    },
    {
        packId: 'jjk-origin-death-painting',
        title: 'Jujutsu Kaisen: Origin through Death Painting',
        description: "Mainline opening Loredeck for Yuji becoming Sukuna's vessel, the early Tokyo first-years, detention center consequences, Junpei and Mahito, Kyoto Goodwill, and Death Painting aftermath.",
        era: 'Origin through Death Painting',
        familyOrder: 30,
        tags: ['fandom:jjk', 'continuity:jjk-manga-main', 'adaptation:manga', 'arc:origin', 'arc:death-painting', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover for Jujutsu Kaisen: Origin through Death Painting',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
        },
        stats: {
            entryCount: 40,
            categoryCounts: { character: 9, event: 10, faction: 2, knowledge: 1, relationship: 7, rule: 9, secret: 2 },
            timelineAnchorCount: 9,
            timelineWindowCount: 4,
        },
    },
    {
        packId: 'jjk-hidden-inventory-premature-death',
        title: 'Jujutsu Kaisen: Hidden Inventory and Premature Death',
        description: "Pre-mainline Loredeck for Gojo and Geto's student-era bond, the Star Plasma Vessel mission, Toji's disruption, Riko Amanai, and Geto's Premature Death defection boundary.",
        era: 'Hidden Inventory / Premature Death',
        familyOrder: 40,
        tags: ['fandom:jjk', 'continuity:jjk-manga-main', 'adaptation:manga', 'arc:hidden-inventory', 'arc:premature-death', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover for Jujutsu Kaisen: Hidden Inventory and Premature Death',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
        },
        stats: {
            entryCount: 38,
            categoryCounts: { character: 9, event: 11, faction: 2, knowledge: 3, relationship: 1, rule: 7, secret: 5 },
            timelineAnchorCount: 8,
            timelineWindowCount: 3,
        },
    },
    {
        packId: 'jjk-shibuya-incident',
        title: 'Jujutsu Kaisen: Shibuya Incident',
        description: "High-impact Shibuya Incident Loredeck for curtains, Gojo's sealing, Mechamaru's contingency, Toji's revival, Sukuna's return, Mahito, Kenjaku's reveal, casualty/status guards, and post-incident aftermath.",
        era: 'Shibuya Incident',
        familyOrder: 50,
        tags: ['fandom:jjk', 'continuity:jjk-manga-main', 'adaptation:manga', 'arc:shibuya-incident', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover for Jujutsu Kaisen: Shibuya Incident',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
        },
        stats: {
            entryCount: 51,
            categoryCounts: { character: 8, event: 17, faction: 2, knowledge: 3, location: 4, rule: 10, secret: 7 },
            timelineAnchorCount: 10,
            timelineWindowCount: 4,
        },
    },
    {
        packId: 'jjk-post-shibuya-preparation',
        title: 'Jujutsu Kaisen: Post-Shibuya and Perfect Preparation',
        description: "Post-Shibuya setup Loredeck for Yuji's reinstated execution order, Yuta's return, Tengen exposition, Culling Game setup, Maki and Mai, Zenin clan collapse, and Perfect Preparation aftermath.",
        era: 'Post-Shibuya / Perfect Preparation',
        familyOrder: 60,
        tags: ['fandom:jjk', 'continuity:jjk-manga-main', 'adaptation:manga', 'arc:post-shibuya', 'arc:perfect-preparation', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover for Jujutsu Kaisen: Post-Shibuya and Perfect Preparation',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
        },
        stats: {
            entryCount: 34,
            categoryCounts: { character: 6, event: 11, faction: 2, knowledge: 4, rule: 6, secret: 5 },
            timelineAnchorCount: 9,
            timelineWindowCount: 4,
        },
    },
    {
        packId: 'jjk-culling-game-colonies',
        title: 'Jujutsu Kaisen: Culling Game Colonies',
        description: 'Culling Game colony Loredeck for active rules, point transfer, Tokyo No. 1, Higuruma, Reggie, Sendai, Yuta, Hakari, Kashimo, and early colony survival pressure.',
        era: 'Culling Game Colonies',
        familyOrder: 70,
        tags: ['fandom:jjk', 'continuity:jjk-manga-main', 'adaptation:manga', 'arc:culling-game-colonies', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover for Jujutsu Kaisen: Culling Game Colonies',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
        },
        stats: {
            entryCount: 50,
            categoryCounts: { character: 11, event: 12, faction: 1, knowledge: 1, rule: 20, secret: 5 },
            timelineAnchorCount: 8,
            timelineWindowCount: 4,
        },
    },
    {
        packId: 'jjk-culling-game-convergence',
        title: 'Jujutsu Kaisen: Culling Game Convergence',
        description: "Late Culling Game Loredeck for Sakurajima, Angel and Hana, military incursion, Kenjaku versus Tengen's defenders, Sukuna's Megumi turn, Tsumiki and Yorozu, Gojo unsealing, and Shinjuku setup.",
        era: 'Culling Game Convergence',
        familyOrder: 80,
        tags: ['fandom:jjk', 'continuity:jjk-manga-main', 'adaptation:manga', 'arc:culling-game-convergence', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover for Jujutsu Kaisen: Culling Game Convergence',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
        },
        stats: {
            entryCount: 38,
            categoryCounts: { character: 6, event: 14, faction: 1, knowledge: 3, rule: 7, secret: 7 },
            timelineAnchorCount: 9,
            timelineWindowCount: 4,
        },
    },
    {
        packId: 'jjk-shinjuku-showdown',
        title: 'Jujutsu Kaisen: Shinjuku Showdown and Aftermath',
        description: "Final manga-main Loredeck for Gojo versus Sukuna, Shinjuku rotating plans, Kashimo, Higuruma, Yuta, Maki, Yuji and Megumi's final stakes, Sukuna's defeat, and epilogue-state guards.",
        era: 'Shinjuku Showdown and Aftermath',
        familyOrder: 90,
        tags: ['fandom:jjk', 'continuity:jjk-manga-main', 'adaptation:manga', 'arc:shinjuku-showdown', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover for Jujutsu Kaisen: Shinjuku Showdown and Aftermath',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
        },
        stats: {
            entryCount: 46,
            categoryCounts: { character: 8, event: 17, knowledge: 2, relationship: 1, rule: 10, secret: 8 },
            timelineAnchorCount: 9,
            timelineWindowCount: 4,
        },
    },
    {
        packId: 'jjk-modulo',
        title: 'Jujutsu Kaisen Modulo',
        description: "Separate sequel/spinoff Loredeck for Jujutsu Kaisen Modulo, including the future continuity boundary, Simurian arrival, Maru's diplomatic mission, Yuka and Tsurugi Okkotsu, alien jujutsu, coexistence-test stakes, and late-series resolution guards.",
        era: 'Modulo Sequel',
        familyOrder: 110,
        libraryPath: ['Jujutsu Kaisen', 'Modulo'],
        tags: ['fandom:jjk', 'continuity:jjk-modulo', 'adaptation:manga', 'arc:modulo', 'quality:draft-reference'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover for Jujutsu Kaisen Modulo',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
        },
        stats: {
            entryCount: 27,
            categoryCounts: { character: 4, event: 7, knowledge: 4, relationship: 1, rule: 6, secret: 5 },
            timelineAnchorCount: 9,
            timelineWindowCount: 4,
        },
    },
]);

const ONE_PIECE_ARC_LOREDECKS = Object.freeze([
    {
        "packId": "one-piece-romance-dawn",
        "title": "One Piece: Romance Dawn Arc",
        "description": "Reviewed manga-main Loredeck for Luffy leaving home, Shanks, Coby escaping Alvida, Zoro at Shells Town, Morgan, and the first Straw Hat alliance.",
        "era": "Romance Dawn Arc",
        "familyOrder": 10,
        "libraryPath": [
            "One Piece",
            "East Blue Saga"
        ],
        "tags": [
            "fandom:one-piece",
            "continuity:one-piece-manga-main",
            "saga:east-blue",
            "arc:romance-dawn",
            "structure:arc-split-loredeck",
            "quality:reviewed-baseline"
        ],
        "assets": {
            "cover": {
                "path": "assets/cover.jpg",
                "alt": "One Piece: Romance Dawn Arc Loredeck cover, manga volume 1",
                "aspect": "2:3",
                "focalPoint": {
                    "x": 0.5,
                    "y": 0.5
                }
            }
        },
        "stats": {
            "entryCount": 34,
            "categoryCounts": {
                "character": 10,
                "event": 5,
                "faction": 3,
                "item": 1,
                "knowledge": 2,
                "location": 2,
                "relationship": 7,
                "rule": 4
            },
            "timelineAnchorCount": 8,
            "timelineWindowCount": 8,
            "tagCount": 49,
            "entityCount": 18
        }
    },
    {
        "packId": "one-piece-orange-town",
        "title": "One Piece: Orange Town Arc",
        "description": "Reviewed manga-main Loredeck for Orange Town occupation stakes, Nami reveal gates, Buggy combat rules, Chouchou and Boodle civilian pressure, and the provisional Luffy-Zoro-Nami alliance.",
        "era": "Orange Town Arc",
        "familyOrder": 20,
        "libraryPath": [
            "One Piece",
            "East Blue Saga"
        ],
        "tags": [
            "fandom:one-piece",
            "continuity:one-piece-manga-main",
            "saga:east-blue",
            "arc:orange-town",
            "structure:arc-split-loredeck",
            "quality:reviewed-baseline"
        ],
        "assets": {
            "cover": {
                "path": "assets/cover.jpg",
                "alt": "One Piece: Orange Town Arc Loredeck cover, manga volume 3",
                "aspect": "2:3",
                "focalPoint": {
                    "x": 0.5,
                    "y": 0.5
                }
            }
        },
        "stats": {
            "entryCount": 31,
            "categoryCounts": {
                "character": 7,
                "event": 5,
                "faction": 1,
                "knowledge": 3,
                "location": 2,
                "relationship": 5,
                "rule": 8
            },
            "timelineAnchorCount": 8,
            "timelineWindowCount": 8,
            "tagCount": 51,
            "entityCount": 21
        }
    },
    {
        "packId": "one-piece-syrup-village",
        "title": "One Piece: Syrup Village Arc",
        "description": "Reviewed manga-main Loredeck for Usopp credibility gates, Kaya and Kuro deception, Syrup Village defense geography, Black Cat battle pressure, and Going Merry provenance.",
        "era": "Syrup Village Arc",
        "familyOrder": 30,
        "libraryPath": [
            "One Piece",
            "East Blue Saga"
        ],
        "tags": [
            "fandom:one-piece",
            "continuity:one-piece-manga-main",
            "saga:east-blue",
            "arc:syrup-village",
            "structure:arc-split-loredeck",
            "quality:reviewed-baseline"
        ],
        "assets": {
            "cover": {
                "path": "assets/cover.jpg",
                "alt": "One Piece: Syrup Village Arc Loredeck cover, manga volume 4",
                "aspect": "2:3",
                "focalPoint": {
                    "x": 0.5,
                    "y": 0.5
                }
            }
        },
        "stats": {
            "entryCount": 37,
            "categoryCounts": {
                "character": 7,
                "event": 4,
                "faction": 3,
                "item": 5,
                "knowledge": 10,
                "location": 4,
                "relationship": 3,
                "rule": 1
            },
            "timelineAnchorCount": 9,
            "timelineWindowCount": 9,
            "tagCount": 66,
            "entityCount": 25
        }
    },
    {
        "packId": "one-piece-baratie",
        "title": "One Piece: Baratie Arc",
        "description": "Reviewed manga-main Loredeck for Baratie food ethics, Sanji and Zeff debt, Krieg siege pressure, Mihawk and Zoro scale shock, Nami pursuit gating, and Sanji goodbye.",
        "era": "Baratie Arc",
        "familyOrder": 40,
        "libraryPath": [
            "One Piece",
            "East Blue Saga"
        ],
        "tags": [
            "fandom:one-piece",
            "continuity:one-piece-manga-main",
            "saga:east-blue",
            "arc:baratie",
            "structure:arc-split-loredeck",
            "quality:reviewed-baseline"
        ],
        "assets": {
            "cover": {
                "path": "assets/cover.jpg",
                "alt": "One Piece: Baratie Arc Loredeck cover, manga volume 7",
                "aspect": "2:3",
                "focalPoint": {
                    "x": 0.5,
                    "y": 0.5
                }
            }
        },
        "stats": {
            "entryCount": 41,
            "categoryCounts": {
                "character": 6,
                "event": 10,
                "faction": 2,
                "knowledge": 6,
                "location": 3,
                "relationship": 9,
                "rule": 5
            },
            "timelineAnchorCount": 10,
            "timelineWindowCount": 10,
            "tagCount": 68,
            "entityCount": 21
        }
    },
    {
        "packId": "one-piece-arlong-park",
        "title": "One Piece: Arlong Park Arc",
        "description": "Reviewed manga-main Loredeck for Nami reveal timing, Cocoyasi occupation, Arlong tribute and map-room coercion, Nezumi corruption, crew trust, and Arlong Park matchups.",
        "era": "Arlong Park Arc",
        "familyOrder": 50,
        "libraryPath": [
            "One Piece",
            "East Blue Saga"
        ],
        "tags": [
            "fandom:one-piece",
            "continuity:one-piece-manga-main",
            "saga:east-blue",
            "arc:arlong-park",
            "structure:arc-split-loredeck",
            "quality:reviewed-baseline"
        ],
        "assets": {
            "cover": {
                "path": "assets/cover.jpg",
                "alt": "One Piece: Arlong Park Arc Loredeck cover, manga volume 11",
                "aspect": "2:3",
                "focalPoint": {
                    "x": 0.5,
                    "y": 0.5
                }
            }
        },
        "stats": {
            "entryCount": 41,
            "categoryCounts": {
                "character": 6,
                "event": 11,
                "faction": 2,
                "knowledge": 8,
                "location": 2,
                "relationship": 6,
                "rule": 6
            },
            "timelineAnchorCount": 11,
            "timelineWindowCount": 11,
            "tagCount": 77,
            "entityCount": 30
        }
    },
    {
        "packId": "one-piece-loguetown",
        "title": "One Piece: Loguetown Arc",
        "description": "Reviewed manga-main Loredeck for Loguetown as East Blue threshold, Roger legacy, Smoker and Tashigi pressure, Buggy and Alvida revenge, Dragon mystery, and Grand Line departure.",
        "era": "Loguetown Arc",
        "familyOrder": 60,
        "libraryPath": [
            "One Piece",
            "East Blue Saga"
        ],
        "tags": [
            "fandom:one-piece",
            "continuity:one-piece-manga-main",
            "saga:east-blue",
            "arc:loguetown",
            "structure:arc-split-loredeck",
            "quality:reviewed-baseline"
        ],
        "assets": {
            "cover": {
                "path": "assets/cover.jpg",
                "alt": "One Piece: Loguetown Arc Loredeck cover, manga volume 12",
                "aspect": "2:3",
                "focalPoint": {
                    "x": 0.5,
                    "y": 0.5
                }
            }
        },
        "stats": {
            "entryCount": 35,
            "categoryCounts": {
                "character": 6,
                "event": 8,
                "faction": 2,
                "item": 1,
                "knowledge": 5,
                "location": 7,
                "relationship": 2,
                "rule": 4
            },
            "timelineAnchorCount": 9,
            "timelineWindowCount": 9,
            "tagCount": 68,
            "entityCount": 27
        }
    },
    {
        "packId": "one-piece-warship-island",
        "title": "One Piece: Warship Island Arc",
        "description": "Reviewed show-continuity Loredeck for Apis, Ryu, Warship Island, Lost Island, local Marine pursuit, Eric and Nelson pressure, and the anime bridge into Reverse Mountain.",
        "era": "Warship Island Arc",
        "familyOrder": 70,
        "libraryPath": [
            "One Piece",
            "East Blue Saga"
        ],
        "tags": [
            "fandom:one-piece",
            "continuity:one-piece-anime-main",
            "adaptation:anime",
            "saga:east-blue",
            "arc:warship-island",
            "topic:show-only",
            "structure:arc-split-loredeck",
            "quality:reviewed-baseline"
        ],
        "assets": {
            "cover": {
                "path": "assets/cover.jpg",
                "alt": "One Piece: Warship Island Arc Loredeck cover, transitional manga volume 12",
                "aspect": "2:3",
                "focalPoint": {
                    "x": 0.5,
                    "y": 0.5
                }
            }
        },
        "stats": {
            "entryCount": 25,
            "categoryCounts": {
                "character": 6,
                "event": 3,
                "faction": 1,
                "item": 1,
                "knowledge": 3,
                "location": 2,
                "relationship": 3,
                "rule": 6
            },
            "timelineAnchorCount": 7,
            "timelineWindowCount": 7,
            "tagCount": 36,
            "entityCount": 22
        }
    },
    {
        "packId": "one-piece-reverse-mountain",
        "title": "One Piece: Reverse Mountain Arc",
        "description": "Reviewed manga-main Loredeck for Grand Line entry mechanics, Reverse Mountain, Twin Cape, Laboon and Crocus, Log Pose basics, and the first Baroque Works route hook.",
        "era": "Reverse Mountain Arc",
        "familyOrder": 80,
        "libraryPath": [
            "One Piece",
            "Arabasta Saga"
        ],
        "tags": [
            "fandom:one-piece",
            "continuity:one-piece-manga-main",
            "saga:arabasta",
            "arc:reverse-mountain",
            "structure:arc-split-loredeck",
            "quality:reviewed-baseline"
        ],
        "assets": {
            "cover": {
                "path": "assets/cover.jpg",
                "alt": "One Piece: Reverse Mountain Arc Loredeck cover, manga volume 12",
                "aspect": "2:3",
                "focalPoint": {
                    "x": 0.5,
                    "y": 0.5
                }
            }
        },
        "stats": {
            "entryCount": 30,
            "categoryCounts": {
                "character": 5,
                "event": 5,
                "faction": 1,
                "knowledge": 6,
                "location": 2,
                "relationship": 3,
                "rule": 8
            },
            "timelineAnchorCount": 8,
            "timelineWindowCount": 8,
            "tagCount": 33,
            "entityCount": 21
        }
    },
    {
        "packId": "one-piece-whisky-peak",
        "title": "One Piece: Whisky Peak Arc",
        "description": "Reviewed manga-main Loredeck for Whisky Peak trap hospitality, Baroque Works secrecy, Zoro and Luffy conflict, Vivi and Igaram reveal windows, officer-agent pressure, and Arabasta mission handoff.",
        "era": "Whisky Peak Arc",
        "familyOrder": 90,
        "libraryPath": [
            "One Piece",
            "Arabasta Saga"
        ],
        "tags": [
            "fandom:one-piece",
            "continuity:one-piece-manga-main",
            "saga:arabasta",
            "arc:whisky-peak",
            "structure:arc-split-loredeck",
            "quality:reviewed-baseline"
        ],
        "assets": {
            "cover": {
                "path": "assets/cover.jpg",
                "alt": "One Piece: Whisky Peak Arc Loredeck cover, manga volume 13",
                "aspect": "2:3",
                "focalPoint": {
                    "x": 0.5,
                    "y": 0.5
                }
            }
        },
        "stats": {
            "entryCount": 36,
            "categoryCounts": {
                "character": 9,
                "event": 3,
                "faction": 4,
                "knowledge": 2,
                "location": 4,
                "relationship": 4,
                "rule": 7,
                "secret": 3
            },
            "timelineAnchorCount": 9,
            "timelineWindowCount": 9,
            "tagCount": 40,
            "entityCount": 27
        }
    },
    {
        "packId": "one-piece-little-garden",
        "title": "One Piece: Little Garden Arc",
        "description": "Reviewed manga-main Loredeck for Little Garden hazards, Dorry and Brogy honor, Elbaf boundaries, Baroque Works sabotage, wax and color tactics, Sanji route recovery, and Nami illness bridge.",
        "era": "Little Garden Arc",
        "familyOrder": 100,
        "libraryPath": [
            "One Piece",
            "Arabasta Saga"
        ],
        "tags": [
            "fandom:one-piece",
            "continuity:one-piece-manga-main",
            "saga:arabasta",
            "arc:little-garden",
            "structure:arc-split-loredeck",
            "quality:reviewed-baseline"
        ],
        "assets": {
            "cover": {
                "path": "assets/cover.jpg",
                "alt": "One Piece: Little Garden Arc Loredeck cover, manga volume 14",
                "aspect": "2:3",
                "focalPoint": {
                    "x": 0.5,
                    "y": 0.5
                }
            }
        },
        "stats": {
            "entryCount": 40,
            "categoryCounts": {
                "character": 7,
                "event": 7,
                "faction": 2,
                "knowledge": 6,
                "location": 4,
                "relationship": 4,
                "rule": 10
            },
            "timelineAnchorCount": 10,
            "timelineWindowCount": 10,
            "tagCount": 40,
            "entityCount": 27
        }
    },
    {
        "packId": "one-piece-drum-island",
        "title": "One Piece: Drum Island Arc",
        "description": "Reviewed manga-main Loredeck for Drum Island medical urgency, winter terrain, Wapol medical tyranny, Dalton and citizen pressure, Chopper/Hiriluk/Kureha identity gates, castle battle, sakura farewell, and narrow Ace/Blackbeard/Roger hooks.",
        "era": "Drum Island Arc",
        "familyOrder": 110,
        "libraryPath": [
            "One Piece",
            "Arabasta Saga"
        ],
        "tags": [
            "fandom:one-piece",
            "continuity:one-piece-manga-main",
            "saga:arabasta",
            "arc:drum-island",
            "structure:arc-split-loredeck",
            "quality:reviewed-baseline"
        ],
        "assets": {
            "cover": {
                "path": "assets/cover.jpg",
                "alt": "One Piece: Drum Island Arc Loredeck cover, manga volume 16",
                "aspect": "2:3",
                "focalPoint": {
                    "x": 0.5,
                    "y": 0.5
                }
            }
        },
        "stats": {
            "entryCount": 44,
            "categoryCounts": {
                "character": 8,
                "event": 11,
                "faction": 3,
                "knowledge": 7,
                "location": 2,
                "relationship": 6,
                "rule": 4,
                "secret": 3
            },
            "timelineAnchorCount": 11,
            "timelineWindowCount": 11,
            "tagCount": 44,
            "entityCount": 31
        }
    },
    {
        "packId": "one-piece-arabasta",
        "title": "One Piece: Arabasta Arc",
        "description": "Reviewed manga-main Loredeck for Arabasta kingdom-war pressure, Crocodile and Baroque Works manipulation, Vivi leadership, desert route constraints, Alubarna matchups, Poneglyph and Pluton gates, civil-war resolution, farewell, Robin boarding, and immediate cover-up state.",
        "era": "Arabasta Arc",
        "familyOrder": 120,
        "libraryPath": [
            "One Piece",
            "Arabasta Saga"
        ],
        "tags": [
            "fandom:one-piece",
            "continuity:one-piece-manga-main",
            "saga:arabasta",
            "arc:arabasta",
            "structure:arc-split-loredeck",
            "quality:reviewed-baseline"
        ],
        "assets": {
            "cover": {
                "path": "assets/cover.jpg",
                "alt": "One Piece: Arabasta Arc Loredeck cover, manga volume 23",
                "aspect": "2:3",
                "focalPoint": {
                    "x": 0.5,
                    "y": 0.5
                }
            }
        },
        "stats": {
            "entryCount": 58,
            "categoryCounts": {
                "character": 7,
                "event": 13,
                "faction": 4,
                "item": 3,
                "knowledge": 2,
                "location": 5,
                "relationship": 6,
                "rule": 8,
                "secret": 10
            },
            "timelineAnchorCount": 12,
            "timelineWindowCount": 12,
            "tagCount": 70,
            "entityCount": 55
        }
    },
    {
        "packId": "one-piece-post-arabasta",
        "title": "One Piece: Post-Arabasta Arc",
        "description": "Reviewed show-continuity Loredeck for Post-Arabasta episodes 131-135, covering anime-only shipboard decompression, Chopper Rumble Ball memory, Nami world-map paper, Sanji Tajio curry mentorship, Usopp Kodama fireworks, Zoro Johnny/Yosaku flashback, Robin early suspicion, Vivi absence, and next-island containment.",
        "era": "Post-Arabasta Arc",
        "familyOrder": 130,
        "libraryPath": [
            "One Piece",
            "Arabasta Saga"
        ],
        "tags": [
            "fandom:one-piece",
            "continuity:one-piece-anime-main",
            "adaptation:anime",
            "saga:arabasta",
            "arc:post-arabasta",
            "topic:show-only",
            "structure:arc-split-loredeck",
            "quality:reviewed-baseline"
        ],
        "assets": {
            "cover": {
                "path": "assets/cover.jpg",
                "alt": "One Piece: Post-Arabasta Arc Loredeck cover, manga volume 24",
                "aspect": "2:3",
                "focalPoint": {
                    "x": 0.5,
                    "y": 0.5
                }
            }
        },
        "stats": {
            "entryCount": 25,
            "categoryCounts": {
                "character": 5,
                "event": 5,
                "knowledge": 1,
                "location": 1,
                "relationship": 4,
                "rule": 6,
                "secret": 3
            },
            "timelineAnchorCount": 7,
            "timelineWindowCount": 7,
            "tagCount": 45,
            "entityCount": 28
        }
    }]);
const ONE_PIECE_ARC_LOREDECKS_BY_STORY_ORDER = Object.freeze(
    [...ONE_PIECE_ARC_LOREDECKS].sort((left, right) => (Number(left.familyOrder) || 0) - (Number(right.familyOrder) || 0))
);

const STAR_TREK_LOREDECKS = Object.freeze([
    {
        packId: 'star-trek-tng-season-1',
        title: 'Star Trek TNG Season 1',
        description: 'Draft season Loredeck for the Enterprise-D launch year, Q at Farpoint, early crew baselines, Ferengi and Romulan contact, Data/Lore, Yar death, and season 1 spoiler guards.',
        era: 'The Next Generation Season 1',
        familyOrder: 10,
        libraryPath: ['Star Trek', 'The Next Generation'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:tng',
            'season:tng-s1',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 75,
            categoryCounts: {
                character: 23,
                event: 11,
                faction: 6,
                knowledge: 2,
                relationship: 4,
                rule: 14,
                secret: 15,
            },
            timelineAnchorCount: 25,
            timelineWindowCount: 25,
            tagCount: 255,
            entityCount: 26,
        },
    },
    {
        packId: 'star-trek-tng-season-2',
        title: 'Star Trek TNG Season 2',
        description: 'Draft season Loredeck for Pulaski and Guinan, Ten Forward, Data personhood, Moriarty, Klingon exchange, Q-forced Borg first contact, Picard artificial-heart vulnerability, and season 2 spoiler guards.',
        era: 'The Next Generation Season 2',
        familyOrder: 20,
        libraryPath: ['Star Trek', 'The Next Generation'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:tng',
            'season:tng-s2',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 70,
            categoryCounts: {
                character: 15,
                event: 17,
                faction: 4,
                relationship: 7,
                rule: 9,
                secret: 18,
            },
            timelineAnchorCount: 22,
            timelineWindowCount: 22,
            tagCount: 251,
            entityCount: 36,
        },
    },
    {
        packId: 'star-trek-tng-season-3',
        title: 'Star Trek TNG Season 3',
        description: 'Draft season Loredeck for the mature Enterprise-D baseline, Romulan pressure, Data/Lal, Worf/Kurn/Duras, Barclay, Sarek, Yesterday\'s Enterprise, and the Borg cliffhanger.',
        era: 'The Next Generation Season 3',
        familyOrder: 30,
        libraryPath: ['Star Trek', 'The Next Generation'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:tng',
            'season:tng-s3',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 85,
            categoryCounts: {
                character: 20,
                event: 11,
                faction: 7,
                relationship: 6,
                rule: 11,
                secret: 30,
            },
            timelineAnchorCount: 26,
            timelineWindowCount: 26,
            tagCount: 322,
            entityCount: 58,
        },
    },
    {
        packId: 'star-trek-tng-season-4',
        title: 'Star Trek TNG Season 4',
        description: 'Draft season Loredeck for the Borg aftermath, Picard recovery, Soong/Lore, Klingon succession, Cardassian first contact, Drumhead, Trill/Odan, Mind\'s Eye, and the Redemption cliffhanger.',
        era: 'The Next Generation Season 4',
        familyOrder: 40,
        libraryPath: ['Star Trek', 'The Next Generation'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:tng',
            'season:tng-s4',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 85,
            categoryCounts: {
                character: 29,
                event: 26,
                faction: 2,
                secret: 28,
            },
            timelineAnchorCount: 26,
            timelineWindowCount: 26,
            tagCount: 218,
            entityCount: 66,
        },
    },
    {
        packId: 'star-trek-tng-season-5',
        title: 'Star Trek TNG Season 5',
        description: 'Draft season Loredeck for Star Trek: The Next Generation season 5, covering Redemption, Crystalline Entity, Vulcan/Romulan reunification, Hugh, Time\'s Arrow with season-local spoiler guards.',
        era: 'The Next Generation Season 5',
        familyOrder: 50,
        libraryPath: ['Star Trek', 'The Next Generation'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:tng',
            'season:tng-s5',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 83,
            categoryCounts: {
                character: 27,
                event: 27,
                faction: 1,
                rule: 1,
                secret: 27,
            },
            timelineAnchorCount: 26,
            timelineWindowCount: 26,
            tagCount: 257,
            entityCount: 68,
        },
    },
    {
        packId: 'star-trek-tng-season-6',
        title: 'Star Trek TNG Season 6',
        description: 'Draft season Loredeck for Star Trek: The Next Generation season 6, covering Time\'s Arrow, Chain Of Command, Professor James Moriarty, Vulcan/Romulan reunification, Birthright with season-local spoiler guards.',
        era: 'The Next Generation Season 6',
        familyOrder: 60,
        libraryPath: ['Star Trek', 'The Next Generation'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:tng',
            'season:tng-s6',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 83,
            categoryCounts: {
                character: 27,
                event: 27,
                faction: 1,
                rule: 1,
                secret: 27,
            },
            timelineAnchorCount: 26,
            timelineWindowCount: 26,
            tagCount: 256,
            entityCount: 67,
        },
    },
    {
        packId: 'star-trek-tng-season-7',
        title: 'Star Trek TNG Season 7',
        description: 'Draft season Loredeck for Star Trek: The Next Generation season 7, covering Descent, Gambit, Riker and the Pegasus, The Traveler, Worf vs. Duras with season-local spoiler guards.',
        era: 'The Next Generation Season 7',
        familyOrder: 70,
        libraryPath: ['Star Trek', 'The Next Generation'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:tng',
            'season:tng-s7',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 80,
            categoryCounts: {
                character: 26,
                event: 26,
                faction: 1,
                rule: 1,
                secret: 26,
            },
            timelineAnchorCount: 25,
            timelineWindowCount: 25,
            tagCount: 239,
            entityCount: 60,
        },
    },
    {
        packId: 'star-trek-ds9-season-1',
        title: 'Star Trek DS9 Season 1',
        description: 'Draft season Loredeck for Deep Space Nine season 1, covering Sisko as Emissary, post-occupation Bajor, Cardassian pressure, the wormhole and Prophets, Odo, Dax, Ferengi station politics, Duet, and season-local spoiler guards.',
        era: 'Deep Space Nine Season 1',
        familyOrder: 110,
        libraryPath: ['Star Trek', 'Deep Space Nine'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:ds9',
            'season:ds9-s1',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 62,
            categoryCounts: {
                character: 20,
                event: 20,
                faction: 1,
                rule: 1,
                secret: 20,
            },
            timelineAnchorCount: 19,
            timelineWindowCount: 19,
            tagCount: 182,
            entityCount: 53,
        },
    },
    {
        packId: 'star-trek-ds9-season-2',
        title: 'Star Trek DS9 Season 2',
        description: 'Draft season Loredeck for Star Trek: Deep Space Nine season 2, covering Bajoran coup d\'etat, The Maquis, Mirror universe, Dominion introduction with season-local spoiler guards.',
        era: 'Deep Space Nine Season 2',
        familyOrder: 120,
        libraryPath: ['Star Trek', 'Deep Space Nine'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:ds9',
            'season:ds9-s2',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 83,
            categoryCounts: {
                character: 27,
                event: 27,
                faction: 1,
                rule: 1,
                secret: 27,
            },
            timelineAnchorCount: 26,
            timelineWindowCount: 26,
            tagCount: 224,
            entityCount: 64,
        },
    },
    {
        packId: 'star-trek-ds9-season-3',
        title: 'Star Trek DS9 Season 3',
        description: 'Draft season Loredeck for Star Trek: Deep Space Nine season 3, covering Dominion introduction, Quark and Grilka, Thomas Riker, Past Tense, Mirror universe with season-local spoiler guards.',
        era: 'Deep Space Nine Season 3',
        familyOrder: 130,
        libraryPath: ['Star Trek', 'Deep Space Nine'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:ds9',
            'season:ds9-s3',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 83,
            categoryCounts: {
                character: 27,
                event: 27,
                faction: 1,
                rule: 1,
                secret: 27,
            },
            timelineAnchorCount: 26,
            timelineWindowCount: 26,
            tagCount: 209,
            entityCount: 56,
        },
    },
    {
        packId: 'star-trek-ds9-season-4',
        title: 'Star Trek DS9 Season 4',
        description: 'Draft season Loredeck for Star Trek: Deep Space Nine season 4, covering Changeling infiltration, Worf vs. Duras, Starfleet coup, Klingon War, Mirror universe with season-local spoiler guards.',
        era: 'Deep Space Nine Season 4',
        familyOrder: 140,
        libraryPath: ['Star Trek', 'Deep Space Nine'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:ds9',
            'season:ds9-s4',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 80,
            categoryCounts: {
                character: 26,
                event: 26,
                faction: 1,
                rule: 1,
                secret: 26,
            },
            timelineAnchorCount: 25,
            timelineWindowCount: 25,
            tagCount: 207,
            entityCount: 56,
        },
    },
    {
        packId: 'star-trek-ds9-season-5',
        title: 'Star Trek DS9 Season 5',
        description: 'Draft season Loredeck for Star Trek: Deep Space Nine season 5, covering Changeling infiltration, Quark and Grilka, Klingon War, Tribble troubles, Eddington vs. Sisko with season-local spoiler guards.',
        era: 'Deep Space Nine Season 5',
        familyOrder: 150,
        libraryPath: ['Star Trek', 'Deep Space Nine'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:ds9',
            'season:ds9-s5',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 83,
            categoryCounts: {
                character: 27,
                event: 27,
                faction: 1,
                rule: 1,
                secret: 27,
            },
            timelineAnchorCount: 26,
            timelineWindowCount: 26,
            tagCount: 207,
            entityCount: 54,
        },
    },
    {
        packId: 'star-trek-ds9-season-6',
        title: 'Star Trek DS9 Season 6',
        description: 'Draft season Loredeck for Star Trek: Deep Space Nine season 6, covering Dominion invasion, Mirror universe, Section 31 and Julian Bashir, The death of Jadzia and the Sisko\'s purpose with season-local spoiler guards.',
        era: 'Deep Space Nine Season 6',
        familyOrder: 160,
        libraryPath: ['Star Trek', 'Deep Space Nine'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:ds9',
            'season:ds9-s6',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 83,
            categoryCounts: {
                character: 27,
                event: 27,
                faction: 1,
                rule: 1,
                secret: 27,
            },
            timelineAnchorCount: 26,
            timelineWindowCount: 26,
            tagCount: 207,
            entityCount: 58,
        },
    },
    {
        packId: 'star-trek-ds9-season-7',
        title: 'Star Trek DS9 Season 7',
        description: 'Draft season Loredeck for Star Trek: Deep Space Nine season 7, covering The death of Jadzia and the Sisko\'s purpose, Nog and AR-558, Mirror universe, Section 31 and Julian Bashir, The Final Chapter with season-local spoiler guards.',
        era: 'Deep Space Nine Season 7',
        familyOrder: 170,
        libraryPath: ['Star Trek', 'Deep Space Nine'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:ds9',
            'season:ds9-s7',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 80,
            categoryCounts: {
                character: 26,
                event: 26,
                faction: 1,
                rule: 1,
                secret: 26,
            },
            timelineAnchorCount: 25,
            timelineWindowCount: 25,
            tagCount: 197,
            entityCount: 54,
        },
    },
    {
        packId: 'star-trek-voy-season-1',
        title: 'Star Trek Voyager Season 1',
        description: 'Draft season Loredeck for Voyager season 1, covering the Caretaker displacement, stranded Starfleet and Maquis crew integration, Kazon and Vidiian pressure, the Delta Quadrant survival baseline, Seska, and season-local spoiler guards.',
        era: 'Voyager Season 1',
        familyOrder: 210,
        libraryPath: ['Star Trek', 'Voyager'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:voy',
            'season:voy-s1',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 65,
            categoryCounts: {
                character: 16,
                event: 16,
                faction: 1,
                rule: 16,
                secret: 16,
            },
            timelineAnchorCount: 15,
            timelineWindowCount: 15,
            tagCount: 139,
            entityCount: 27,
        },
    },
    {
        packId: 'star-trek-voy-season-2',
        title: 'Star Trek Voyager Season 2',
        description: 'Draft season Loredeck for Star Trek: Voyager season 2, covering Seska, Suder\'s Penance, Q Civil War, Basics with season-local spoiler guards.',
        era: 'Voyager Season 2',
        familyOrder: 220,
        libraryPath: ['Star Trek', 'Voyager'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:voy',
            'season:voy-s2',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 83,
            categoryCounts: {
                character: 27,
                event: 27,
                faction: 1,
                rule: 1,
                secret: 27,
            },
            timelineAnchorCount: 26,
            timelineWindowCount: 26,
            tagCount: 190,
            entityCount: 37,
        },
    },
    {
        packId: 'star-trek-voy-season-3',
        title: 'Star Trek Voyager Season 3',
        description: 'Draft season Loredeck for Star Trek: Voyager season 3, covering Basics, Arridor and Kol, Future\'s End, Q Civil War, Nekrit Expanse with season-local spoiler guards.',
        era: 'Voyager Season 3',
        familyOrder: 230,
        libraryPath: ['Star Trek', 'Voyager'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:voy',
            'season:voy-s3',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 83,
            categoryCounts: {
                character: 27,
                event: 27,
                faction: 1,
                rule: 1,
                secret: 27,
            },
            timelineAnchorCount: 26,
            timelineWindowCount: 26,
            tagCount: 244,
            entityCount: 57,
        },
    },
    {
        packId: 'star-trek-voy-season-4',
        title: 'Star Trek Voyager Season 4',
        description: 'Draft season Loredeck for Star Trek: Voyager season 4, covering Scorpion, Year of Hell, The Killing Game, The Silver Blood with season-local spoiler guards.',
        era: 'Voyager Season 4',
        familyOrder: 240,
        libraryPath: ['Star Trek', 'Voyager'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:voy',
            'season:voy-s4',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 83,
            categoryCounts: {
                character: 27,
                event: 27,
                faction: 1,
                rule: 1,
                secret: 27,
            },
            timelineAnchorCount: 26,
            timelineWindowCount: 26,
            tagCount: 196,
            entityCount: 37,
        },
    },
    {
        packId: 'star-trek-voy-season-5',
        title: 'Star Trek Voyager Season 5',
        description: 'Draft season Loredeck for Star Trek: Voyager season 5, covering The Silver Blood, Future\'s End, Equinox with season-local spoiler guards.',
        era: 'Voyager Season 5',
        familyOrder: 250,
        libraryPath: ['Star Trek', 'Voyager'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:voy',
            'season:voy-s5',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 80,
            categoryCounts: {
                character: 26,
                event: 26,
                faction: 1,
                rule: 1,
                secret: 26,
            },
            timelineAnchorCount: 25,
            timelineWindowCount: 25,
            tagCount: 206,
            entityCount: 42,
        },
    },
    {
        packId: 'star-trek-voy-season-6',
        title: 'Star Trek Voyager Season 6',
        description: 'Draft season Loredeck for Star Trek: Voyager season 6, covering Equinox, The Pathfinder Project, Fair Haven, Unimatrix Zero with season-local spoiler guards.',
        era: 'Voyager Season 6',
        familyOrder: 260,
        libraryPath: ['Star Trek', 'Voyager'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:voy',
            'season:voy-s6',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 83,
            categoryCounts: {
                character: 27,
                event: 27,
                faction: 1,
                rule: 1,
                secret: 27,
            },
            timelineAnchorCount: 26,
            timelineWindowCount: 26,
            tagCount: 227,
            entityCount: 50,
        },
    },
    {
        packId: 'star-trek-voy-season-7',
        title: 'Star Trek Voyager Season 7',
        description: 'Draft season Loredeck for Star Trek: Voyager season 7, covering Unimatrix Zero, The Pathfinder Project, The Killing Game, Seska, Workforce with season-local spoiler guards.',
        era: 'Voyager Season 7',
        familyOrder: 270,
        libraryPath: ['Star Trek', 'Voyager'],
        tags: [
            'fandom:star-trek',
            'continuity:star-trek-prime',
            'series:voy',
            'season:voy-s7',
            'structure:season-split-loredeck',
            'quality:draft-reference',
        ],
        stats: {
            entryCount: 77,
            categoryCounts: {
                character: 25,
                event: 25,
                faction: 1,
                rule: 1,
                secret: 25,
            },
            timelineAnchorCount: 24,
            timelineWindowCount: 24,
            tagCount: 201,
            entityCount: 43,
        },
    },
]);

const STAR_WARS_LEGENDS_LOREDECKS = Object.freeze([
    {
        packId: 'sw-legends-core',
        title: 'Star Wars Legends: Core',
        description: 'Reusable Star Wars Legends foundation lore: continuity boundaries, Force rules, major factions, galaxy structure, technology, species/culture constraints, and spoiler-safe baseline guards for Saga Loredeck stacks.',
        era: 'Legends Core',
        familyOrder: 10,
        tags: ['fandom:star-wars', 'continuity:legends', 'structure:split-loredeck', 'quality:draft', 'scope:core', 'density:core-expanded'],
        assets: {
            cover: {
                path: 'assets/cover.jpg',
                alt: 'Deck cover for Star Wars Legends: Core',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
        },
        stats: {
            entryCount: 108,
            categoryCounts: { character: 5, faction: 28, item: 13, knowledge: 13, location: 11, relationship: 2, rule: 32, secret: 4 },
            timelineAnchorCount: 17,
            timelineWindowCount: 15,
            tagCount: 144,
            entityCount: 49,
            timelinePhaseCount: 6,
        },
    },
    {
        packId: 'sw-legends-film-spine',
        title: 'Star Wars Legends: Film Spine',
        description: 'Expanded Episode I-VI anchor deck for Legends-compatible story-position gates, especially before/after movie and major-event windows.',
        era: 'Film Spine: Episodes I-VI',
        familyOrder: 20,
        tags: ['fandom:star-wars', 'continuity:legends', 'structure:split-loredeck', 'quality:draft', 'scope:film-spine'],
        assets: {
            cover: {
                path: 'assets/cover.jpg',
                alt: 'Deck cover for Star Wars Legends: Film Spine',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
        },
        stats: {
            entryCount: 123,
            categoryCounts: { character: 18, event: 25, faction: 10, item: 5, knowledge: 12, location: 5, relationship: 10, rule: 9, secret: 26, timeline: 3 },
            timelineAnchorCount: 40,
            timelineWindowCount: 17,
            timelinePhaseCount: 5,
            tagCount: 112,
            entityCount: 57,
        },
    },
    {
        packId: 'sw-legends-old-republic',
        title: 'Star Wars Legends: Old Republic',
        description: 'Legends Old Republic deck covering ancient Sith/Jedi foundations, Tales of the Jedi context, Mandalorian Wars, KOTOR, KOTOR II, SWTOR-era conflicts, and late Old Republic spoiler guards.',
        era: 'Old Republic: ancient Sith through SWTOR and late pre-Ruusan transition',
        familyOrder: 30,
        tags: ['fandom:star-wars', 'continuity:legends', 'structure:split-loredeck', 'quality:draft', 'scope:era', 'scope:old-republic'],
        assets: {
            cover: {
                path: 'assets/cover.jpg',
                alt: 'Deck cover for Star Wars Legends: Old Republic',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
        },
        stats: {
            entryCount: 106,
            categoryCounts: { character: 20, event: 14, faction: 16, item: 8, knowledge: 10, location: 14, relationship: 2, rule: 16, secret: 5, timeline: 1 },
            timelineAnchorCount: 22,
            timelineWindowCount: 11,
            tagCount: 353,
            entityCount: 73,
            timelinePhaseCount: 3,
        },
    },
    {
        packId: 'sw-legends-rise-of-empire',
        title: 'Star Wars Legends: Rise of Empire',
        description: 'Legends late-Republic and Clone Wars deck covering the Naboo crisis, Separatist crisis, Clone Wars multimedia-era state, Revenge of the Sith transition, Order 66, Jedi Purge, and early Imperial consolidation.',
        era: 'Rise of Empire: late Republic, Clone Wars, Order 66, and early Empire',
        familyOrder: 40,
        tags: ['fandom:star-wars', 'continuity:legends', 'structure:split-loredeck', 'quality:draft', 'scope:era', 'scope:rise-of-empire'],
        assets: {
            cover: {
                path: 'assets/cover.jpg',
                alt: 'Deck cover for Star Wars Legends: Rise of Empire',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
        },
        stats: {
            entryCount: 155,
            categoryCounts: { character: 36, event: 8, faction: 30, item: 14, knowledge: 17, location: 15, relationship: 2, rule: 4, secret: 28, timeline: 1 },
            tagCount: 388,
            entityCount: 100,
            timelineAnchorCount: 25,
            timelineWindowCount: 15,
            timelinePhaseCount: 1,
        },
    },
    {
        packId: 'sw-legends-rebellion-era',
        title: 'Star Wars Legends: Rebellion Era',
        description: 'Legends-compatible Galactic Civil War era deck focused on Original Trilogy story state, Rebel/Imperial pressure, ESB-to-ROTJ windows, Shadows-adjacent Legends support, and spoiler-safe future guards.',
        era: 'Rebellion Era: Original Trilogy',
        familyOrder: 50,
        tags: ['fandom:star-wars', 'continuity:legends', 'structure:split-loredeck', 'quality:draft', 'scope:era'],
        assets: {
            cover: {
                path: 'assets/cover.jpg',
                alt: 'Deck cover for Star Wars Legends: Rebellion Era',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
        },
        stats: {
            entryCount: 148,
            categoryCounts: { character: 46, event: 25, faction: 13, item: 16, knowledge: 16, location: 10, relationship: 10, rule: 4, secret: 8 },
            timelineAnchorCount: 30,
            timelineWindowCount: 15,
            tagCount: 145,
            entityCount: 47,
            timelinePhaseCount: 5,
        },
    },
    {
        packId: 'sw-legends-new-republic',
        title: 'Star Wars Legends: New Republic',
        description: 'Post-Endor Legends deck covering the New Republic, Imperial Remnant, Thrawn campaign, Dark Empire, Jedi Academy, Hand of Thrawn, and pre-NJO spoiler guards.',
        era: 'New Republic: Post-Endor through Hand of Thrawn',
        familyOrder: 60,
        tags: ['fandom:star-wars', 'continuity:legends', 'structure:split-loredeck', 'quality:draft', 'scope:era', 'scope:new-republic'],
        assets: {
            cover: {
                path: 'assets/cover.jpg',
                alt: 'Deck cover for Star Wars Legends: New Republic',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
        },
        stats: {
            entryCount: 143,
            categoryCounts: { character: 31, event: 14, faction: 22, item: 18, knowledge: 12, location: 15, relationship: 9, rule: 16, secret: 5, timeline: 1 },
            timelineAnchorCount: 29,
            timelineWindowCount: 17,
            tagCount: 142,
            entityCount: 82,
            timelinePhaseCount: 7,
        },
    },
    {
        packId: 'sw-legends-new-jedi-order',
        title: 'Star Wars Legends: New Jedi Order',
        description: 'Legends New Jedi Order deck covering the Yuuzhan Vong War from Vector Prime through The Unifying Force, including Jedi crisis, Vong biotechnology, Coruscant fall, Galactic Alliance transition, and spoiler guards.',
        era: 'New Jedi Order / Yuuzhan Vong War',
        familyOrder: 70,
        tags: ['fandom:star-wars', 'continuity:legends', 'structure:split-loredeck', 'quality:draft', 'scope:era', 'scope:njo'],
        assets: {
            cover: {
                path: 'assets/cover.jpg',
                alt: 'Deck cover for Star Wars Legends: New Jedi Order',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
        },
        stats: {
            entryCount: 141,
            categoryCounts: { character: 20, event: 21, faction: 14, item: 16, knowledge: 39, location: 10, relationship: 8, rule: 13 },
            timelineAnchorCount: 22,
            timelineWindowCount: 18,
            tagCount: 108,
            entityCount: 61,
            timelinePhaseCount: 8,
        },
    },
    {
        packId: 'sw-legends-late-post-endor',
        title: 'Star Wars Legends: Late Post-Endor',
        description: 'Late post-Endor Legends deck covering Dark Nest, Legacy of the Force, Fate of the Jedi, Abeloth/Lost Tribe material, Caedus-era family rupture, and Crucible-era transition guards.',
        era: 'Late Post-Endor / Dark Nest to Crucible',
        familyOrder: 80,
        tags: ['fandom:star-wars', 'continuity:legends', 'structure:split-loredeck', 'quality:draft', 'scope:era', 'scope:late-post-endor'],
        assets: {
            cover: {
                path: 'assets/cover.jpg',
                alt: 'Deck cover for Star Wars Legends: Late Post-Endor',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
        },
        stats: {
            entryCount: 139,
            categoryCounts: { character: 27, event: 31, faction: 14, item: 2, knowledge: 20, location: 6, relationship: 12, rule: 16, secret: 1, timeline: 10 },
            timelineAnchorCount: 25,
            timelineWindowCount: 20,
            tagCount: 108,
            entityCount: 53,
            timelinePhaseCount: 9,
        },
    },
    {
        packId: 'sw-legends-legacy-comics',
        title: 'Star Wars Legends: Legacy Comics',
        description: "Far-future Legends deck covering Star Wars: Legacy volume 1 and volume 2: Cade Skywalker, Darth Krayt's One Sith, Fel Imperial schism, Galactic Alliance Remnant, Jedi survivors, Imperial Knights, and Ania Solo-era fallout.",
        era: 'Legacy Comics / Far-Future Legends',
        familyOrder: 90,
        tags: ['fandom:star-wars', 'continuity:legends', 'structure:split-loredeck', 'quality:draft', 'scope:era', 'scope:legacy-comics'],
        assets: {
            cover: {
                path: 'assets/cover.jpg',
                alt: 'Deck cover for Star Wars Legends: Legacy Comics',
                aspect: '1:1',
                focalPoint: { x: 0.5, y: 0.5 },
            },
        },
        stats: {
            entryCount: 144,
            categoryCounts: { character: 30, event: 32, faction: 12, item: 6, knowledge: 29, location: 8, relationship: 10, rule: 9, secret: 2, timeline: 6 },
            timelineAnchorCount: 29,
            timelineWindowCount: 16,
            tagCount: 263,
            entityCount: 75,
            timelinePhaseCount: 2,
        },
    },
]);

function buildBundledLoredeckRecord(deck, options = {}) {
    const libraryPath = Array.isArray(deck.libraryPath) ? deck.libraryPath : (options.libraryPath || []);
    const updatedAt = Number.isFinite(Number(options.updatedAt)) ? Number(options.updatedAt) : 0;
    const fallbackAssets = options.defaultAssets === false
        ? null
        : {
            cover: {
                path: 'assets/cover.png',
                alt: `${deck.title} Loredeck cover`,
            },
        };
    const assets = deck.assets || fallbackAssets;
    const record = {
        packId: deck.packId,
        type: 'bundled',
        title: deck.title,
        description: deck.description,
        fandom: options.fandom || '',
        era: deck.era,
        author: 'Saga',
        version: deck.version || options.version || '0.1.0',
        entrySchemaVersion: 3,
        manifest: `content/loredecks/${deck.packId}/loredeck.json`,
        source: options.source || { kind: 'bundled', url: '' },
        tags: deck.tags,
        library: {
            suggestedPath: libraryPath,
            familyOrder: deck.familyOrder,
        },
        stats: deck.stats,
        installedAt: updatedAt,
        updatedAt,
    };
    if (assets && typeof assets === 'object' && !Array.isArray(assets) && Object.keys(assets).length) {
        record.assets = assets;
    }
    return Object.freeze(record);
}

function buildHpLoredeckRecord(deck) {
    return buildBundledLoredeckRecord(deck, {
        fandom: 'Harry Potter',
        version: '0.2.0',
        source: HP_SOURCE,
        libraryPath: HP_LIBRARY_PATH,
        updatedAt: DEFAULT_HP_LOREDECK_UPDATED_AT,
    });
}

function buildLotrLoredeckRecord(deck) {
    return buildBundledLoredeckRecord(deck, {
        fandom: 'Middle-earth',
        version: '0.8.0',
        source: LOTR_SOURCE,
        libraryPath: LOTR_LIBRARY_PATH,
        updatedAt: DEFAULT_LOTR_LOREDECK_UPDATED_AT,
    });
}

function buildMhaLoredeckRecord(deck) {
    return buildBundledLoredeckRecord(deck, {
        fandom: 'My Hero Academia',
        version: '0.11.0',
        source: MHA_SOURCE,
        libraryPath: MHA_LIBRARY_PATH,
        updatedAt: DEFAULT_MHA_LOREDECK_UPDATED_AT,
    });
}

function buildJjkLoredeckRecord(deck) {
    return buildBundledLoredeckRecord(deck, {
        fandom: 'Jujutsu Kaisen',
        version: '0.2.0-phase1',
        source: JJK_SOURCE,
        libraryPath: JJK_LIBRARY_PATH,
        updatedAt: DEFAULT_JJK_LOREDECK_UPDATED_AT,
        defaultAssets: false,
    });
}

function buildOnePieceLoredeckRecord(deck) {
    const packId = String(deck?.packId || '').trim();
    return buildBundledLoredeckRecord({
        ...deck,
        version: ONE_PIECE_LOREDECK_VERSION_OVERRIDES[packId] || deck.version,
    }, {
        fandom: 'One Piece',
        version: '0.4.0-development-pass',
        source: ONE_PIECE_SOURCE,
        libraryPath: ONE_PIECE_LIBRARY_PATH,
        updatedAt: DEFAULT_ONE_PIECE_LOREDECK_UPDATED_AT,
        defaultAssets: false,
    });
}

function buildStarTrekLoredeckRecord(deck) {
    const packId = String(deck?.packId || '').trim();
    return buildBundledLoredeckRecord({
        ...deck,
        description: STAR_TREK_LOREDECK_DESCRIPTION_OVERRIDES[packId] || deck.description,
    }, {
        fandom: 'Star Trek',
        version: '0.1.0-dev',
        source: STAR_TREK_SOURCE,
        libraryPath: STAR_TREK_LIBRARY_PATH,
        updatedAt: DEFAULT_STAR_TREK_LOREDECK_UPDATED_AT,
        defaultAssets: false,
    });
}

function buildStarWarsLegendsLoredeckRecord(deck) {
    return buildBundledLoredeckRecord(deck, {
        fandom: 'Star Wars',
        version: '1.1.0-dev',
        source: STAR_WARS_LEGENDS_SOURCE,
        libraryPath: STAR_WARS_LEGENDS_LIBRARY_PATH,
        updatedAt: DEFAULT_STAR_WARS_LEGENDS_LOREDECK_UPDATED_AT,
    });
}

function buildLoredeckContext(deck, contextType = 'custom') {
    return Object.freeze({
        schemaVersion: 1,
        packId: deck.packId,
        contextType,
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

function buildHpLoredeckContext(deck) {
    return buildLoredeckContext(deck, 'calendar');
}

function buildLotrLoredeckContext(deck) {
    return buildLoredeckContext(deck, 'anchor_window');
}

function buildMhaLoredeckContext(deck) {
    return buildLoredeckContext(deck, 'anchor_window');
}

function buildJjkLoredeckContext(deck) {
    return buildLoredeckContext(deck, 'anchor_window');
}

function buildOnePieceLoredeckContext(deck) {
    return buildLoredeckContext(deck, 'anchor_window');
}

function buildStarTrekLoredeckContext(deck) {
    return buildLoredeckContext(deck, 'anchor_window');
}

function buildStarWarsLegendsLoredeckContext(deck) {
    return buildLoredeckContext(deck, 'anchor_window');
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
export const DEFAULT_LOTR_LOREDECK_LIBRARY_RECORDS = Object.freeze(LOTR_SPLIT_LOREDECKS.map(buildLotrLoredeckRecord));
export const DEFAULT_LOTR_LOREDECK_LIBRARY_PACKS = Object.freeze(Object.fromEntries(
    DEFAULT_LOTR_LOREDECK_LIBRARY_RECORDS.map(record => [record.packId, record])
));
export const DEFAULT_LOTR_LOREDECK_CONTEXTS = Object.freeze(Object.fromEntries(
    LOTR_SPLIT_LOREDECKS.map(deck => [deck.packId, buildLotrLoredeckContext(deck)])
));
export const DEFAULT_LOTR_LOREDECK_IDS = Object.freeze(LOTR_SPLIT_LOREDECKS.map(deck => deck.packId));
export const DEFAULT_MHA_LOREDECK_LIBRARY_RECORDS = Object.freeze(MHA_SPLIT_LOREDECKS.map(buildMhaLoredeckRecord));
export const DEFAULT_MHA_LOREDECK_LIBRARY_PACKS = Object.freeze(Object.fromEntries(
    DEFAULT_MHA_LOREDECK_LIBRARY_RECORDS.map(record => [record.packId, record])
));
export const DEFAULT_MHA_LOREDECK_CONTEXTS = Object.freeze(Object.fromEntries(
    MHA_SPLIT_LOREDECKS.map(deck => [deck.packId, buildMhaLoredeckContext(deck)])
));
export const DEFAULT_MHA_LOREDECK_IDS = Object.freeze(MHA_SPLIT_LOREDECKS.map(deck => deck.packId));
export const DEFAULT_JJK_LOREDECK_LIBRARY_RECORDS = Object.freeze(JJK_SPLIT_LOREDECKS.map(buildJjkLoredeckRecord));
export const DEFAULT_JJK_LOREDECK_LIBRARY_PACKS = Object.freeze(Object.fromEntries(
    DEFAULT_JJK_LOREDECK_LIBRARY_RECORDS.map(record => [record.packId, record])
));
export const DEFAULT_JJK_LOREDECK_CONTEXTS = Object.freeze(Object.fromEntries(
    JJK_SPLIT_LOREDECKS.map(deck => [deck.packId, buildJjkLoredeckContext(deck)])
));
export const DEFAULT_JJK_LOREDECK_IDS = Object.freeze(JJK_SPLIT_LOREDECKS.map(deck => deck.packId));
export const DEFAULT_ONE_PIECE_LOREDECK_LIBRARY_RECORDS = Object.freeze(ONE_PIECE_ARC_LOREDECKS_BY_STORY_ORDER.map(buildOnePieceLoredeckRecord));
export const DEFAULT_ONE_PIECE_LOREDECK_LIBRARY_PACKS = Object.freeze(Object.fromEntries(
    DEFAULT_ONE_PIECE_LOREDECK_LIBRARY_RECORDS.map(record => [record.packId, record])
));
export const DEFAULT_ONE_PIECE_LOREDECK_CONTEXTS = Object.freeze(Object.fromEntries(
    ONE_PIECE_ARC_LOREDECKS_BY_STORY_ORDER.map(deck => [deck.packId, buildOnePieceLoredeckContext(deck)])
));
export const DEFAULT_ONE_PIECE_LOREDECK_IDS = Object.freeze(ONE_PIECE_ARC_LOREDECKS_BY_STORY_ORDER.map(deck => deck.packId));
export const DEFAULT_STAR_TREK_LOREDECK_LIBRARY_RECORDS = Object.freeze(STAR_TREK_LOREDECKS.map(buildStarTrekLoredeckRecord));
export const DEFAULT_STAR_TREK_LOREDECK_LIBRARY_PACKS = Object.freeze(Object.fromEntries(
    DEFAULT_STAR_TREK_LOREDECK_LIBRARY_RECORDS.map(record => [record.packId, record])
));
export const DEFAULT_STAR_TREK_LOREDECK_CONTEXTS = Object.freeze(Object.fromEntries(
    STAR_TREK_LOREDECKS.map(deck => [deck.packId, buildStarTrekLoredeckContext(deck)])
));
export const DEFAULT_STAR_TREK_LOREDECK_IDS = Object.freeze(STAR_TREK_LOREDECKS.map(deck => deck.packId));
export const DEFAULT_STAR_WARS_LEGENDS_LOREDECK_LIBRARY_RECORDS = Object.freeze(STAR_WARS_LEGENDS_LOREDECKS.map(buildStarWarsLegendsLoredeckRecord));
export const DEFAULT_STAR_WARS_LEGENDS_LOREDECK_LIBRARY_PACKS = Object.freeze(Object.fromEntries(
    DEFAULT_STAR_WARS_LEGENDS_LOREDECK_LIBRARY_RECORDS.map(record => [record.packId, record])
));
export const DEFAULT_STAR_WARS_LEGENDS_LOREDECK_CONTEXTS = Object.freeze(Object.fromEntries(
    STAR_WARS_LEGENDS_LOREDECKS.map(deck => [deck.packId, buildStarWarsLegendsLoredeckContext(deck)])
));
export const DEFAULT_STAR_WARS_LEGENDS_LOREDECK_IDS = Object.freeze(STAR_WARS_LEGENDS_LOREDECKS.map(deck => deck.packId));
export const DEFAULT_BUNDLED_LOREDECK_LIBRARY_RECORDS = Object.freeze([
    ...DEFAULT_HP_LOREDECK_LIBRARY_RECORDS,
    ...DEFAULT_LOTR_LOREDECK_LIBRARY_RECORDS,
    ...DEFAULT_MHA_LOREDECK_LIBRARY_RECORDS,
    ...DEFAULT_JJK_LOREDECK_LIBRARY_RECORDS,
    ...DEFAULT_ONE_PIECE_LOREDECK_LIBRARY_RECORDS,
    ...DEFAULT_STAR_TREK_LOREDECK_LIBRARY_RECORDS,
    ...DEFAULT_STAR_WARS_LEGENDS_LOREDECK_LIBRARY_RECORDS,
]);
export const DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS = Object.freeze({
    ...DEFAULT_HP_LOREDECK_LIBRARY_PACKS,
    ...DEFAULT_LOTR_LOREDECK_LIBRARY_PACKS,
    ...DEFAULT_MHA_LOREDECK_LIBRARY_PACKS,
    ...DEFAULT_JJK_LOREDECK_LIBRARY_PACKS,
    ...DEFAULT_ONE_PIECE_LOREDECK_LIBRARY_PACKS,
    ...DEFAULT_STAR_TREK_LOREDECK_LIBRARY_PACKS,
    ...DEFAULT_STAR_WARS_LEGENDS_LOREDECK_LIBRARY_PACKS,
});
export const DEFAULT_BUNDLED_LOREDECK_CONTEXTS = Object.freeze({
    ...DEFAULT_HP_LOREDECK_CONTEXTS,
    ...DEFAULT_LOTR_LOREDECK_CONTEXTS,
    ...DEFAULT_MHA_LOREDECK_CONTEXTS,
    ...DEFAULT_JJK_LOREDECK_CONTEXTS,
    ...DEFAULT_ONE_PIECE_LOREDECK_CONTEXTS,
    ...DEFAULT_STAR_TREK_LOREDECK_CONTEXTS,
    ...DEFAULT_STAR_WARS_LEGENDS_LOREDECK_CONTEXTS,
});
export const DEFAULT_BUNDLED_LOREDECK_IDS = Object.freeze([
    ...DEFAULT_HP_LOREDECK_IDS,
    ...DEFAULT_LOTR_LOREDECK_IDS,
    ...DEFAULT_MHA_LOREDECK_IDS,
    ...DEFAULT_JJK_LOREDECK_IDS,
    ...DEFAULT_ONE_PIECE_LOREDECK_IDS,
    ...DEFAULT_STAR_TREK_LOREDECK_IDS,
    ...DEFAULT_STAR_WARS_LEGENDS_LOREDECK_IDS,
]);

const DEFAULT_LOREDECK_CONTEXT_TYPES = Object.freeze({
    ...Object.fromEntries(DEFAULT_HP_LOREDECK_IDS.map(id => [id, 'calendar'])),
    ...Object.fromEntries(DEFAULT_LOTR_LOREDECK_IDS.map(id => [id, 'anchor_window'])),
    ...Object.fromEntries(DEFAULT_MHA_LOREDECK_IDS.map(id => [id, 'anchor_window'])),
    ...Object.fromEntries(DEFAULT_JJK_LOREDECK_IDS.map(id => [id, 'anchor_window'])),
    ...Object.fromEntries(DEFAULT_ONE_PIECE_LOREDECK_IDS.map(id => [id, 'anchor_window'])),
    ...Object.fromEntries(DEFAULT_STAR_TREK_LOREDECK_IDS.map(id => [id, 'anchor_window'])),
    ...Object.fromEntries(DEFAULT_STAR_WARS_LEGENDS_LOREDECK_IDS.map(id => [id, 'anchor_window'])),
});

export function isDefaultHarryPotterLoredeckId(packId = '') {
    return DEFAULT_HP_LOREDECK_IDS.includes(String(packId || '').trim());
}

export function isDefaultLordOfTheRingsLoredeckId(packId = '') {
    return DEFAULT_LOTR_LOREDECK_IDS.includes(String(packId || '').trim());
}

export function isDefaultMyHeroAcademiaLoredeckId(packId = '') {
    return DEFAULT_MHA_LOREDECK_IDS.includes(String(packId || '').trim());
}

export function isDefaultJujutsuKaisenLoredeckId(packId = '') {
    return DEFAULT_JJK_LOREDECK_IDS.includes(String(packId || '').trim());
}

export function isDefaultOnePieceLoredeckId(packId = '') {
    return DEFAULT_ONE_PIECE_LOREDECK_IDS.includes(String(packId || '').trim());
}

export function isDefaultStarTrekLoredeckId(packId = '') {
    return DEFAULT_STAR_TREK_LOREDECK_IDS.includes(String(packId || '').trim());
}

export function isDefaultStarWarsLegendsLoredeckId(packId = '') {
    return DEFAULT_STAR_WARS_LEGENDS_LOREDECK_IDS.includes(String(packId || '').trim());
}

export function isDefaultBundledLoredeckId(packId = '') {
    return DEFAULT_BUNDLED_LOREDECK_IDS.includes(String(packId || '').trim());
}

export function getDefaultLoredeckContextType(packId = '', fallback = 'custom') {
    return DEFAULT_LOREDECK_CONTEXT_TYPES[String(packId || '').trim()] || fallback;
}
