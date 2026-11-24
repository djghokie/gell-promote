const assert = require('assert');
const _ = require('lodash');

/**
 * Compiles event (action/snapshot) metadata: __metadata = { name, description, roles, triggers }
 *  - follows gell-domain/binding/compiler: compile normalizes (functions intact, for the runtime), describe produces
 *    serializable metadata (functions replaced, for the metadata snapshots and the admin UI)
 */

/**
 * Compiles a param spec
 *  - 'string' shorthand is the param's type
 *  - { type, optional, validate }: validate holds the rules ({ minLength, maxLength, pattern, enum, messages }) or
 *    is a function (value, params) (see gell-dispatch/middleware/arguments)
 *
 * WIP: support non-standard properties (copied as-is), like gell-domain's attribute
 *
 * @param {*} name
 * @param {*} spec
 * @returns { name, type, optional, validate }
 */
function param(name, spec) {
    assert(typeof name === 'string', 'param name is required');

    switch(typeof spec) {
        case 'string':
            var type = spec;
            break;
        case 'object':
            if (spec) var { type, optional, validate } = spec;
            break;
    }

    const compiled = { name };
    if (type !== undefined) compiled.type = type;
    if (optional !== undefined) compiled.optional = optional;
    if (validate !== undefined) compiled.validate = validate;

    if (_.isPlainObject(spec)) {
        Object.keys(spec).forEach(k => {
            if (k === 'type') return;
            if (k === 'optional') return;
            if (k === 'validate') return;

            compiled[k] = spec[k];
        })
    }

    return compiled;
}

/**
 * Compiles a trigger's params as a map of compiled params, by name
 *
 * @param {*} params
 * @returns
 */
function compileParams(params={}) {
    return _.mapValues(params, (spec, name) => param(name, spec));
}

/**
 * Compiles a trigger: { params, context, transaction, ... }
 *  - context attributes have the same spec as params ({ type, optional })
 *
 * NOTE: a trigger without params (or context) stays without (an "effect" trigger may declare none)
 *
 * @param {*} trigger
 * @returns
 */
function compileTrigger(trigger={}) {
    const compiled = { ...trigger };

    if (trigger.params) compiled.params = compileParams(trigger.params);
    if (trigger.context) compiled.context = compileParams(trigger.context);

    return compiled;
}

/**
 * Compiles event metadata
 *
 * @param {*} metadata
 * @returns
 */
function compile(metadata={}) {
    const compiled = { ...metadata };

    if (metadata.triggers) compiled.triggers = _.mapValues(metadata.triggers, compileTrigger);

    return compiled;
}

/**
 * Describes event metadata
 *
 * "describing" produces serializable metadata about the event
 *
 * WIP: might be confusing to replace functions like this (same as gell-domain's describe)
 *
 * @param {*} metadata
 * @returns
 */
function describe(metadata={}) {
    const compiled = compile(metadata);

    if (compiled.triggers) {
        compiled.triggers = _.mapValues(compiled.triggers, trigger => {
            if (!trigger.params) return trigger;

            const params = _.mapValues(trigger.params, p => typeof p.validate === 'function' ? { ...p, validate: '_function_' } : p);

            return { ...trigger, params };
        });
    }

    return compiled;
}

module.exports = {
    param,
    compileParams,
    compileTrigger,
    compile,
    describe,
};
