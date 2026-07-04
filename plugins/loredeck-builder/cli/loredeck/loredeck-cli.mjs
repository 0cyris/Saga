#!/usr/bin/env node
/**
 * loredeck-cli.mjs -- Saga
 * Umbrella CLI for authoring Saga Loredecks outside the app: workshop
 * projects, evidence review, staged review artifacts, Pack Health parity
 * validation, promotion, and .saga-loredeck.zip packaging.
 *
 * Usage: node tools/loredeck/loredeck-cli.mjs <command> [args] [--json]
 */

import { runInit } from './commands/init.mjs';
import { runStatus } from './commands/status.mjs';
import { runGate } from './commands/gate.mjs';
import { runBatch } from './commands/batch.mjs';
import { runEvidence } from './commands/evidence.mjs';
import { runReport } from './commands/report.mjs';
import { runHealth } from './commands/health.mjs';
import { runConformance } from './commands/conformance.mjs';
import { runStats } from './commands/stats.mjs';
import { runPromote } from './commands/promote.mjs';
import { runPackage } from './commands/package.mjs';
import { runVerifyPackage } from './commands/verify-package.mjs';

const COMMANDS = {
    init: { run: runInit, help: 'init <project-id> --title <title> [--size single|family] [--decks id:role,...]' },
    status: { run: runStatus, help: 'status <project-id> [--json]' },
    gate: { run: runGate, help: 'gate approve <project-id> [--note <note>] [--artifact <path>]' },
    batch: { run: runBatch, help: 'batch set <project-id> --deck <deck-id> --kind titles|cards --id <batch-id> --status draft|approved|rejected [--count N]' },
    evidence: { run: runEvidence, help: 'evidence validate|accept|reject <project-id> [--scope <scope>] [--ids a,b|--all] [--note <note>]' },
    report: { run: runReport, help: 'report <project-id> --stage brief|evidence|plan|titles|cards|final' },
    health: { run: runHealth, help: 'health <deck-dir|project-id> [--deck <deck-id>] [--strict] [--out <dir>]' },
    conformance: { run: runConformance, help: 'conformance <deck-dir>' },
    stats: { run: runStats, help: 'stats <deck-dir> [--write]' },
    promote: { run: runPromote, help: 'promote <project-id> [--deck <deck-id>]' },
    package: { run: runPackage, help: 'package <project-id> [--out <file.saga-loredeck.zip>] [--author <name>] [--pkg-version <semver>]' },
    'verify-package': { run: runVerifyPackage, help: 'verify-package <zip-path>' },
};

export function parseArgs(argv) {
    const positionals = [];
    const flags = {};
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg.startsWith('--')) {
            const eq = arg.indexOf('=');
            if (eq > 2) {
                flags[arg.slice(2, eq)] = arg.slice(eq + 1);
            } else {
                const key = arg.slice(2);
                const next = argv[index + 1];
                if (next !== undefined && !next.startsWith('--')) {
                    flags[key] = next;
                    index += 1;
                } else {
                    flags[key] = true;
                }
            }
        } else {
            positionals.push(arg);
        }
    }
    return { positionals, flags };
}

function printUsage() {
    console.log('Saga Loredeck CLI');
    console.log('');
    for (const command of Object.values(COMMANDS)) {
        console.log(`  node tools/loredeck/loredeck-cli.mjs ${command.help}`);
    }
}

async function main() {
    const [commandName, ...rest] = process.argv.slice(2);
    if (!commandName || commandName === 'help' || commandName === '--help') {
        printUsage();
        process.exitCode = commandName ? 0 : 1;
        return;
    }
    const command = COMMANDS[commandName];
    if (!command) {
        console.error(`Unknown command: ${commandName}`);
        printUsage();
        process.exitCode = 1;
        return;
    }
    const { positionals, flags } = parseArgs(rest);
    try {
        const exitCode = await command.run({ positionals, flags });
        process.exitCode = Number.isInteger(exitCode) ? exitCode : 0;
    } catch (error) {
        console.error(`Error: ${error?.message || error}`);
        process.exitCode = 1;
    }
}

await main();
