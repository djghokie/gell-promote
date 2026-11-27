/**
 * Shared helpers for the gell-metadata snapshots, which read the store's registries (store.queries,
 * store.operations; gell-metadata/registry.js)
 */

/**
 * an Error carrying an HTTP status, reported by gell-http's api wrapper
 */
exports.httpError = function(message, status) {
    return Object.assign(new Error(message), { status });
}
