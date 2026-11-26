const { TYPES } = require('../../../../gell-dispatch/rules/type');

exports.__metadata = {
    name: 'gell.domain.attributes',
    description: 'returns the param types (gell-dispatch/rules) attributes and params declare, with their rules',
    triggers: {
        effect: {
            params: {}
        },
        api: {
            params: {}
        }
    }
}

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

function listAttributes() {
    return Object.values(TYPES)
        .map(describeType)
        .sort((a, b) => a.name.localeCompare(b.name))
        ;
}

exports.effect = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="gell.domain.attributes")');

    return listAttributes();
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="gell.domain.attributes")');

    return listAttributes();
}
