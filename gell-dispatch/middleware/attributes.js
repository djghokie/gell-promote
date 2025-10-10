const format = require('gell/state/format');

const ErrorState = require('../../gell/error');

const MESSAGE_REQUIRED_ATTRIBUTE = 'call to event trigger (route="%s") does not provide required context attribute (name="%s")';

/**
 * gell-dispatch middleware that validates event invocation context attributes against the event metadata
 * 
 * WIP: use gell-domain here to validate this correctly
 * 
 * WIP: this isn't yet re-usable because of the error message
 *  - one approach would be to collect validation failures and throw at the end
 *      - short circuit
 */
module.exports = function(event, resume) {
    const { context: values, __invocationSpec } = event;

    if (!__invocationSpec) return resume(event);

    const metadata = __invocationSpec.triggerSpec.context || {};
    const route = __invocationSpec.route;

    const keys = Object.keys(metadata || {});
    keys.forEach(n => {
        const attr = metadata[n];
        const val = values[n];

        if (val === undefined && !attr.optional) {
            /**
             * WIP: idea here is that we would materialize "error" State
             *  - include metadata about the attribute being defined
             *  - possibly include the invalid attribute value
             */
            const e = new ErrorState();
            e.set('name', 'RequiredAttributeError');
            e.set('route', route);
            e.set('attribute', n);
            e.set('message', format(MESSAGE_REQUIRED_ATTRIBUTE, 'route', 'attribute'));

            e.throw();
        }
    })

    return resume(event);
}
