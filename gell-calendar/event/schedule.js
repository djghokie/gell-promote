const assert = require('assert');
const _ = require('lodash');

exports.__metadata = {
    name: 'timeperiod.schedule',
    description: 'schedules a target session_ in a specific time period instance',
    triggers: {
        effect: {
            params: {
                start: 'any'
            },
            context: {
                target_: 'state',
                calendar_: {
                    type: 'Calendar',
                    description: "time period instance to schedule the target_ session in"
                },
                timePeriod_: {
                    type: 'TimePeriod',
                    description: "time period that the calendar_ is an instance of"
                }
            }
        },
    }
}

/**
 * WIP: dont believe we have a concept of scheduling within a time period instance
 *  - this is actually scheduling within a CALENDAR
 *  - concept here is that I want to "schedule" a session within a specific week, month, year, etc
 *  - this might be combined with gell-schedule/event/schedule
 *      - that event requires an explicit startTs
 *  - not sure if this belongs in this package
 *      - may be more appropriate for gell-schedule
 *      - this is really "scheduling" logic
 * 
 * WIP: a little kludgy to pass both timePeriod_ and calendar_
 *  - timePeriod_ should be a property of Calendar
 * 
 * WIP: add target_ persistence through $txn
 */
exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="timeperiod.schedule")');

    const { start } = params;
    const startDateTime = _.isString(start) ? new Date(start) : start;

    const { target_, timePeriod_, calendar_ } = context;

    const startInstance = timePeriod_.instance(startDateTime);
    const offset = startDateTime - startInstance.startTs;

    const startTs = calendar_.startTs + offset;

    target_.set('startTs', startTs);

    return target_;
}
