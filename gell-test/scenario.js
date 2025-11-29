const _ = require('lodash');

/**
 * Runs a test scenario
 * 
 * WIP: currently returns last yielded if scenario returns undefined
 *  - not sure if this is how I want this to work
 *  - see unit tests for more
 * 
 * @param {*} $scenario 
 * @returns 
 */
async function runScenario($scenario) {
    do {
        try {
            var next = await $scenario.next();
    
            if (!next.done) var lastYielded = next.value;
        } catch (e) {
            console.error('error caught running scenario');

            throw e;
        }
    } while (!next.done);

    return _.isUndefined(next.value) ? lastYielded : next.value;
}

module.exports = runScenario;
