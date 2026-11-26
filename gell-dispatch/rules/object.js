const _ = require('lodash');

const { isBlank } = require('./type');

/**
 * Argument rules for the 'object' param type (TYPE format: gell-dispatch/rules/type)
 *  - requiredKeys: keys a (plain) object argument must have, e.g. ['city']
 *
 * NOTE: lenient, to match how 'object' params are used today
 *  - an array passes (e.g. TASKLIST items is declared 'object')
 *  - a string passes when it parses as a JSON object or array (e.g. gell.domain.query.run's args on a GET); the
 *    handler still receives the string and parses it
 *
 * NOTE: a blank optional argument ('' or null) passes (skip)
 */

/**
 * An argument as an object or array (undefined when it is neither, nor a JSON string of one)
 */
function toObject(val) {
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

const TYPE = {
    name: 'object',
    rules: {
        isObject: {
            default: true,
            test: val => toObject(val) !== undefined,
            message: () => 'must be an object',
        },
        // NOTE: applies to plain objects only; an array argument has no keys to check
        requiredKeys: {
            type: 'array',
            test: (val, keys) => {
                const obj = toObject(val);

                return Array.isArray(obj) || missingKeys(obj, keys).length === 0;
            },
            message: (val, keys) => `must have ${missingKeys(toObject(val), keys).join(', ')}`,
        },
    },
    default: ['isObject'],
    skip: isBlank,
};

module.exports = {
    TYPE,
    toObject,
};
