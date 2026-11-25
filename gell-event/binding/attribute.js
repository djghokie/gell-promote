const assert = require('assert');
const _ = require('lodash');

/**
 * Param specs that reference a domain model attribute, so an attribute's rules are declared once (on the model) and
 * applied at dispatch (by gell-dispatch/middleware/arguments) wherever a trigger param references it
 *
 * usage
 *      const tasklist = require('../domain/tasklist');
 *      params: {
 *          color: attribute(tasklist.model, 'color', { optional: true }),
 *      }
 *
 * NOTE: a model attribute declares its rules like a param: { type, default, validate: { enum, ... } | function }
 *  - gell-domain's materialize ignores validate; the rules only apply to params at dispatch
 */

/**
 * The spec of a model's attribute (own first, then inherited through extends), or undefined
 */
function findAttribute(model, name) {
    if (!model) return;

    const { attributes={}, extends: xtends } = model;

    if (Array.isArray(attributes)) {
        const own = attributes.find(spec => spec === name || (_.isPlainObject(spec) && spec.name === name));

        if (own !== undefined) return own === name ? undefined : own;
    }
    else if (attributes[name] !== undefined) return attributes[name];

    const bases = Array.isArray(xtends) ? xtends : (xtends ? [xtends] : []);

    for (const base of bases) {
        const spec = findAttribute(base, name);

        if (spec !== undefined) return spec;
    }
}

/**
 * Merges an override's validate into the attribute's: rules objects merge (the override's win, and messages merge
 * too); otherwise the override replaces the attribute's
 */
function mergeValidate(validate, override) {
    if (override === undefined) return validate;

    if (_.isPlainObject(validate) && _.isPlainObject(override)) {
        const merged = { ...validate, ...override };

        if (validate.messages || override.messages) merged.messages = { ...validate.messages, ...override.messages };

        return merged;
    }

    return override;
}

/**
 * A param spec from a model attribute
 *
 * @param {*} model a gell-domain model ({ name, extends, attributes })
 * @param {*} name the attribute's name
 * @param {*} overrides param spec properties applied over the attribute's (e.g. optional, or extra validate rules)
 * @returns { type, validate, attribute, ...overrides }; attribute ('<model>.<name>') names the source
 */
function attribute(model, name, overrides={}) {
    assert(model, 'model is required');
    assert(typeof name === 'string', 'attribute name is required');

    const spec = findAttribute(model, name);

    assert(spec !== undefined, `model (name=${model.name}) has no attribute (name=${name})`);
    assert(typeof spec !== 'function', `attribute (name=${name}) is derived; it cannot be a param`);

    const base = typeof spec === 'string' ? { type: spec } : _.pick(spec, ['type', 'validate']);

    const param = { ...base, ..._.omit(overrides, ['validate']) };

    const validate = mergeValidate(base.validate, overrides.validate);
    if (validate !== undefined) param.validate = validate;

    param.attribute = `${model.name}.${name}`;

    return param;
}

module.exports = {
    findAttribute,
    attribute,
};
