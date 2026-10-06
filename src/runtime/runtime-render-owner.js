/** Owns recoverable view replacement; domain jobs and persistence stay outside. */
export function validateRuntimeDependencies(owner, dependencies, required = [], optional = []) {
    const invalid = required.filter(name => typeof dependencies?.[name] !== 'function');
    invalid.push(...optional.filter(name => dependencies?.[name] !== undefined && typeof dependencies[name] !== 'function'));
    if (invalid.length) throw new TypeError(`${owner} requires function dependencies: ${invalid.join(', ')}.`);
    return Object.freeze({ ...dependencies });
}

export function createRuntimeRenderOwner(dependencies) {
    const deps = validateRuntimeDependencies('Runtime renderer', dependencies,
        ['createRoot', 'renderShell', 'renderFallback', 'commitRoot'], ['reportError', 'afterCommit']);
    function report(error, phase) {
        try { deps.reportError?.(error, phase); } catch (_) { /* reporting cannot break recovery */ }
    }
    function replace(previousRoot, state, initialError = null) {
        let nextRoot;
        let error = initialError;
        try {
            nextRoot = deps.createRoot(state);
            if (!error) {
                try { deps.renderShell(nextRoot, state); }
                catch (renderError) { error = renderError; report(error, 'render'); nextRoot = deps.createRoot(state); }
            }
            if (error) deps.renderFallback(nextRoot, state, error);
        } catch (failure) {
            report(failure, 'fallback');
            return { ok: false, status: 'preserved', root: previousRoot, error: failure };
        }
        try { deps.commitRoot(nextRoot, previousRoot); }
        catch (failure) { report(failure, 'mount'); return { ok: false, status: 'preserved', root: previousRoot, error: failure }; }
        try { deps.afterCommit?.(nextRoot); } catch (failure) { report(failure, 'after_commit'); }
        return { ok: true, status: error ? 'fallback' : 'rendered', root: nextRoot, error };
    }
    function refresh(previousRoot, state, update) {
        if (typeof update !== 'function') throw new TypeError('Runtime refresh requires an update function.');
        try { return update() ?? { ok: true, status: 'updated', root: previousRoot }; }
        catch (error) { report(error, 'refresh'); return replace(previousRoot, state, error); }
    }
    return Object.freeze({ replace, refresh });
}
