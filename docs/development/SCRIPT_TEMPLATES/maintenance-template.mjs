/**
 * Maintenance script template for auditing and repairing loredeck data.
 *
 * This template demonstrates:
 * - Reading and analyzing pack data
 * - Detecting issues and flagging problems
 * - Safe repair with backup and validation
 * - Detailed reporting with multiple output formats
 * - Optional --write-safe flag for applying fixes
 *
 * Usage:
 *   node tools/scripts/audit-example-deck.mjs              # Report only
 *   node tools/scripts/audit-example-deck.mjs --json       # Machine-readable output
 *   node tools/scripts/audit-example-deck.mjs --write-safe # Apply repairs
 *
 * See: docs/development/SCRIPTS_GUIDE.md for maintenance patterns
 */

import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// Configuration
// ============================================================================

const args = new Set(process.argv.slice(2));
const root = process.cwd();
const deckRoot = path.join(root, 'content/loredecks');

// ============================================================================
// I/O Helpers
// ============================================================================

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to read ${file}: ${error.message}`);
  }
}

function writeJson(file, value) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function asArray(value) {
  if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean);
  return value ? [String(value).trim()].filter(Boolean) : [];
}

// ============================================================================
// Analysis Functions
// ============================================================================

function analyzeEntry(entry = {}) {
  const issues = [];
  const warnings = [];

  // Check required fields
  if (!entry.id) issues.push('missing-id');
  if (!entry.title) issues.push('missing-title');
  if (!entry.kind) issues.push('missing-kind');

  // Check for suspicious patterns
  if (entry.tags && entry.tags.length > 20) {
    warnings.push('excessive-tags');
  }
  if (entry.title && entry.title.length > 200) {
    warnings.push('title-too-long');
  }

  // Check content structure
  const content = entry.content || {};
  if (Object.keys(content).length === 0 && !entry.kind.includes('anchor')) {
    warnings.push('empty-content');
  }

  return { issues, warnings };
}

function inferCategory(entry = {}) {
  const kind = String(entry.kind || '').toLowerCase();
  const tags = asArray(entry.tags);

  if (kind.includes('guard')) return 'guard';
  if (kind.includes('anchor')) return 'anchor';
  if (kind.includes('state') || kind.includes('character')) return 'character_state';
  if (tags.some(t => t.includes('event'))) return 'event';

  return 'reference';
}

function proposedRepair(entry = {}) {
  const repairs = [];

  // Suggest adding kind if missing
  if (!entry.kind) {
    repairs.push({
      field: 'kind',
      action: 'infer',
      suggestedValue: 'entry_card',
    });
  }

  // Suggest normalizing tags
  if (entry.tags && entry.tags.length > 0) {
    const normalizedTags = entry.tags.map(tag => String(tag).toLowerCase().replace(/\s+/g, '_'));
    if (!normalizedTags.every((tag, i) => tag === entry.tags[i])) {
      repairs.push({
        field: 'tags',
        action: 'normalize',
        current: entry.tags,
        suggestedValue: normalizedTags,
      });
    }
  }

  return repairs;
}

// ============================================================================
// Audit and Report
// ============================================================================

function auditDeckPath(deckPath) {
  const manifestPath = path.join(deckPath, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return { status: 'missing-manifest', deckPath };
  }

  const manifest = readJson(manifestPath);
  const entries = [];
  const byIssue = {};
  const byWarning = {};
  const byCategory = {};
  let totalIssues = 0;
  let totalWarnings = 0;

  // Read all entry files and analyze
  const files = asArray(manifest.files || []);
  for (const file of files) {
    const filePath = path.join(deckPath, file);
    if (!fs.existsSync(filePath)) continue;

    const data = readJson(filePath);
    const list = asArray(data.entries);

    for (const entry of list) {
      const { issues, warnings } = analyzeEntry(entry);
      const category = inferCategory(entry);

      entries.push({
        id: entry.id,
        title: entry.title,
        file,
        issues,
        warnings,
        category,
        repairs: proposedRepair(entry),
      });

      // Track statistics
      issues.forEach(issue => {
        byIssue[issue] = (byIssue[issue] || 0) + 1;
        totalIssues += 1;
      });
      warnings.forEach(warning => {
        byWarning[warning] = (byWarning[warning] || 0) + 1;
        totalWarnings += 1;
      });
      byCategory[category] = (byCategory[category] || 0) + 1;
    }
  }

  const problematic = entries.filter(e => e.issues.length > 0);

  return {
    status: 'analyzed',
    deckId: manifest.id,
    deckPath: path.relative(root, deckPath),
    entryCount: entries.length,
    issueCount: totalIssues,
    warningCount: totalWarnings,
    problemCount: problematic.length,
    byIssue,
    byWarning,
    byCategory,
    problematic: problematic.slice(0, 20),
    allProblematic: problematic,
    entries,
  };
}

// ============================================================================
// Repair Functions
// ============================================================================

function repairEntry(entry = {}) {
  const repairs = proposedRepair(entry);
  let modified = false;

  for (const repair of repairs) {
    if (repair.action === 'infer') {
      entry[repair.field] = repair.suggestedValue;
      modified = true;
    } else if (repair.action === 'normalize') {
      entry[repair.field] = repair.suggestedValue;
      modified = true;
    }
  }

  return modified;
}

function repairDeck(deckPath, report) {
  const changedFiles = new Set();
  let repairedCount = 0;

  for (const entry of report.allProblematic) {
    // Find and modify the entry in its file
    const filePath = path.join(deckPath, entry.file);
    const data = readJson(filePath);

    for (const item of asArray(data.entries)) {
      if (item.id === entry.id) {
        if (repairEntry(item)) {
          changedFiles.add(filePath);
          repairedCount += 1;
        }
      }
    }
  }

  // Write repaired files
  for (const filePath of changedFiles) {
    const data = readJson(filePath);
    writeJson(filePath, data);
  }

  return {
    repairedCount,
    filesChanged: changedFiles.size,
  };
}

// ============================================================================
// Main Execution
// ============================================================================

const report = {
  timestamp: new Date().toISOString(),
  decks: [],
  totalDecks: 0,
  totalEntries: 0,
  totalIssues: 0,
};

// Audit all decks in the repository
if (fs.existsSync(deckRoot)) {
  const deckDirs = fs.readdirSync(deckRoot).filter(f => {
    return fs.statSync(path.join(deckRoot, f)).isDirectory();
  });

  for (const deckDir of deckDirs) {
    const deckPath = path.join(deckRoot, deckDir);
    const deckReport = auditDeckPath(deckPath);

    if (deckReport.status === 'analyzed') {
      report.decks.push(deckReport);
      report.totalDecks += 1;
      report.totalEntries += deckReport.entryCount;
      report.totalIssues += deckReport.issueCount;

      // Apply repairs if requested
      if (args.has('--write-safe') && deckReport.allProblematic.length > 0) {
        const repairResult = repairDeck(deckPath, deckReport);
        deckReport.repairs = repairResult;
      }
    }
  }
}

// ============================================================================
// Output
// ============================================================================

if (args.has('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  // Human-readable output
  console.log(`\nDeck Audit Report - ${report.timestamp}`);
  console.log('='.repeat(60));
  console.log(`Decks analyzed: ${report.totalDecks}`);
  console.log(`Total entries: ${report.totalEntries}`);
  console.log(`Total issues: ${report.totalIssues}`);

  for (const deckReport of report.decks) {
    console.log(`\n${deckReport.deckId} (${deckReport.deckPath})`);
    console.log('-'.repeat(40));
    console.log(`  Entries: ${deckReport.entryCount}`);
    console.log(`  Issues: ${deckReport.issueCount}`);
    console.log(`  Warnings: ${deckReport.warningCount}`);
    console.log(`  Problematic: ${deckReport.problemCount}`);

    if (Object.keys(deckReport.byIssue).length > 0) {
      console.log(`  Issue breakdown: ${JSON.stringify(deckReport.byIssue)}`);
    }
    if (Object.keys(deckReport.byWarning).length > 0) {
      console.log(`  Warning breakdown: ${JSON.stringify(deckReport.byWarning)}`);
    }

    if (deckReport.repairs) {
      console.log(`  Repairs applied: ${deckReport.repairs.repairedCount} entries, ${deckReport.repairs.filesChanged} files`);
    }

    if (deckReport.problematic.length > 0) {
      console.log(`  Sample problematic entries:`);
      for (const entry of deckReport.problematic.slice(0, 5)) {
        console.log(`    - ${entry.id}: ${entry.issues.join(', ')}`);
      }
    }
  }

  if (args.has('--write-safe')) {
    const totalRepairs = report.decks.reduce((sum, d) => sum + (d.repairs?.repairedCount || 0), 0);
    console.log(`\n--write-safe applied ${totalRepairs} repairs across multiple files.`);
  }
}
