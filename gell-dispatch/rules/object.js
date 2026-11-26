const _ = require('lodash');

/**
 * Argument rules for the 'object' param type (TYPE format: gell-dispatch/rules/type)
 *  - requiredKeys: keys a (plain) object argument must have, e.g. ['city']
 *
 * NOTE: lenient, to match how 'object' params are used today
 *  - an array passes (e.g. TASKLIST items is declared 'object')
 *  - a string passes when it parses as a JSON object or array (e.g. gell.domain.query.run's args on a GET); the
 *    handler still receives the string and parses it
 *
 * NOTE: a blank optional argument ('' or null) passes (allowBlank)
 */

/**
 * An argument as an object or array (undefined when it is neither, nor a JSON string of one)
 */
function coerce(val) {
    if (_.isPlainObject(val) || Array.isArray(val)) return val;

    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);

            if (_.isPlainObject(parsed) || Array.isArray(parsed)) return parsed;
        } catch {
            // NOTE: not JSON, reported as not an object
        }
    }
}

function missingKeys(obj, keys) {
    return keys.filter(key => obj[key] === undefined || obj[key] === null || obj[key] === '');
}

module.exports = {
    name: 'object',
    allowBlank: true,
    rules: {
        isObject: {
            test: obj => obj !== undefined,
            message: () => 'must be an object',
        },
        // NOTE: applies to plain objects only; an array argument has no keys to check
        requiredKeys: {
            type: 'array',
            test: (obj, keys) => Array.isArray(obj) || missingKeys(obj, keys).length === 0,
            message: (obj, keys) => `must have ${missingKeys(obj, keys).join(', ')}`,
        },
    },
    default: ['isObject'],
    coerce,
};
