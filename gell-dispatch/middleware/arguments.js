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
 * Failures ({ parameter, rule, message }) of one argument against its param spec
 *  - message is readable: it names the parameter, and is what the client gets
 */
function checkParam(name, spec, val) {
    if (isMissing(val) && !spec.optional) return [{ parameter: name, rule: 'required', message: `${name} is required` }];

    // NOTE: omitted optional parameters are not type checked
    if (val === undefined) return [];

    if (spec.type === 'string') {
        if (!_.isString(val)) return [{ parameter: name, rule: 'type', message: `${name} must be a string` }];

        if (spec.maxLength && val.length > spec.maxLength) {
            return [{ parameter: name, rule: 'maxLength', message: `${name} must be at most ${spec.maxLength} characters` }];
        }
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
