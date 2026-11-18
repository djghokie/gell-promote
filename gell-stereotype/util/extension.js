const assert = require('assert');
const _ = require('lodash');

/**
 * Inheritance helpers shared by stereotype dispatch (dispatch/resolver) and middleware (middleware/extension)
 *
 * A stereotype declares the types it defines, keyed by type name, as type modules (with a model):
 *      { name: 'GELL#NAMESPACE', types: { 'GELL#NAMESPACE': namespace }, actions, snapshots }
 *
 * An extension declares type extensions, keyed by the name of the stereotype type each one extends; a type extension
 * is a partial model (name, parent, attributes, ...) that extends the stereotype type's model:
 *      {
 *          name: 'APPLICATION',
 *          extends: namespace,
 *          types: {
 *              'GELL#NAMESPACE': { name: 'NAMESPACE#APPLICATION', parent: ecosystem, attributes: { ... } }
 *          }
 *      }
 */

/**
 * Returns the stereotypes def extends (none, one, or many), resolving stereotype names through the registry
 */
function basesOf(def, stereotypes) {
    const { extends: xtends } = def;

    if (!xtends) return [];

    return (_.isArray(xtends) ? xtends : [xtends])
        .map(base => _.isString(base) ? stereotypes && stereotypes.get(base) : base)
        .filter(Boolean);
}

/**
 * Resolves the type def (an extension or stereotype) provides for the stereotype type typeName
 *
 * Returns { name, model, abstract } or undefined if neither def nor its stereotypes declare typeName
 *  - a type module declared by a stereotype resolves to itself: abstract, named typeName (or its model's name)
 *  - a type extension resolves to a concrete type: named by the extension, its model extends the model of the type
 *    it extends (resolved through def's stereotypes, depth first)
 *  - a type def does not declare resolves to the type its stereotypes provide (e.g. an extension of an extension)
 *
 * WIP: an extension of several stereotypes that declare the same type extends the first one found
 */
function resolveType(def, typeName, stereotypes, visited=new Set()) {
    if (visited.has(def)) return;
    visited.add(def);

    let base;

    for (const b of basesOf(def, stereotypes)) {
        base = resolveType(b, typeName, stereotypes, visited);

        if (base) break;
    }

    const declared = def.types && def.types[typeName];

    if (!declared) return base;

    // NOTE: a type module (e.g. gell-namespace/domain/namespace) declared by a stereotype
    if (declared.model) {
        return { name: declared.model.name || typeName, model: declared.model, abstract: true };
    }

    assert(base, `extension (name=${def.name}) extends type (name=${typeName}) that none of its stereotypes declare`);
    assert(_.isString(declared.name), `extension (name=${def.name}) type extension of (name=${typeName}) must be named`);

    const model = {
        ...declared,
        extends: [base.model, ...(declared.extends || [])],
    };

    return { name: declared.name, model, abstract: false };
}

module.exports = {
    basesOf,
    resolveType,
}
