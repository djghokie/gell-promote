const assert = require('assert');
const _ = require('lodash');

const schema = require('./schema');

/**
 * Normalizers per index type
 *  - search engines see the normalized value; the raw value is only returned as a projection
 */
const NORMALIZE = {
    text: v => String(v).trim(),
    keyword: v => String(v).trim().toLowerCase(),
    email: v => String(v).trim().toLowerCase(),
    phone: v => String(v).replace(/\D/g, ''),
}

function isExpired(item$) {
    return !!item$.ttl && item$.ttl * 1000 <= Date.now();
}

function label(model, item$) {
    const { search={} } = model;

    if (typeof search.label === 'function') return search.label(item$);

    return item$.name || _.compact([item$.firstName, item$.lastName]).join(' ') || item$.email || item$.id;
}

/**
 * Maps an entity snapshot to a search document
 *  - returns undefined when the entity should not be in the index (expired, i.e. deleted by ttl)
 *  - document shape: { id, type, label, <indexed/filter fields>, <phone>_last4, projected }
 *      - projected is a JSON string of the `project` attributes (stored, not indexed)
 *
 * @param {*} model gell domain model with searchable attributes
 * @param {*} item$ entity snapshot (plain object)
 * @returns search document or undefined
 */
module.exports = function document(model, item$) {
    assert(model, 'model is required');
    assert(item$, 'item$ is required');

    if (!item$.id || isExpired(item$)) return;

    const doc = {
        id: item$.id,
        type: item$.type || model.name,
        label: String(label(model, item$) || ''),
    }

    const projected = {};

    schema.fields(model).forEach(({ name, index, filter, project }) => {
        const value = item$[name];

        if (value === undefined || value === null || value === '') return;

        if (project) projected[name] = value;

        if (index) {
            const normalized = NORMALIZE[index](value);

            if (normalized) doc[name] = normalized;
            if (index === 'phone' && normalized.length >= 4) doc[`${name}_last4`] = normalized.slice(-4);
        } else if (filter) {
            doc[name] = String(value);
        }
    });

    doc.projected = JSON.stringify(projected);

    return doc;
}

module.exports.isExpired = isExpired;
module.exports.NORMALIZE = NORMALIZE;
