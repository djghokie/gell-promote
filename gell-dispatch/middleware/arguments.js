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
 * Rules implementation by param type: { check(name, value, rules) => { rule, message } | undefined }
 *  - check runs for a provided argument: it checks the type, then the type's rules from the param's validate, and
 *    returns the first failure
 *  - a type without an entry is not checked (only the rules every type shares: required, enum, a validate function)
 */
const TYPE_RULES = {
    string: require('../rules/string'),
};

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

    const typeRules = TYPE_RULES[spec.type];
    const typeFailure = typeRules && typeRules.check(name, val, rules);

    if (typeFailure) return failure(typeFailure.rule, typeFailure.message);

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
