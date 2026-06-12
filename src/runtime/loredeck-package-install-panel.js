/**
 * loredeck-package-install-panel.js - Saga
 * Runtime UI and commit lifecycle for importing Loredeck ZIP packages.
 */

import {
    createStateBackup,
    importLoredeckLibraryRegistry,
} from '../state/state-manager.js';
import {
    createButton,
    createStatusPill,
    toast,
    wireOverlayBackdropClose,
} from '../ui/runtime-ui-kit.js';
import {
    createLoredeckActionRow,
    withLoredeckActionButtonBusy,
} from '../loredecks/loredeck-action-rows.js';
import {
    buildGeneratedLoredeckEntryCache,
    canUseVirtualLoredeckData,
} from './loredeck-virtual-data.js';
import {
    isLoredeckZipPackageFile,
} from './loredeck-package-helpers.js';
import {
    buildLoredeckPackageRegistryForInstall,
    readLoredeckZipPackageInstallFile,
} from './loredeck-package-install.js';

let deps = {};

function dep(name, fallback = () => undefined) {
    return typeof deps[name] === 'function' ? deps[name] : fallback;
}

export function configureLoredeckPackageInstallPanel(nextDeps = {}) {
    deps = { ...deps, ...nextDeps };
}

export function cacheInstalledLoredeckBundle(installed = {}, parsed = {}) {
    const cacheLoredeckManifestPreviewRecord = dep('cacheLoredeckManifestPreviewRecord');
    const cacheLoredeckEntryPreviewRecord = dep('cacheLoredeckEntryPreviewRecord');
    if (installed.manifestData) {
        cacheLoredeckManifestPreviewRecord(installed.packId, {
            manifest: installed.manifestData,
            health: parsed.health || null,
            error: '',
            loadedAt: Date.now(),
        });
    }
    if (canUseVirtualLoredeckData(installed)) {
        const entryCache = buildGeneratedLoredeckEntryCache(installed, installed.manifestData || {});
        cacheLoredeckEntryPreviewRecord(installed.packId, {
            ...entryCache,
            health: parsed.health || null,
            error: '',
            loadedAt: Date.now(),
        });
    }
}

export async function commitLoredeckPackageInstall(packageInstall = {}, installs = [], overlay = null, button = null) {
    const selectLoredeckForDetails = dep('selectLoredeckForDetails');
    const refreshLoredeckSurfaces = dep('refreshLoredeckSurfaces');
    const selected = installs.filter(install => install?.record?.packId);
    if (!selected.length) {
        toast('Select at least one valid Loredeck package deck to install.', 'warning');
        return;
    }
    await withLoredeckActionButtonBusy(button, { busyText: 'Installing...', fallbackLabel: 'Install Selected' }, async () => {
        try {
            createStateBackup('before_loredeck_package_import', {
                label: `Before importing ${selected.length} Loredeck package deck${selected.length === 1 ? '' : 's'}.`,
            });
            const registry = buildLoredeckPackageRegistryForInstall(packageInstall, selected);
            const result = importLoredeckLibraryRegistry(registry, { replace: false });
            if (!result.ok) throw new Error(result.error || 'Loredeck package install failed.');
            const importedPackIds = new Set(Array.isArray(result.importedPackIds) ? result.importedPackIds : []);
            const installedRecords = [...importedPackIds]
                .map(packId => result.library?.packs?.[packId] || null)
                .filter(Boolean);
            for (const installed of installedRecords) {
                cacheInstalledLoredeckBundle(installed, { health: null });
                selectLoredeckForDetails(installed.packId, { refresh: false });
            }
            overlay?.remove?.();
            refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
            const installedCount = installedRecords.length;
            const skippedCount = Math.max(0, Number(result.skippedCount) || 0);
            const installedText = installedCount
                ? `Installed ${installedCount} Custom Loredeck${installedCount === 1 ? '' : 's'} from package.`
                : 'No Custom Loredecks were installed from package.';
            const skipped = skippedCount ? ` Skipped ${skippedCount} bundled-id conflict${skippedCount === 1 ? '' : 's'}.` : '';
            toast(`${installedText}${skipped}`, skippedCount ? 'warning' : 'success');
        } catch (e) {
            toast(e?.message || 'Loredeck package install failed.', 'error');
        }
    });
}

export function openLoredeckPackageInstallPreviewDialog(packageInstall = {}) {
    document.querySelector('.saga-loredeck-install-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'saga-new-lore-overlay saga-loredeck-install-overlay';
    wireOverlayBackdropClose(overlay, () => overlay.remove());
    document.body.appendChild(overlay);

    const shell = document.createElement('div');
    shell.className = 'saga-new-lore-shell saga-loredeck-install-shell';
    overlay.appendChild(shell);

    const meta = packageInstall.packageModel?.packageMeta || {};
    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-workbench-title';
    title.textContent = 'Import Loredeck Package';
    titleWrap.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-lore-workbench-subtitle';
    subtitle.textContent = meta.title || packageInstall.fileName || 'Review package contents before installing as Custom Loredecks.';
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);
    header.appendChild(createButton('Close', 'Cancel this Loredeck package import.', () => overlay.remove()));
    shell.appendChild(header);

    const form = document.createElement('div');
    form.className = 'saga-new-lore-form saga-loredeck-install-form';
    shell.appendChild(form);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-manifest-preview';
    const summaryTitle = document.createElement('div');
    summaryTitle.className = 'saga-runtime-card-title';
    summaryTitle.textContent = meta.title || packageInstall.fileName || 'Loredeck Package';
    summary.appendChild(summaryTitle);
    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-entry-summary';
    chips.appendChild(createStatusPill(`${packageInstall.installs?.length || 0} installable`, 'Loredecks in this package that can be installed.', { tone: 'success', kind: 'count' }));
    chips.appendChild(createStatusPill(`${packageInstall.packageModel?.entryCountHint || 0} Lorecards`, 'Manifest-declared Lorecard count in this package.', { kind: 'count' }));
    chips.appendChild(createStatusPill(`${packageInstall.packageModel?.folderCount || 0} folders`, 'Folder records declared by the package index.', { kind: 'count' }));
    chips.appendChild(createStatusPill(packageInstall.fileName || 'local zip', 'Selected package file.', { tone: 'source', kind: 'source', maxChars: 36 }));
    if (packageInstall.failures?.length) chips.appendChild(createStatusPill(`${packageInstall.failures.length} failed`, 'Deck records that could not be parsed or installed.', { tone: 'danger', kind: 'severity' }));
    summary.appendChild(chips);
    form.appendChild(summary);

    const warningText = [
        ...(packageInstall.warnings || []),
        ...((packageInstall.failures || []).map(failure => `${failure.record?.title || failure.record?.packId || 'Deck'}: ${failure.error}`)),
    ];
    if (warningText.length) {
        const warningList = document.createElement('div');
        warningList.className = 'saga-loredeck-generated-readiness-list';
        for (const warning of warningText.slice(0, 12)) {
            const item = document.createElement('div');
            item.className = 'saga-loredeck-generated-readiness-item saga-loredeck-generated-readiness-warning';
            item.textContent = warning;
            warningList.appendChild(item);
        }
        if (warningText.length > 12) {
            const item = document.createElement('div');
            item.className = 'saga-runtime-help';
            item.textContent = `+${warningText.length - 12} more package warning${warningText.length - 12 === 1 ? '' : 's'}.`;
            warningList.appendChild(item);
        }
        form.appendChild(warningList);
    }

    const list = document.createElement('div');
    list.className = 'saga-loredeck-bulk-install-list';
    for (const [index, install] of (packageInstall.installs || []).entries()) {
        const row = document.createElement('label');
        row.className = 'saga-loredeck-bulk-install-row';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !(install.matches || []).some(match => match.exactHash);
        checkbox.dataset.index = String(index);
        row.appendChild(checkbox);

        const main = document.createElement('div');
        main.className = 'saga-loredeck-bulk-install-main';
        const rowTitle = document.createElement('div');
        rowTitle.className = 'saga-loredeck-install-match-title';
        rowTitle.textContent = install.record?.title || install.record?.packId || `Package Deck ${index + 1}`;
        main.appendChild(rowTitle);
        const rowMeta = document.createElement('div');
        rowMeta.className = 'saga-loredeck-install-match-meta';
        rowMeta.textContent = [
            install.record?.packId,
            `from ${install.originalPackId}`,
            `${install.embeddedEntryCount || 0} Lorecards`,
            `${install.fileCount || 0} files`,
            `${install.assetCount || 0} assets`,
            install.matches?.length ? `${install.matches.length} duplicate match${install.matches.length === 1 ? '' : 'es'}` : 'no duplicate matches',
            install.warnings?.[0] || '',
        ].filter(Boolean).join(' | ');
        main.appendChild(rowMeta);
        row.appendChild(main);
        list.appendChild(row);
    }
    form.appendChild(list);

    const actions = createLoredeckActionRow();
    const installButton = createButton('Install Selected', 'Install checked package decks as editable Custom Loredecks.', async (btn) => {
        const selected = [...list.querySelectorAll('input[type="checkbox"]:checked')]
            .map(input => packageInstall.installs[Number(input.dataset.index)])
            .filter(Boolean);
        await commitLoredeckPackageInstall(packageInstall, selected, overlay, btn);
    }, 'saga-primary-button');
    installButton.disabled = !(packageInstall.installs || []).length;
    actions.appendChild(installButton);
    actions.appendChild(createButton('Cancel', 'Cancel this Loredeck package import.', () => overlay.remove()));
    form.appendChild(actions);
}

export async function installLoredeckBundleFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = false;
    input.accept = '.saga-loredeck.zip,.zip,application/zip,application/x-zip-compressed';
    input.addEventListener('change', async () => {
        const files = [...(input.files || [])];
        if (!files.length) return;
        try {
            const file = files[0];
            if (!isLoredeckZipPackageFile(file)) {
                throw new Error('Import a .saga-loredeck.zip package.');
            }
            const packageInstall = await readLoredeckZipPackageInstallFile(file);
            if (!packageInstall.ok) throw new Error(packageInstall.error || 'Loredeck package import failed.');
            openLoredeckPackageInstallPreviewDialog(packageInstall);
        } catch (e) {
            toast(e?.message || 'Loredeck import failed.', 'error');
        }
    }, { once: true });
    input.click();
}
