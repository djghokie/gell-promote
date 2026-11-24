const _ = require('lodash');

const format = require('gell/state/format');

const ErrorState = require('../../gell/error');

const MESSAGE_REQUIRED_PARAMETER = 'call to event trigger (route="%s") does not provide required argument (name="%s")';
const MESSAGE_PARAMETER_MAXLENGTH = 'call to event trigger (route="%s") has argument (name="%s") that exceeds maximum allowed length';
const MESSAGE_PARAMETER_TYPE = 'call to event trigger (route="%s") has argument (name="%s") that is not of type (type="%s")';

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
 * gell-dispatch middleware that validates event invocation parameters against the event metadata
 * 
 * WIP: use gell-domain here to validate this correctly
 * 
 * WIP: this isn't yet re-usable because of the error message
 *  - one approach would be to collect validation failures and throw at the end
 *      - short circuit
 */
module.exports = function(event, resume) {
    const { params: values, __invocationSpec } = event;
    
    if (!__invocationSpec) return resume(event);
    
    const metadata = __invocationSpec.triggerSpec.params || {};

    const keys = Object.keys(metadata || {});
    keys.forEach(n => {
        const param = normalizeSpec(metadata[n]);
        const val = (values || {})[n];

        if (isMissing(val) && !param.optional) {
            const e = new ErrorState();
            e.set('name', 'RequiredParameterError');
            e.set('status', STATUS);
            e.set('route', __invocationSpec.route);
            e.set('parameter', n);
            e.set('message', format(MESSAGE_REQUIRED_PARAMETER, 'route', 'parameter'));

            e.throw();
        }

        // NOTE: omitted optional parameters are not type checked
        if (val === undefined) return;

        if (param.type === 'string') {
            if (!_.isString(val)) {
                const e = new ErrorState();
                e.set('name', 'ParameterValidationError');
                e.set('status', STATUS);
                e.set('route', __invocationSpec.route);
                e.set('parameter', n);
                e.set('type', param.type);
                e.set('message', format(MESSAGE_PARAMETER_TYPE, 'route', 'parameter', 'type'));

                e.throw();
            }

            if (param.maxLength) {
                if (val.length > param.maxLength) {
                    const e = new ErrorState();
                    e.set('name', 'ParameterValidationError');
                    e.set('status', STATUS);
                e.set('status', STATUS);
                    e.set('route', __invocationSpec.route);
                    e.set('parameter', n);
                    e.set('message', format(MESSAGE_PARAMETER_MAXLENGTH, 'route', 'parameter'));

                    e.throw();
                }
            }
        }
    })

    return resume(event);
}

