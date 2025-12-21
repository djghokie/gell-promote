/**
 * Stream sink that invokes an event effect.  Event trigger is passed as arguments to iterator
 * 
 * @param {*} event 
 * @param {*} deps 
 */
exports.eventSink = function* (event, deps) {
    const { logger, store } = deps.resolve('logger', 'store');

    const { __metadata } = event;

    async function invokeEvent(args={}) {
        logger.info(`invoking event (name=${__metadata.name})`);

        const $txn = store.write();

        const { context={} } = args;

        context.$txn = $txn;
        context.deps = deps;

        const ret_ = await event.effect({
            context,
            deps
        });

        await $txn.return().value;

        return ret_;
    }

    let args = yield;

    while (true) args = yield invokeEvent(args);
}
