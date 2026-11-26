const assert = require('assert');

/**
 * Param types: TYPE definitions (gell-dispatch/rules/<type>.js exports its TYPE), resolved into TYPES; the
 * argument and object functions of gell-dispatch/validate validate against them
 *
 * TYPE format
 *      module.exports = {
 *          name: 'number',
 *          allowBlank: true,
 *          rules: {
 *              isNumber: { test: n => ..., message: () => 'must be a number' },
 *              min: { type: 'number', test: (n, min) => ..., message: (n, min) => `must be at least ${min}` },
 *          },
 *          default: ['isNumber'],
 *          coerce: val => ...,
 *      }
 *  - rules: each rule's test(val, arg) answers whether the argument passes; message(val, arg) says why it does not,
 *    without the param's name (the caller prefixes it, e.g. 'title must be at least 3 characters')
 *      - test and message get the coerced argument and the coerced rule argument: they never call coerce
 *      - type: the type of the rule's argument, as a param declares it in validate (e.g. minLength: 3), by name
 *        (TYPES) or as [name] for an array of that type (e.g. enum: [1, 2]); argument coerces the rule argument with
 *        that type's coerce, and asserts it passes that type's default rules (a bad rule argument, e.g.
 *        min: 'someday', is a mistake in the param's metadata)
 *  - default: rules that always run, first and in this order (the type check); their test takes only the argument
 *  - allowBlank (optional): a blank argument ('' or null, e.g. an empty form field of an optional param) passes
 *    without its rules; a blank required argument is reported as required (by the caller of argument)
 *  - coerce (optional): converts the argument (e.g. a GET argument's numeric string to a number) before the rules
 *    run, so every rule's test and message get the coerced value
 *  - extends (optional): the name of the TYPE it builds on (in TYPES), e.g. integer extends number
 *      - it gets the parent's rules (its own rules add to them, or replace a rule of the same name), allowBlank and
 *        coerce (unless it declares its own)
 *      - default: the parent's default rules run first, then its own (e.g. isNumber, then isInteger)
 *      - test and message get the parent's rules as a third argument, inherited, to build on them by name, e.g.
 *          positive: { type: 'boolean', test: (n, apply, inherited) => !apply || inherited.min.test(n, 1), ... }
 *        an inherited rule's test and message take (value, ruleArg): the rule argument is not coerced, so pass it
 *        as the rule expects it
 *
 * NOTE: the coerced value is only for the rules; the handler still receives the argument as sent
 */

/**
 * validate keys that are not a type's rules (gell-dispatch/middleware/arguments leaves them out of spec)
 *  - messages: per rule message overrides
 *  - items: an array param's item spec
 */
const RESERVED = ['messages', 'items'];

/**
 * TYPE definitions by param type name, as the type modules declare them
 *
 * NOTE: the type modules are TYPE data: they do not require this module
 */
const DEFINITIONS = {
    string: require('./string'),
    number: require('./number'),
    boolean: require('./boolean'),
    timestamp: require('./timestamp'),
    array: require('./array'),
    object: require('./object'),
    integer: require('./integer'),
    uuid: require('./uuid'),
    any: require('./any'),
    state: require('./state'),
};

/**
 * A TYPE definition with its extends chain resolved (see TYPE format: extends)
 *  - the result carries inherited: the parent's rules, whose test and message already get the parent's own
 *    inherited (so a chain builds on rules that build on rules); the rules it gets from the parent are those same
 *    bound rules, so they ignore the inherited argument passes
 *
 * @param {*} def a TYPE definition
 * @param {*} definitions the definitions extends names resolve against
 */
function resolve(def, definitions=DEFINITIONS, chain=[]) {
    assert(!chain.includes(def.name), `type extends itself (type=${def.name}; chain=${[...chain, def.name].join(' > ')})`);

    const own = { ...def, default: def.default || [], rules: def.rules || {} };

    if (!def.extends) return { ...own, inherited: {} };

    const parentDef = definitions[def.extends];
    assert(parentDef, `no type to extend (type=${def.name}; extends=${def.extends})`);

    const parent = resolve(parentDef, definitions, [...chain, def.name]);
    const inherited = bindRules(parent.rules, parent.inherited);

    return {
        allowBlank: parent.allowBlank,
        coerce: parent.coerce,
        ...own,
        rules: { ...inherited, ...own.rules },
        default: [...parent.default, ...own.default.filter(name => !parent.default.includes(name))],
        inherited,
    };
}

/**
 * Rules whose test and message are given inherited as their third argument
 */
function bindRules(rules, inherited) {
    return Object.fromEntries(Object.entries(rules).map(([name, rule]) => [name, {
        ...rule,
        test: (val, ruleArg) => rule.test(val, ruleArg, inherited),
        message: (val, ruleArg) => rule.message(val, ruleArg, inherited),
    }]));
}

/**
 * TYPE (resolved) by param type name (gell-dispatch/middleware/arguments validates params of these types); a rule's
 * type names one of these
 */
const TYPES = Object.fromEntries(Object.entries(DEFINITIONS).map(([name, def]) => [name, resolve(def)]));

/**
 * A blank argument ('' or null), which passes a TYPE that allows blanks
 */
function isBlank(val) {
    return val === '' || val === null;
}

module.exports = {
    RESERVED,
    TYPES,
    resolve,
    isBlank,
};
