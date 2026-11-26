const assert = require('assert');

/**
 * Validates an argument against a param type's TYPE (gell-dispatch/rules/<type>.js exports its TYPE)
 *
 * TYPE format
 *      module.exports = {
 *          name: 'number',
 *          allowBlank: true,
 *          rules: {
 *              isNumber: { default: true, test: n => ..., message: () => 'must be a number' },
 *              min: { type: 'number', test: (n, min) => ..., message: (n, min) => `must be at least ${min}` },
 *          },
 *          default: ['isNumber'],
 *          coerce: val => ...,
 *      }
 *  - rules: each rule's test(val, arg) answers whether the argument passes; message(val, arg) says why it does not,
 *    without the param's name (the caller prefixes it, e.g. 'title must be at least 3 characters')
 *      - test and message get the coerced argument and the coerced rule argument: they never call coerce
 *      - type: the type of the rule's argument, as a param declares it in validate (e.g. minLength: 3), by name
 *        (TYPES) or as [name] for an array of that type (e.g. enum: [1, 2]); validate coerces the rule argument with
 *        that type's coerce, and asserts it passes that type's default rules (a bad rule argument, e.g.
 *        min: 'someday', is a mistake in the param's metadata)
 *  - default: rules that always run, first and in this order (the type check); their test takes only the argument
 *  - allowBlank (optional): a blank argument ('' or null, e.g. an empty form field of an optional param) passes
 *    without its rules; a blank required argument is reported as required before validate runs
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
};

/**
 * A TYPE definition with its extends chain resolved (see TYPE format: extends)
 *  - the result carries inherited: the parent's rules, whose test and message already get the parent's own
 *    inherited (so a chain builds on rules that build on rules); the rules it gets from the parent are those same
 *    bound rules, so they ignore the inherited validate passes
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
 * Validates an argument: a blank one passes when the TYPE allows blanks; otherwise the argument is coerced, then
 * checked against the TYPE's default rules, then the rules spec declares, in spec's order
 *  - throws an Error (name RuleValidationError) for the first rule the argument fails; message is the rule's
 *    message (it does not name the param), and rule names the rule
 *  - a rule the TYPE does not define is a mistake in the param's metadata: it fails an assert (AssertionError)
 *
 * @param {*} arg the argument (as sent)
 * @param {*} spec the rules to check, by name, with their arguments (e.g. { minLength: 3 }); undefined for none
 * @param {*} type the param type's TYPE (from TYPES, or a TYPE definition)
 */
function validate(arg, spec={}, type) {
    assert(type, 'TYPE is required');

    // NOTE: a TYPE from TYPES is resolved; a definition (e.g. a type module) is resolved here
    const TYPE = type.inherited ? type : resolve(type);
    const { inherited } = TYPE;

    if (TYPE.allowBlank && isBlank(arg)) return;

    const val = TYPE.coerce ? TYPE.coerce(arg) : arg;

    TYPE.default.forEach(name => {
        const def = TYPE.rules[name];

        if (!def.test(val, undefined, inherited)) throw failure(name, def.message(val, undefined, inherited));
    });

    for (const ruleName of Object.keys(spec)) {
        const ruleDef = TYPE.rules[ruleName];
        assert(ruleDef, `no rule defined (type=${TYPE.name}; rule=${ruleName})`);

        const { test, message } = ruleDef;
        const ruleArg = coerceRuleArg(spec[ruleName], ruleDef.type, `type=${TYPE.name}; rule=${ruleName}`);

        if (!test(val, ruleArg, inherited)) throw failure(ruleName, message(val, ruleArg, inherited));
    }
}

/**
 * A rule's argument coerced to the rule's type (see TYPE format: rules type)
 *  - a type not in TYPES (or no type) leaves the argument as declared
 *  - asserts the coerced argument passes the type's default rules (and that an array type's argument is an array)
 */
function coerceRuleArg(ruleArg, ruleType, context) {
    if (Array.isArray(ruleType)) {
        assert(Array.isArray(ruleArg), `rule argument is not an array (${context}; argument=${JSON.stringify(ruleArg)})`);

        return ruleArg.map(item => coerceRuleArg(item, ruleType[0], context));
    }

    const ARG_TYPE = TYPES[ruleType];

    if (!ARG_TYPE) return ruleArg;

    const coerced = ARG_TYPE.coerce ? ARG_TYPE.coerce(ruleArg) : ruleArg;

    ARG_TYPE.default.forEach(name => {
        assert(ARG_TYPE.rules[name].test(coerced), `rule argument is not a valid ${ARG_TYPE.name} (${context}; argument=${JSON.stringify(ruleArg)})`);
    });

    return coerced;
}

function failure(rule, message) {
    return Object.assign(new Error(message), { name: 'RuleValidationError', rule });
}

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
    validate,
    isBlank,
};
