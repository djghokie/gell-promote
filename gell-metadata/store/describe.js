/**
 * Shared helpers for the gell-metadata snapshots, which read the store's registries (store.queries,
 * store.operations; gell-metadata/registry.js)
 */

/**
 * plain-object metadata of every definition in a registry, sorted by name
 */
exports.describeAll = function(registry) {
    return Array.from(registry.names())
        .map(name => registry.describe(name))
        .sort((a, b) => a.name.localeCompare(b.name))
        ;
}

/**
 * an Error carrying an HTTP status, reported by gell-http's api wrapper
 */
exports.httpError = function(message, status) {
    return Object.assign(new Error(message), { status });
}
