const assert = require('assert');
const _ = require('lodash');

// NOTE: same (transitive) dependency gell-aws-dynamodb/stream/materialize uses
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const document = require('./document');

/**
 * Applies DynamoDB stream records to the search engine
 *  - INSERT / MODIFY of a searchable type => upsert (or remove when the item has expired, i.e. deleted by ttl)
 *  - REMOVE (ttl expiry or hard delete) => remove
 *  - records of types without a search model are ignored
 *  - one upsert and one remove call per model per batch
 *
 * @param {*} records DynamoDB stream records (event.Records)
 * @param {*} options { models: [model], engine, logger }
 * @returns { upserted, removed } counts
 */
module.exports = async function index(records=[], { models, engine, logger }) {
    assert(_.isArray(models), 'models array is required');
    assert(engine, 'engine is required');

    const byType = new Map(models.map(m => [m.name, m]));
    const batches = new Map();

    function batch(model) {
        if (!batches.has(model)) batches.set(model, { upserts: new Map(), removes: new Set() });

        return batches.get(model);
    }

    records.forEach(r => {
        const { eventName, dynamodb={} } = r;

        const image = dynamodb.NewImage || dynamodb.OldImage;
        if (!image) return;

        const item$ = unmarshall(image);
        const model = byType.get(item$.type);
        if (!model || !item$.id) return;

        const b = batch(model);

        const doc = eventName === 'REMOVE' ? undefined : document(model, item$);

        // NOTE: records are in order, so a later record for the same id wins
        if (doc) {
            b.removes.delete(doc.id);
            b.upserts.set(doc.id, doc);
        } else {
            b.upserts.delete(item$.id);
            b.removes.add(item$.id);
        }
    });

    let upserted = 0;
    let removed = 0;

    for (const [model, { upserts, removes }] of batches) {
        upserted += await engine.upsert(model, Array.from(upserts.values()));
        removed += await engine.remove(model, Array.from(removes));
    }

    if (logger) logger.info(`search index updated (records=${records.length}; upserted=${upserted}; removed=${removed})`);

    return { upserted, removed };
}
