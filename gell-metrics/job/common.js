/**
 * Common utilities for working with metric rebuild jobs
 * 
 * NOTES:
 * 	- relies on a standard object format for collecting metrics
 * 
	subject_type: {
		subject: {
			timePeriod: {
				metric: metricValue
			}
		}
	}
 */

const assert = require('assert');
const _ = require('lodash');

const { UpdateCommand } = require("@aws-sdk/lib-dynamodb");

function increment(path, metrics, val=1) {
	let existing = _.get(metrics, path) || 0;

	_.set(metrics, path, existing + val);
}

async function persistMetrics(metrics, deps, tablePrefix) {
	assert(metrics);
	assert(deps);
	assert(tablePrefix);

	const { dynamodb, logger } = await deps.resolve('dynamodb', 'logger');

	Object.keys(metrics).forEach(subjectType => {
		const stm = metrics[subjectType];
		
		Object.keys(stm).forEach(subject => {
			const sm = stm[subject];

			Object.keys(sm).forEach(timePeriod => {
				const tpm = sm[timePeriod];
				
				Object.keys(tpm).forEach(async metric => {
					const val = tpm[metric];
					
					logger.info(`persisting metrics (subjectType=${subjectType}; subject=${subject}; timePeriod=${timePeriod}; metric=${metric}; val=${val})`);
					
					await dynamodb.send(new UpdateCommand({
						TableName: `${tablePrefix}.metric`,
						Key: { subject, timePeriod },
						UpdateExpression: `SET ${metric}=:${metric}`,
						ExpressionAttributeValues: {
							[`:${metric}`]: val,
						},
					}));
				})
			})
		})
	})
}

module.exports = {
	increment,
	persistMetrics
}