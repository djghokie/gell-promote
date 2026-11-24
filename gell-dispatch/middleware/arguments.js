const _ = require('lodash');

const ErrorState = require('../../gell/error');

// NOTE: validation failures are the caller's fault, so the API answers them with 400 (gell-http/next/api uses e.status)
const STATUS = 400;

/**
 * NOTE: null and '' count as not provided, so a blank form field fails here (400) rather than in the handler's assert (500)
 */
function isMissing(val) {
    return val === undefined || val === null || val === '';
}

function normalizeSpec(spec) {
    return typeof spec === 'string' ? { type: spec } : spec || {};
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
 *  - a param spec is 'string' shorthand or { type, optional, validate }; validate holds the rules, e.g.
 *      title: { type: 'string', validate: { minLength: 3, pattern: '^\\S', messages: { pattern: '...' } } }
 *  - message is readable: it names the parameter, and is what the client gets
 *  - validate.messages ({ [rule]: message }) overrides a rule's default message, e.g. a pattern's
 */
function checkParam(name, spec, val) {
    const rules = spec.validate || {};

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

    return [];
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
    const metadata = triggerSpec.params || {};

    const errors = Object.keys(metadata).flatMap(n => checkParam(n, normalizeSpec(metadata[n]), (values || {})[n]));

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
