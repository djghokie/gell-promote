const assert = require('assert');
const _ = require('lodash');

const { State } = require('gell');
const { isIterator } = require('gell/util');
const format = require('gell/state/format');
const ErrorState = require('../gell/error');

const chain = require('./util/chain');

const MESSAGE_MISSING_TRIGGER = 'route (name="%s") does not define trigger function (name="%s")';

function validateMiddleware(middleware) {
    middleware.forEach(m => {
        assert(_.isFunction(m));
    });
}

/**
 * Trigger execution of an event.  Result of the event is yielded
 * 
 * NOTE: this is a rewrite of gell-session implementation
 *  - implements middleware concept now
 * 
 * WIP: bus middleware
 *  - outstanding questions
 *      - should lookup be outside of dispatcher
 *  - middleware use cases
 *      - logging
 *      - transaction management
 *      - parameter validation
 *      - argument type wrangling
 *      - performance monitoring
 *      - audit logging
 *      - error handling
 *      - item lookups
 *      - batch persistence
 *      - rate limiting
 *  - event should be able to define their own middleware?
 *      - inject it in chain?
 *  - declarative middleware?
 * 
* WIP: middleware requirements
*  - you are "wrapping" an invocation, so you must eventually call it
*      - how to you "yield" to the chain
*  - middleware will often need to maintain state or configuration
*      - i.e. "batch size" or "log level"
*      - implies we need a generator or object
*  - testable individually
* 
* WIP: declarative middleware
*  - define functions for different touchpoints
*      - initialize
*      - before
*      - after
*      - error
 * 
 * WIP: how to provide event catalog
 *  - unclear at this point, but this should probably not use the low level $resolver
 *      - use Directory instead
 *  - route name scheme?
 *      - for now
 *          - 'my.event#trigger'
 *      - seems like URL like names could work well
 * 
 * WIP: implement dispatching features
 *  - validate user is authorized to make call
 *  - custom, event specific validation
 *      - for session update, validate attribute is modifiable
 * 
 * WIP: consolidate with dispatcher implementations
 * 
 * WIP: how to handle event State
 *  - could follow emitter pattern
 *      - node events are async tho which causes problem in Next environments
 *  - could follow custom emitter pattern
 *      - really this is just using the $bus to dispatch event effects
 *  - provide callback argument to next
 *  - middleware
 * 
 * WIP: provide future support
 *  - options
 *      - short circuit/validation stack
 *  - trigger specific middlware
 *      - always do X for action triggers
 *  - argument to type wrangling
 */
module.exports = function*($resolver, middleware, deps) {
    assert(isIterator($resolver), '$resolver is required');
    assert(deps, 'deps is required');

    validateMiddleware(middleware);

    async function dispatch({ route, caller, source, context={}, params={}, deps, invoke=true }) {
        assert(_.isString(route), 'event route is required');

        const [eventModule, { f: triggerF }, { resource: eventName, f: triggerName }] = $resolver.next(route).value;

        assert(eventName, `route (name=${route}) is invalid; missing event name`);
        assert(triggerName && triggerName.length > 0, `route (name=${route}) is invalid; missing trigger name`);
        assert(eventModule, `no event (route=${route})`);

        const logger = deps.resolveSingle('logger');

        logger.info(`dispatching event (name=${eventName}, trigger=${triggerName})`);

        if (!_.isFunction(triggerF)) {
            const e = new ErrorState();
            e.set('name', 'InvalidEventModule');
            e.set('route', route);
            e.set('eventName', eventName);
            e.set('trigger', triggerName);
            e.set('message', format(MESSAGE_MISSING_TRIGGER, 'eventName', 'trigger'));

            e.throw();
        }

        const event = {
            caller,
            source,
            params,
            context,
            deps
        };

        const { __metadata:md } = eventModule;
        if (md) {
            const { triggers={} } = md;
            const trigger = triggers[triggerName];
            if (trigger) {
                event.__invocationSpec = {
                    route,
                    eventName,
                    triggerName,
                    triggerSpec: trigger
                };
            }
        }

        const chainFunctions = [...middleware];

        if (invoke) chainFunctions.push(triggerF);
        else chainFunctions.push(event => event);

        try {
            return chain(...chainFunctions)(event);
        } catch (ex) {
            logger.error(`middleware threw an error`);

            throw ex;
        }
    }

    let args = yield new State();

    while (true) {
        const defaults = {
            deps
        };

        const t = Object.assign(defaults, _.isString(args) ? { route: args } : (args || {}));

        args = yield dispatch(t);
    }
}
