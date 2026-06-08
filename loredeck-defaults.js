/**
 * loredeck-defaults.js -- Saga
 * Built-in Loredeck identifiers and fallback metadata.
 */

export const HP_LEGACY_LOREDECK_ID = 'hp-golden-trio';
export const DEFAULT_HP_LOREDECK_ID = 'hp-core';
export const DEFAULT_HP_LOREDECK_FOLDER_ID = 'folder_harry-potter__golden-trio';
export const DEFAULT_HP_LOREDECK_UPDATED_AT = 1780617600000;
export const DEFAULT_LOTR_LOREDECK_UPDATED_AT = 1780876800000;
export const DEFAULT_MHA_LOREDECK_UPDATED_AT = 1780876800000;

const HP_LIBRARY_PATH = Object.freeze(['Harry Potter', 'Golden Trio']);
const LOTR_LIBRARY_PATH = Object.freeze(['Lord of The Rings', 'War of the Ring']);
const MHA_LIBRARY_PATH = Object.freeze(['My Hero Academia', 'Manga Main']);
const HP_SOURCE = Object.freeze({ kind: 'bundled', url: '' });
const LOTR_SOURCE = Object.freeze({ kind: 'bundled', url: '' });
const MHA_SOURCE = Object.freeze({ kind: 'bundled', url: '' });

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
                aspect: '3:4',
                focalPoint: { x: 0.5, y: 0.42 },
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
                aspect: '3:4',
                focalPoint: { x: 0.5, y: 0.42 },
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
                aspect: '3:4',
                focalPoint: { x: 0.5, y: 0.42 },
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
        description: 'Context-gated War of the Ring lore for The Return of the King book arc, including Gondor, Rohan, Pelennor, Mordor, Mount Doom, Sauron’s fall, Scouring of the Shire, and the Grey Havens.',
        era: 'The Return of the King',
        familyOrder: 40,
        tags: ['fandom:middle-earth', 'era:war-of-the-ring', 'book:return-of-the-king', 'continuity:lotr-books', 'density:hp-reference-band', 'quality:reviewed-draft', 'density:volume-reference-candidate', 'quality:v8-density-pass'],
        assets: {
            cover: {
                path: 'assets/cover.png',
                alt: 'Deck cover for Middle-earth: The Return of the King',
                aspect: '3:4',
                focalPoint: { x: 0.5, y: 0.42 },
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

function buildBundledLoredeckRecord(deck, options = {}) {
    const libraryPath = options.libraryPath || [];
    const updatedAt = Number.isFinite(Number(options.updatedAt)) ? Number(options.updatedAt) : 0;
    return Object.freeze({
        packId: deck.packId,
        type: 'bundled',
        title: deck.title,
        description: deck.description,
        fandom: options.fandom || '',
        era: deck.era,
        author: 'Saga',
        version: options.version || '0.1.0',
        entrySchemaVersion: 3,
        manifest: `Loredecks/${deck.packId}/loredeck.json`,
        source: options.source || { kind: 'bundled', url: '' },
        tags: deck.tags,
        library: {
            suggestedPath: libraryPath,
            familyOrder: deck.familyOrder,
        },
        assets: deck.assets || {
            cover: {
                path: 'assets/cover.png',
                alt: `${deck.title} Loredeck cover`,
            },
        },
        stats: deck.stats,
        installedAt: updatedAt,
        updatedAt,
    });
}

function buildHpLoredeckRecord(deck) {
    return buildBundledLoredeckRecord(deck, {
        fandom: 'Harry Potter',
        version: '0.1.0',
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
export const DEFAULT_BUNDLED_LOREDECK_LIBRARY_RECORDS = Object.freeze([
    ...DEFAULT_HP_LOREDECK_LIBRARY_RECORDS,
    ...DEFAULT_LOTR_LOREDECK_LIBRARY_RECORDS,
    ...DEFAULT_MHA_LOREDECK_LIBRARY_RECORDS,
]);
export const DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS = Object.freeze({
    ...DEFAULT_HP_LOREDECK_LIBRARY_PACKS,
    ...DEFAULT_LOTR_LOREDECK_LIBRARY_PACKS,
    ...DEFAULT_MHA_LOREDECK_LIBRARY_PACKS,
});
export const DEFAULT_BUNDLED_LOREDECK_CONTEXTS = Object.freeze({
    ...DEFAULT_HP_LOREDECK_CONTEXTS,
    ...DEFAULT_LOTR_LOREDECK_CONTEXTS,
    ...DEFAULT_MHA_LOREDECK_CONTEXTS,
});
export const DEFAULT_BUNDLED_LOREDECK_IDS = Object.freeze([
    ...DEFAULT_HP_LOREDECK_IDS,
    ...DEFAULT_LOTR_LOREDECK_IDS,
    ...DEFAULT_MHA_LOREDECK_IDS,
]);

const DEFAULT_LOREDECK_CONTEXT_TYPES = Object.freeze({
    ...Object.fromEntries(DEFAULT_HP_LOREDECK_IDS.map(id => [id, 'calendar'])),
    ...Object.fromEntries(DEFAULT_LOTR_LOREDECK_IDS.map(id => [id, 'anchor_window'])),
    ...Object.fromEntries(DEFAULT_MHA_LOREDECK_IDS.map(id => [id, 'anchor_window'])),
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

export function isDefaultBundledLoredeckId(packId = '') {
    return DEFAULT_BUNDLED_LOREDECK_IDS.includes(String(packId || '').trim());
}

export function getDefaultLoredeckContextType(packId = '', fallback = 'custom') {
    return DEFAULT_LOREDECK_CONTEXT_TYPES[String(packId || '').trim()] || fallback;
}
