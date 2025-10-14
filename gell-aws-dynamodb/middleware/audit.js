const _ = require('lodash');

const eventType = require('../../gell-session/domain/event');

/**
 * WIP: need to set parentId of the event
 *  - get parent_ session from context
 *  - use metadata to determine context key
 * 
 * @param {*} event 
 * @param {*} resume 
 * @returns 
 */
module.exports = async function(event, resume) {
    const { context, deps, __invocationSpec } = event;

    if (!__invocationSpec) return resume(event);

    const { logger, store } = deps.resolve('logger', 'store');

    const { eventName } = __invocationSpec;

    // console.debug('#####', __invocationSpec);

    try {
        var event_ = eventType.materialize({
            name: eventName,
        });

        var result = await resume(event);

        // event_.set('parentId', parent_.id);
        event_.set('status', 'SUCCESS');
    } catch (e) {
        logger.error(e);

        event_.set('status', 'FAILED');

        var error = e;
    } finally {
        await store.save(event_);

        if (error) throw error;

        return result;
    }
}
