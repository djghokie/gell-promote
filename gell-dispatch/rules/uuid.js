/**
 * Argument rules for the 'uuid' param type (TYPE format: gell-dispatch/rules/type)
 *  - extends string: a uuid is a string (isString runs first), and gets string's rules (e.g. enum)
 *  - isUuid: 8-4-4-4-12 hex digits, any version, either case
 *
 * NOTE: blanks are not allowed (as for string): an optional '' fails isUuid; leave an empty optional uuid out
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = {
    name: 'uuid',
    extends: 'string',
    rules: {
        isUuid: {
            test: val => UUID.test(val),
            message: () => 'must be a UUID',
        },
    },
    default: ['isUuid'],
};
