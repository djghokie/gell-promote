const assert = require('assert');
const _ = require('lodash');

const schema = require('../schema');

/**
 * In-memory search engine
 *  - same interface as ./typesense; used by unit tests (no search server needed)
 *  - every query token must prefix-match a token of the document (case-insensitive)
 *  - a query of digits also prefix-matches phone fields as a whole (406-555 => 406555)
 *
 * NOTE: no typo tolerance; ranking is a plain sum of matching field weights
 */
function tokens(value) {
    return String(value).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

module.exports = function memory({ namespace }={}) {
    const collections = new Map();

    function collection(model) {
        const name = schema.collection(model, namespace);

        if (!collections.has(name)) collections.set(name, new Map());

        return collections.get(name);
    }

    function score(model, doc, q) {
        const fields = schema.fields(model).filter(f => f.index);
        const queryTokens = tokens(q);
        const queryDigits = q.replace(/\D/g, '');

        if (queryTokens.length === 0) return 0;

        const weighted = [
            { values: tokens(doc.label), weight: Math.max(1, ...fields.map(f => f.weight)) },
            ...fields.map(f => ({ values: tokens(doc[f.name] || ''), weight: f.weight, phone: f.index === 'phone', raw: doc[f.name] })),
        ];

        // a phone number typed with punctuation is one "token"
        const phoneMatch = queryDigits.length >= 3 && queryDigits.length === q.replace(/[\s()+.-]/g, '').length
            ? weighted.filter(w => w.phone && w.raw && (w.raw.startsWith(queryDigits) || w.raw.endsWith(queryDigits)))
            : [];

        if (phoneMatch.length) return _.sumBy(phoneMatch, 'weight');

        let total = 0;

        for (const t of queryTokens) {
            const matching = weighted.filter(w => w.values.some(v => v.startsWith(t)));

            if (matching.length === 0) return 0;

            total += _.max(matching.map(m => m.weight));
        }

        return total;
    }

    return {
        async ensure(models) {
            models.forEach(collection);
        },

        async drop(model) {
            collections.delete(schema.collection(model, namespace));
        },

        async upsert(model, docs) {
            const c = collection(model);

            docs.forEach(d => c.set(d.id, _.cloneDeep(d)));

            return docs.length;
        },

        async remove(model, ids) {
            const c = collection(model);

            ids.forEach(id => c.delete(id));

            return ids.length;
        },

        async search({ q, models, filters={}, limit=10 }) {
            assert(_.isString(q), 'q is required');
            assert(_.isArray(models), 'models array is required');

            const hits = [];

            models.forEach(model => {
                for (const doc of collection(model).values()) {
                    if (!Object.entries(filters).every(([k, v]) => doc[k] === String(v))) continue;

                    const s = score(model, doc, q);

                    if (s > 0) hits.push({ id: doc.id, type: doc.type, label: doc.label, projected: JSON.parse(doc.projected || '{}'), score: s });
                }
            });

            return _.orderBy(hits, ['score', 'label'], ['desc', 'asc']).slice(0, limit);
        },

        // NOTE: test helper
        documents(model) {
            return Array.from(collection(model).values());
        },
    }
}
