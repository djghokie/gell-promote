const assert = require('assert');
const _ = require('lodash');

const { RESERVED, TYPES } = require('../../../../gell-dispatch/rules/type');
const { argument } = require('../../../../gell-dispatch/validate');

exports.__metadata = {
    name: 'gell.domain.attribute.validate',
    description: 'validates a value against a param type (gell-dispatch/rules) and rules, as a param declaring them would',
    triggers: {
        effect: {
            params: {
                name: 'string',
                value: { type: 'any', optional: true },
                rules: { type: 'object', optional: true },
            }
        },
        api: {
            params: {
                name: 'string',
                value: { type: 'any', optional: true },
                rules: { type: 'object', optional: true },
            }
        }
    }
}

/**
 * NOTE: a POST body carries rules as an object; a GET passes them as a JSON query string parameter (the dispatch bus
 * has already checked it is a JSON object)
 */
function parseRules(rules) {
    return typeof rules === 'string' ? JSON.parse(rules) : rules;
}

/**
 * The outcome of validating value, as data
 *  - { valid: true, value }: value passes; value is the coerced value the rules checked
 *  - { valid: false, rule, message }: the first rule value fails; message is the rule's message (validate.messages
 *    overrides it, as for a param)
 *  - { valid: false, mistake: true, message }: a mistake in the rules (an undefined rule, a bad rule argument), which
 *    a param declaring them would fail on as a bug (an AssertionError)
 *
 * NOTE: items (an array param's item spec) is not checked here; like messages, it is not one of the type's rules
 */
function validate(TYPE, value, validate={}) {
    const { messages={} } = validate;
    const rules = _.omit(validate, RESERVED);

    try {
        return { valid: true, value: argument(value, rules, TYPE) };
    } catch (e) {
        if (e.name === 'RuleValidationError') return { valid: false, rule: e.rule, message: messages[e.rule] || e.message };
        if (e.name === 'AssertionError') return { valid: false, mistake: true, message: e.message };

        throw e;
    }
}

exports.effect = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="gell.domain.attribute.validate")');

    const { name, value, rules } = params;

    assert(name, 'name is required');

    if (!Object.hasOwn(TYPES, name)) return;

    return validate(TYPES[name], value, parseRules(rules));
}

/**
 * NOTE: gell-http's api wrapper crashes on an empty result, so a missing type is reported as a 404 instead
 */
exports.api = async function({ params={}, deps }) {
    const result$ = await exports.effect({ params, deps });

    if (!result$) throw Object.assign(new Error(`param type not found (name=${params.name})`), { status: 404 });

    return result$;
}
