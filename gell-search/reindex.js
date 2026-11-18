const assert = require('assert');
const _ = require('lodash');

const document = require('./document');

const BATCH_SIZE = 100;

/**
 * Rebuilds the search index of one model from all of its entity snapshots
 *  - drops and recreates the collection so schema changes take effect
 *  - expired (ttl) items are skipped
 *
 * WIP: search is empty between drop and the first upsert; an alias swap would make this seamless
 *
 * @param {*} model gell domain model
 * @param {*} items$ async or sync iterable of entity snapshots
 * @param {*} options { engine, logger }
 * @returns number of documents indexed
 */
module.exports = async function reindex(model, items$, { engine, logger }) {
    assert(model, 'model is required');
    assert(items$, 'items$ is required');
    assert(engine, 'engine is required');

    await engine.drop(model);
    await engine.ensure([model]);

    let docs = [];
    let count = 0;

    for await (const item$ of items$) {
        const doc = document(model, item$);
        if (!doc) continue;

        docs.push(doc);

        if (docs.length >= BATCH_SIZE) {
            count += await engine.upsert(model, docs);
            docs = [];
        }
    }

    count += await engine.upsert(model, docs);

    if (logger) logger.info(`search index rebuilt (type=${model.name}; count=${count})`);

    return count;
}
