/**
 * WIP: ported from EI
 */

const assert = require('assert');
const _ = require('lodash');

const { format } = require('date-fns');

/**
 * WIP: time period definitions should be defined externally
 * 	- some common such as DAY, WEEK, etc pre-defined
 * 	- others are application specific such as PAY_PERIOD, SEASON, etc
 */
const TIME_PERIODS = {
	ACTIVE: z => 'ACTIVE',
	HISTORY: z => 'HISTORY',  // maybe a better name for this; total historical metrics

	YEAR: ts => format(ts, 'yyyy'),
	MONTH: ts => format(ts, 'yyyy-MM'),
	WEEK: ts => `${format(ts, 'yyyy')}-W${format(ts, 'ww')}`,
	DAY: ts => format(ts, 'yyyy-MM-dd'),

	HOUR: ts => format(ts, 'yyyy-MM-dd-HH'),  // not tested
}

const ALL_TIME_PERIODS = "ACTIVE,HOUR,DAY,WEEK,MONTH,YEAR,HISTORY"

/**
 * Retrieves metrics
 * 
 * QUERY PARAMETERS
 * 	- subject: subject of the query; either subject or type but not both must be supplied
 * 	- type: subject type; either subject or type but not both must be supplied
 * 	- startTs: optional; active metrics will be queried otherwise
 * 	- endTs: optional;
 * 	- includeActive (WIP): not sure there is a use case for this
 * 	- aggregate (WIP); how to resolve start/end arguments to month, day, hour, etc
 * 	- resolution (WIP): this would be to query for all time periods (i.e. days) under the aggregate
 * 
 * @param {*} context 
 * @returns 
 */
module.exports = async context => {
	let { metricStore } = await context.deps.resolve('metricStore');

	let { subject, type, timePeriod=ALL_TIME_PERIODS, startTs, endTs } = context.req.query;

	assert(subject || type, 'must supply either subject or type parameters');
	if (subject) assert(_.isUndefined(type), 'cant supply both subject and type');

	let startTimePeriod, endTimePeriod;
	let startTimePeriods = timePeriod.split(',').map(tp => {
		let def = TIME_PERIODS[tp.trim()];

		assert(def, `unknown time period (${timePeriod})`);

		let ts = startTs ? parseInt(startTs) : Date.now();

		return def(ts);
	});

	if (subject) {
		let metrics = [];

		let queries = startTimePeriods.map(timePeriod => metricStore.querySubject({ subject, timePeriod }));

		let results = await Promise.all(queries);

		results.forEach(r => metrics.push(...r));

		return metrics;
	} else {
		let metrics = [];

		let queries = startTimePeriods.map(timePeriod => metricStore.queryType({ subjectType: type, timePeriod }));

		let results = await Promise.all(queries);

		results.forEach(r => metrics.push(...r));

		return metrics;
	}
}
