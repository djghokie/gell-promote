const _ = require('lodash');

const ErrorState = require('../../gell/error');
const { compileParams } = require('../../gell-event/binding/compiler');
const { RESERVED, TYPES, validate } = require('../rules/type');

/**
 * NOTE: declarative param validation for the published gell-dispatch bus; replaces gell-dispatch/middleware/arguments
 * in a bus's middleware (the bus, attributes and roles middleware come from the gell-dispatch package)
 *
 * WIP: promote into the gell-dispatch package (with gell-dispatch/rules and gell-event/binding/compiler)
 */

// NOTE: validation failures are the caller's fault, so the API answers them with 400 (gell-http/next/api uses e.status)
const STATUS = 400;

/**
 * NOTE: null and '' count as not provided, so a blank form field fails here (400) rather than in the handler's assert (500)
 */
function isMissing(val) {
    return val === undefined || val === null || val === '';
}

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

    const TYPE = TYPES[spec.type];
    const typeFailure = TYPE && checkType(TYPE, val, rules);

    // NOTE: a TYPE's messages do not name the param
    if (typeFailure) return failure(typeFailure.rule, `${name} ${typeFailure.message}`);

    const itemFailure = spec.type === 'array' && Array.isArray(val) && checkItems(name, rules.items, val);

    if (itemFailure) return failure('items', itemFailure.message);

    // NOTE: a type without a TYPE (e.g. 'uuid') still matches an enum exactly
    if (!TYPE && Array.isArray(rules.enum) && !rules.enum.includes(val)) {
        return failure('enum', `${name} must be one of ${rules.enum.join(', ')}`);
    }

    if (_.isFunction(spec.validate)) return checkFunction(name, spec.validate, val, _.omit(values, name));

    return [];
}

/**
 * The failure ({ rule, message }) of an argument against its type's TYPE (gell-dispatch/rules/type validate), or
 * undefined when it passes
 *  - TYPES (gell-dispatch/rules/type) maps param types to their TYPE; a type without one is not checked (only the
 *    rules every param shares: required, a validate function, and an enum, matched exactly)
 *  - the reserved validate keys (messages, items) are not the type's rules, so validate does not get them
 *
 * NOTE: only a RuleValidationError is a validation failure; anything else (e.g. the AssertionError for a rule the
 * type does not define) is a bug, so it propagates (500)
 */
function checkType(TYPE, val, rules) {
    try {
        validate(val, _.omit(rules, RESERVED), TYPE);
    } catch (e) {
        if (e.name !== 'RuleValidationError') throw e;

        return { rule: e.rule, message: e.message };
    }
}

/**
 * The first failure ({ parameter, rule, message }) of an array's items against its items spec (validate.items, a
 * compiled param), each checked like a param named name[index] (an item has no other params to pass a validate
 * function)
 */
function checkItems(name, spec, items) {
    if (spec === undefined) return;

    for (let i = 0; i < items.length; i++) {
        const failure = checkParam(`${name}[${i}]`, spec, items[i], {})[0];

        if (failure) return failure;
    }
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
