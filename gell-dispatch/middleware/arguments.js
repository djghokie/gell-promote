const _ = require('lodash');

const ErrorState = require('../../gell/error');
const { compileParams } = require('../../gell-event/binding/compiler');

// NOTE: validation failures are the caller's fault, so the API answers them with 400 (gell-http/next/api uses e.status)
const STATUS = 400;

/**
 * NOTE: null and '' count as not provided, so a blank form field fails here (400) rather than in the handler's assert (500)
 */
function isMissing(val) {
    return val === undefined || val === null || val === '';
}

/**
 * Rules (in a param spec's validate) for string arguments, in the order they are checked (the first failure is reported)
 *  - minLength/maxLength: number of characters
 *  - pattern: a regular expression source string (or RegExp); it is not anchored, so use ^ and $ to match the whole
 *    value
 *
 * NOTE: declare pattern as a string: a RegExp does not survive JSON, so the action page could not show it
 */
const STRING_RULES = [
    ['minLength', (val, min) => val.length >= min, (name, min) => min === 1 ? `${name} cannot be empty` : `${name} must be at least ${min} characters`],
    ['maxLength', (val, max) => val.length <= max, (name, max) => `${name} must be at most ${max} characters`],
    ['pattern', (val, pattern) => new RegExp(pattern).test(val), (name, pattern) => `${name} must match ${pattern}`],
];

/**
 * Failures ({ parameter, rule, message }) of one argument against its param spec
 *  - spec is a compiled param (gell-event/binding/compiler): { name, type, optional, validate }; validate holds the
 *    rules (or is a function, see checkFunction), e.g.
 *      title: { type: 'string', validate: { minLength: 3, pattern: '^\\S', messages: { pattern: '...' } } }
 *  - message is readable: it names the parameter, and is what the client gets
 *  - validate.messages ({ [rule]: message }) overrides a rule's default message, e.g. a pattern's
 */
function checkParam(name, spec, val, values) {
    const rules = _.isPlainObject(spec.validate) ? spec.validate : {};

    const failure = (rule, message) => [{ parameter: name, rule, message: (rules.messages || {})[rule] || message }];

    if (isMissing(val) && !spec.optional) return failure('required', `${name} is required`);

    // NOTE: omitted optional parameters are not type checked
    if (val === undefined) return [];

    if (spec.type === 'string') {
        if (!_.isString(val)) return failure('type', `${name} must be a string`);

        for (const [rule, check, message] of STRING_RULES) {
            if (rules[rule] !== undefined && !check(val, rules[rule])) return failure(rule, message(name, rules[rule]));
        }
    }

    if (Array.isArray(rules.enum) && !rules.enum.includes(val)) {
        return failure('enum', `${name} must be one of ${rules.enum.join(', ')}`);
    }

    if (_.isFunction(spec.validate)) return checkFunction(name, spec.validate, val, _.omit(values, name));

    return [];
}

/**
 * A param's validate may be a function instead of rules: validate(value, params)
 *  - params is a map of the call's other arguments, for checks across parameters (e.g. startTs before endTs)
 *  - returns true (or undefined) when valid, a string to fail with that (readable) message, or false to fail with a
 *    generic one
 *  - runs after the type check, and not for an omitted optional parameter
 *
 * NOTE: a function that throws is a bug in the check, not a validation failure, so the error propagates (500)
 *
 * WIP: synchronous only; an async check (e.g. a lookup) would need the middleware to await it
 */
function checkFunction(name, validate, val, params) {
    const result = validate(val, params);

    if (result === true || result === undefined) return [];

    const message = _.isString(result) ? result : `${name} is not valid`;

    return [{ parameter: name, rule: 'validate', message }];
}

/**
 * gell-dispatch middleware that validates event invocation parameters against the event metadata
 *  - collects every failure of the call, then throws one ParameterValidationError (status 400) whose message joins
 *    the readable messages with '; ', and whose errors lists the failures ({ parameter, rule, message })
 *
 * WIP: errors stays server-side (logs, tests, direct callers); per-field form errors need gell-http (or a wrapper)
 * and bh-react useAction to pass errors through to the browser
 *
 * WIP: use gell-domain here to validate this correctly
 */
module.exports = function(event, resume) {
    const { params: values, __invocationSpec } = event;

    if (!__invocationSpec) return resume(event);

    const { route, triggerSpec } = __invocationSpec;
    const params = compileParams(triggerSpec.params);

    const errors = Object.values(params).flatMap(spec => checkParam(spec.name, spec, (values || {})[spec.name], values || {}));

    if (errors.length) {
        const logger = event.deps && event.deps.resolveSingle({ name: 'logger', optional: true });

        if (logger) {
            errors.forEach(({ parameter, rule }) => logger.info(`parameter validation failed (route="${route}"; parameter="${parameter}"; rule="${rule}")`));
        }

        const e = new ErrorState();
        e.set('name', 'ParameterValidationError');
        e.set('status', STATUS);
        e.set('route', route);
        e.set('errors', errors);
        e.set('message', errors.map(({ message }) => message).join('; '));

        e.throw();
    }

    return resume(event);
}
