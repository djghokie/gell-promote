const assert = require('assert');
const _ = require('lodash');

/**
 * gell sink that saves a stream of items to a Store
 * 
 * WIP: optionally get logger from deps and log
 * 
 * WIP: potential future options
 *  - "overwrite": flag indicating whether or not to overwrite an existing item
 *  - "debug": output the items being store
 * 
 * WIP: collect number of items stored
 *  - also number of items skipped if overwrite=false
 */
async function* storeSink(store, options={}, deps) {
    assert(store, 'store is required');

    let item = yield;

    while (true) {
        await store.save(item);

        item = yield;
    }
}

module.exports = {
    storeSink
}
