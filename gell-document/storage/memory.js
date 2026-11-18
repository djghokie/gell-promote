/**
 * In-memory document storage for tests - the same interface as the application's `documentStorage`
 *  - put(key, bytes, contentType); get(key) -> Uint8Array; remove(key); url(key, { filename }) -> string;
 *    locate(key) -> { storage, key } (how a gell-mail attachment refers to the object)
 *  - objects: what is stored, by key
 */
module.exports = function memory({ name='documentStorage' }={}) {
    const objects = {};

    return {
        objects,

        async put(key, bytes, contentType) {
            objects[key] = { bytes: new Uint8Array(bytes), contentType };
        },

        async get(key) {
            if (!objects[key]) {
                const e = new Error(`no document stored (key=${key})`);
                e.status = 404;
                throw e;
            }

            return objects[key].bytes;
        },

        async remove(key) {
            delete objects[key];
        },

        async url(key, { filename }={}) {
            return `https://storage.test/${key}${filename ? `?filename=${encodeURIComponent(filename)}` : ''}`;
        },

        locate(key) {
            return { storage: name, key };
        },
    };
}
