const { TYPES } = require('../../../gell-dispatch/rules/type');

/**
 * The TYPE that defines a rule of TYPE: TYPE itself (own, or overriding its parent's), or the ancestor it inherits
 * the rule from
 *
 * NOTE: resolve gives a TYPE its parent's rules by reference (inherited), so an inherited rule is the same object
 */
function definedBy(TYPE, ruleName) {
    if (!TYPE.extends || TYPE.rules[ruleName] !== TYPE.inherited[ruleName]) return TYPE.name;

    return definedBy(TYPES[TYPE.extends], ruleName);
}

/**
 * A TYPE as data: its rules' test, message and coerce are functions, so only their names and flags are kept
 *  - extends and a rule's type are left out when the TYPE does not declare them
 */
function describeType(TYPE) {
    return {
        name: TYPE.name,
        ...(TYPE.extends && { extends: TYPE.extends }),
        allowBlank: !!TYPE.allowBlank,
        coerce: !!TYPE.coerce,
        default: TYPE.default,
        rules: Object.entries(TYPE.rules).map(([name, rule]) => ({
            name,
            ...(rule.type && { type: rule.type }),
            default: TYPE.default.includes(name),
            definedBy: definedBy(TYPE, name),
        })),
    };
}

module.exports = {
    describeType,
};
