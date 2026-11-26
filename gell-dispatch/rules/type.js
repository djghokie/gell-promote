const assert = require('assert');

/**
 * Validates an argument against a param type's TYPE (gell-dispatch/rules/<type>.js)
 *
 * TYPE format
 *      const TYPE = {
 *          name: 'string',
 *          rules: {
 *              isString: { default: true, test: val => ..., message: val => 'must be a string' },
 *              minLength: { type: 'number', test: (val, min) => ..., message: (val, min) => `must be at least ${min} characters` },
 *          },
 *          default: ['isString'],
 *          skip: val => ...,
 *      }
 *  - rules: each rule's test(val, arg) answers whether the argument passes; message(val, arg) says why it does not,
 *    without the param's name (the caller prefixes it, e.g. 'title must be at least 3 characters')
 *      - type: the type of the rule's argument, as a param declares it in validate (e.g. minLength: 3)
 *  - default: rules that always run, first and in this order (the type check); their test takes only the argument
 *  - skip (optional): arguments the caller does not validate, e.g. a blank optional number ('' or null, an empty
 *    form field); gell-dispatch/middleware/arguments checks it before calling validate
 */

/**
 * validate keys that are not a type's rules (gell-dispatch/middleware/arguments leaves them out of spec)
 *  - messages: per rule message overrides
 *  - items: an array param's item spec
 */
const RESERVED = ['messages', 'items'];

/**
 * Validates an argument: the TYPE's default rules, then the rules spec declares, in spec's order
 *  - throws an Error (name RuleValidationError) for the first rule the argument fails; message is the rule's
 *    message (it does not name the param), and rule names the rule
 *  - a rule the TYPE does not define is a mistake in the param's metadata: it fails an assert (AssertionError)
 *
 * @param {*} TYPE the param type's TYPE
 * @param {*} val the argument
 * @param {*} spec the rules to check, by name, with their arguments (e.g. { minLength: 3 })
 */
function validate(TYPE, val, spec={}) {
    TYPE.default.forEach(name => {
        const def = TYPE.rules[name];

        if (!def.test(val)) throw failure(name, def.message(val));
    });

    for (const ruleName of Object.keys(spec)) {
        const ruleDef = TYPE.rules[ruleName];
        assert(ruleDef, `no rule defined (type=${TYPE.name}; rule=${ruleName})`);

        const { test, message } = ruleDef;
        const ruleArg = spec[ruleName];

        if (!test(val, ruleArg)) throw failure(ruleName, message(val, ruleArg));
    }
}

function failure(rule, message) {
    return Object.assign(new Error(message), { name: 'RuleValidationError', rule });
}

/**
 * A blank argument ('' or null), which TYPE.skip skips for most types
 */
function isBlank(val) {
    return val === '' || val === null;
}

module.exports = {
    RESERVED,
    validate,
    isBlank,
};
