const assert = require('assert');
const _ = require('lodash');

/**
 * gell-dispatch middleware associating a namespace with the event context, under a specified key
 *  - this is for statically loaded namespaces, often ecosystems or applications
 * 
 * WIP: this could probably be generalized further (not namespace specific)
 * 
 * @param {*} event 
 * @param {*} resume 
 * @returns 
 */
module.exports = function(key, namespace) {
    assert(_.isString(key));
    assert(!_.isUndefined(namespace));
    
    return async function(event, resume) {
        const { context, deps, __invocationSpec } = event;
    
        context[key] = namespace;
    
        return resume(event);
    }    
}
