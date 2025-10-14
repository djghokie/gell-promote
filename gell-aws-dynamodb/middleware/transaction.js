const format = require('gell/state/format');

const ErrorState = require('../../gell/error');

const MESSAGE_EXISTING_TRANSACTION = 'call to event trigger (route="%s") provides existing transaction';
const MESSAGE_MISSING_TRANSACTION = 'call to event trigger (route="%s") does not provide transaction';

function createError(name, route) {
    const e = new ErrorState();
    e.set('name', name);
    e.set('route', route);

    return e;
}

/**
 * gell-dispatch middleware that manages Dynamodb transactions during event execution
 * 
 * @param {*} event 
 * @param {*} resume 
 * @returns 
 */
module.exports = async function(event, resume) {
    const { context, deps, __invocationSpec } = event;

    if (!__invocationSpec) return resume(event);

    const transactionMode = __invocationSpec.triggerSpec.transaction || 'NONE';
    const { route, eventName, triggerName } = __invocationSpec;

    if (transactionMode === 'NEW') {
        if (context.$txn) {
            const e = createError('InvalidTransactionState', route);
            e.set('eventName', eventName);
            e.set('trigger', triggerName);
            e.set('message', format(MESSAGE_EXISTING_TRANSACTION, 'eventName'));

            e.throw();
        }

        const store = deps.resolveSingle('store');
        var $txn = store.write();
        context.$txn = $txn;
    } else if (transactionMode === 'REQUIRED') {
        if (!context.$txn) {
            const e = createError('InvalidTransactionState', route);
            e.set('eventName', eventName);
            e.set('trigger', triggerName);
            e.set('message', format(MESSAGE_MISSING_TRANSACTION, 'route'));

            e.throw();
        }
    } else if (transactionMode === 'JOIN') {
        if (!context.$txn) {
            const store = deps.resolveSingle('store');
            var $txn = store.write();
            context.$txn = $txn;
        }
    }

    const result = await resume(event);

    if ($txn) await $txn.return().value;

    return result;
}
