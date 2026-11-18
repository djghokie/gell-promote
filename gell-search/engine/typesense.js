const assert = require('assert');
const _ = require('lodash');

const schema = require('../schema');

/**
 * Typesense search engine (REST API over fetch; no client library)
 *  - one collection per searchable model, named by schema.collection(model, namespace)
 *  - search runs a multi_search across the requested models and merges hits by text match score
 *
 * WIP: schema changes only add fields (PATCH); a changed field type needs a reindex (drop + ensure)
 * WIP: no TENANT isolation; collections are separated by namespace only (one namespace per environment)
 *
 * @param {*} options { url, apiKey, namespace, fetch }
 */
const TOKEN_SEPARATORS = ['@', '.', '-', '+', '_'];

function weight(fields) {
    return Math.max(1, ...fields.filter(f => f.index).map(f => f.weight));
}

function collectionFields(model) {
    const fields = [
        { name: 'type', type: 'string', facet: true },
        { name: 'label', type: 'string' },
        { name: 'projected', type: 'string', index: false, optional: true },
    ];

    schema.fields(model).forEach(({ name, index, filter }) => {
        if (index || filter) fields.push({ name, type: 'string', optional: true, facet: filter });
        if (index === 'phone') fields.push({ name: `${name}_last4`, type: 'string', optional: true });
    });

    return fields;
}

function queryBy(model) {
    const fields = schema.fields(model).filter(f => f.index);

    const by = [{ name: 'label', weight: weight(fields) }];

    fields.forEach(({ name, index, weight }) => {
        by.push({ name, weight });
        if (index === 'phone') by.push({ name: `${name}_last4`, weight });
    });

    return {
        query_by: by.map(b => b.name).join(','),
        query_by_weights: by.map(b => b.weight).join(','),
    }
}

function filterBy(filters) {
    return Object.entries(filters)
        .map(([k, v]) => `${k}:=\`${String(v).replace(/`/g, '')}\``)
        .join(' && ')
        ;
}

module.exports = function typesense({ url, apiKey, namespace, fetch=globalThis.fetch }={}) {
    assert(url, 'typesense url is required');
    assert(apiKey, 'typesense apiKey is required');

    const base = url.replace(/\/$/, '');

    async function request(method, path, { body, contentType='application/json', allow=[] }={}) {
        const res = await fetch(`${base}${path}`, {
            method,
            headers: { 'X-TYPESENSE-API-KEY': apiKey, 'Content-Type': contentType },
            body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
        });

        if (allow.includes(res.status)) return { status: res.status };

        const text = await res.text();

        if (!res.ok) throw new Error(`typesense request failed (method=${method}; path=${path}; status=${res.status}; message=${text})`);

        return contentType === 'application/json' && text ? JSON.parse(text) : text;
    }

    return {
        async ensure(models) {
            for (const model of models) {
                const name = schema.collection(model, namespace);
                const fields = collectionFields(model);

                const existing = await request('GET', `/collections/${name}`, { allow: [404] });

                if (existing.status === 404) {
                    await request('POST', '/collections', { body: { name, fields, token_separators: TOKEN_SEPARATORS } });

                    continue;
                }

                const missing = fields.filter(f => !existing.fields.some(e => e.name === f.name));

                if (missing.length) await request('PATCH', `/collections/${name}`, { body: { fields: missing } });
            }
        },

        async drop(model) {
            await request('DELETE', `/collections/${schema.collection(model, namespace)}`, { allow: [404] });
        },

        async upsert(model, docs) {
            if (docs.length === 0) return 0;

            const name = schema.collection(model, namespace);
            const body = docs.map(d => JSON.stringify(d)).join('\n');

            const res = await request('POST', `/collections/${name}/documents/import?action=upsert`, { body, contentType: 'text/plain' });

            const failed = res.split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(r => !r.success);

            if (failed.length) throw new Error(`typesense import failed (collection=${name}; failed=${failed.length}; error=${failed[0].error})`);

            return docs.length;
        },

        async remove(model, ids) {
            if (ids.length === 0) return 0;

            const name = schema.collection(model, namespace);
            const filter = encodeURIComponent(`id:[${ids.map(id => `\`${id}\``).join(',')}]`);

            await request('DELETE', `/collections/${name}/documents?filter_by=${filter}`, { allow: [404] });

            return ids.length;
        },

        async search({ q, models, filters={}, limit=10 }) {
            assert(_.isString(q), 'q is required');
            assert(_.isArray(models), 'models array is required');

            const filter_by = filterBy(filters);

            const searches = models.map(model => ({
                collection: schema.collection(model, namespace),
                q,
                ...queryBy(model),
                prefix: true,
                per_page: limit,
                ...(filter_by ? { filter_by } : {}),
            }));

            const { results=[] } = await request('POST', '/multi_search', { body: { searches } });

            const hits = results.flatMap((r, i) => {
                if (r.error) throw new Error(`typesense search failed (collection=${searches[i].collection}; error=${r.error})`);

                return (r.hits || []).map(h => ({
                    id: h.document.id,
                    type: h.document.type,
                    label: h.document.label,
                    projected: JSON.parse(h.document.projected || '{}'),
                    score: h.text_match,
                }));
            });

            return _.orderBy(hits, ['score'], ['desc']).slice(0, limit);
        },
    }
}

module.exports.collectionFields = collectionFields;
module.exports.queryBy = queryBy;
