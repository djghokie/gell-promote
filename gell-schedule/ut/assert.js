const assert = require('assert');
const _ = require('lodash');

const {
    zonedTimeToUtc
} = require('date-fns-tz');

const assertions = require('gell-schedule/ut/assert');

/**
 * NOTE: straight copy from gell-schedule
 * 
 * @param {*} arg 
 * @returns 
 */
function dateFromArg(arg) {
	assert(arg);

	if (_.isDate(arg)) return arg;
	if (_.isNumber(arg) || _.isString(arg)) return new Date(arg);

	throw new Error(`invalid date argument ${arg}`);
}

/**
 * Overridding gell-schedule implementation
 *  - added timeZone argument
 */
const assertDate = {
	same: (actual, expected, timeZone) => {
		const actualD = dateFromArg(actual);
		
        let expectedD = dateFromArg(expected);
        if (timeZone) expectedD = zonedTimeToUtc(expectedD, timeZone);

		return assertions.assertTimestamp.same(actualD.getTime(), expectedD.getTime());
	}
}

module.exports = {
    ...assertions,
    assertDate
}
