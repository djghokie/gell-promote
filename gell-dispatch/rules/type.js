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
 *      - type: the type of the rule's argument, as a param declares it in validate (e.g. minLength: 3)
 *  - default: rules that always run, first and in this order (the type check); their test takes only the argument
 *  - allowBlank (optional): a blank argument ('' or null, e.g. an empty form field of an optional param) passes
 *    without its rules; a blank required argument is reported as required before validate runs
 *  - coerce (optional): converts the argument (e.g. a GET argument's numeric string to a number) before the rules
 *    run, so every rule's test and message get the coerced value
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
 * Validates an argument: a blank one passes when the TYPE allows blanks; otherwise the argument is coerced, then
 * checked against the TYPE's default rules, then the rules spec declares, in spec's order
 *  - throws an Error (name RuleValidationError) for the first rule the argument fails; message is the rule's
 *    message (it does not name the param), and rule names the rule
 *  - a rule the TYPE does not define is a mistake in the param's metadata: it fails an assert (AssertionError)
 *
 * @param {*} arg the argument (as sent)
 * @param {*} spec the rules to check, by name, with their arguments (e.g. { minLength: 3 }); undefined for none
 * @param {*} TYPE the param type's TYPE
 */
function validate(arg, spec={}, TYPE) {
    assert(TYPE, 'TYPE is required');

    if (TYPE.allowBlank && isBlank(arg)) return;

    const val = TYPE.coerce ? TYPE.coerce(arg) : arg;

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
 * A blank argument ('' or null), which passes a TYPE that allows blanks
 */
function isBlank(val) {
    return val === '' || val === null;
}

module.exports = {
    RESERVED,
    validate,
    isBlank,
};
