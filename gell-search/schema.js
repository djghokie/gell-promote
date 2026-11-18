const assert = require('assert');
const _ = require('lodash');

/**
 * Search schema derived from a gell domain model
 *  - attributes opt in with `searchable` (see ./README.md)
 *      - `true` or `{ index: true }` is a `text` field
 *      - `index` is one of 'text', 'keyword', 'email', 'phone'
 *      - `weight` ranks matches (higher wins; default 1)
 *      - `filter` makes the value filterable (exact match)
 *      - `project` stores the value on the search hit
 *  - the model may declare `search: { label }` where label is a function of the entity snapshot
 *
 * WIP: inherited attributes (`extends`) are included so a base model can declare searchable attributes
 */
const INDEX_TYPES = ['text', 'keyword', 'email', 'phone'];

function attributes(model) {
    const inherited = (model.extends || []).reduce((acc, m) => Object.assign(acc, attributes(m)), {});

    return Object.assign(inherited, model.attributes || {});
}

function field(name, definition) {
    const searchable = _.isPlainObject(definition) ? definition.searchable : undefined;

    if (!searchable) return;

    const options = searchable === true ? { index: true } : searchable;

    // NOTE: `index: true` on phone and email attributes indexes them as their type
    const index = options.index === true
        ? (['phone', 'email'].includes(definition.type) ? definition.type : 'text')
        : options.index;

    assert(!index || INDEX_TYPES.includes(index), `unsupported search index type (attribute=${name}; index=${index})`);

    return {
        name,
        index,
        weight: options.weight || 1,
        filter: !!options.filter,
        project: !!options.project,
    }
}

/**
 * Search fields of a model, in declaration order
 *
 * @param {*} model gell domain model
 * @returns array of { name, index, weight, filter, project }
 */
exports.fields = function(model) {
    assert(model, 'model is required');

    return Object.entries(attributes(model))
        .map(([name, definition]) => field(name, definition))
        .filter(f => f && (f.index || f.filter || f.project))
        ;
}

exports.searchable = function(model) {
    return exports.fields(model).some(f => f.index);
}

/**
 * Collection (index) name for a model
 *  - namespace separates environments sharing one search cluster (e.g. app.test vs app.prod)
 *  - 'CRM#CONTACT' with namespace 'app.test' => 'app_test__crm_contact'
 */
exports.collection = function(model, namespace) {
    assert(model, 'model is required');

    const type = model.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

    return namespace ? `${namespace.toLowerCase().replace(/[^a-z0-9]+/g, '_')}__${type}` : type;
}
