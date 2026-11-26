const assert = require('assert');
const _ = require('lodash');

const { TYPES, resolve, isBlank } = require('./rules/type');

/**
 * Validates values against param types (TYPE format: gell-dispatch/rules/type)
 *  - argument: one value against its type's rules
 *  - object: an object's properties, each against its own type's rules
 *
 * NOTE: a failure is the caller's input (an Error to report); a mistake in the rules (an undefined rule, a bad rule
 * argument, an unknown type) fails an assert (AssertionError), a bug to fix
 */

/**
 * Validate a single argument, throwing an exception if it is invalid
 *  - coerce value first
 *  - return the coerced value
 *
 * a blank value ('' or null) of a type that allows blanks passes without its rules, and is returned as sent; otherwise
 * the value is coerced, then checked against the type's default rules, then the rules declares, in their order
 *  - throws an Error (name RuleValidationError) for the first rule the value fails; message is the rule's message
 *    (it does not name the value), and rule names the rule
 *  - a rule the type does not define fails an assert (AssertionError)
 *
 * e.g.
 *      argument(10, { max: 5 }, number) throws (rule=max; message='must be at most 5')
 *      argument(10, { min: 1 }, number) returns 10
 *      argument('10', { min: 5 }, number) returns 10
 *
 * @param {*} val the value of the argument to be validated
 * @param {*} rules map of rules (rule name to its argument, e.g. { minLength: 3 }); undefined for none
 * @param {*} ruleDef definition of the rules (a TYPE from rules/type TYPES, or a TYPE definition, e.g. a type module)
 * @returns the coerced value
 */
function argument(val, rules={}, ruleDef) {
    assert(ruleDef, 'ruleDef is required');

    // NOTE: a TYPE from TYPES is resolved; a definition (e.g. a type module) is resolved here
    const TYPE = ruleDef.inherited ? ruleDef : resolve(ruleDef);
    const { inherited } = TYPE;

    if (TYPE.allowBlank && isBlank(val)) return val;

    const value = TYPE.coerce ? TYPE.coerce(val) : val;

    TYPE.default.forEach(name => {
        const def = TYPE.rules[name];

        if (!def.test(value, undefined, inherited)) throw failure(name, def.message(value, undefined, inherited));
    });

    for (const ruleName of Object.keys(rules)) {
        const def = TYPE.rules[ruleName];
        assert(def, `no rule defined (type=${TYPE.name}; rule=${ruleName})`);

        const ruleArg = coerceRuleArg(rules[ruleName], def.type, `type=${TYPE.name}; rule=${ruleName}`);

        if (!def.test(value, ruleArg, inherited)) throw failure(ruleName, def.message(value, ruleArg, inherited));
    }

    return value;
}

/**
 * Validate an objects properties, throwing an exception if any are invalid
 *  - coerce proeprties
 *  - return an object with coerced property values
 *
 * spec declares each property like a param: its type's name (shorthand), or { type, optional, validate }
 *      { title: { type: 'string', validate: { minLength: 3 } }, seats: { type: 'integer', optional: true }, note: 'string' }
 *  - a property is required unless optional; a missing one (undefined, null or '') fails rule required
 *  - a provided property is validated with argument against its validate rules (a map of rules); validate.messages
 *    overrides a rule's message
 *  - checks every property, then throws one Error (name ObjectValidationError) whose errors lists each failure
 *    ({ property, rule, message }) and whose message joins them with '; '; each message names its property
 *  - a type ruleDefs does not define, or validate that is not a map of rules, fails an assert (AssertionError)
 *
 * @param {*} obj the object to be validated
 * @param {*} spec map of property names with rules
 * @param {*} ruleDefs map of rule definitions (type name to TYPE); rules/type TYPES by default
 * @returns a copy of obj with the coerced value of each provided property in spec (other properties as they are)
 */
function object(obj, spec, ruleDefs=TYPES) {
    assert(_.isPlainObject(obj), 'obj must be an object');
    assert(_.isPlainObject(spec), 'spec must be an object');

    const result = { ...obj };
    const errors = [];

    for (const [property, propertySpec] of Object.entries(spec)) {
        const { type, optional=false, validate={} } = _.isString(propertySpec) ? { type: propertySpec } : propertySpec;

        const ruleDef = ruleDefs[type];
        assert(ruleDef, `no type defined (property=${property}; type=${type})`);
        assert(_.isPlainObject(validate), `validate must be a map of rules (property=${property})`);

        const { messages={}, ...rules } = validate;
        const val = obj[property];

        if (val === undefined || isBlank(val)) {
            if (!optional) errors.push({ property, rule: 'required', message: messages.required || `${property} is required` });

            // NOTE: an omitted optional property is not checked; a blank one is (its type may allow blanks)
            if (val === undefined || !optional) continue;
        }

        try {
            result[property] = argument(val, rules, ruleDef);
        } catch (e) {
            if (e.name !== 'RuleValidationError') throw e;

            errors.push({ property, rule: e.rule, message: messages[e.rule] || `${property} ${e.message}` });
        }
    }

    if (errors.length) {
        throw Object.assign(new Error(errors.map(({ message }) => message).join('; ')), { name: 'ObjectValidationError', errors });
    }

    return result;
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

module.exports = {
    argument,

    object
}
