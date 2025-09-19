const _ = require('lodash');
const assert = require('assert');
const when = require('when');

const { BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");

const DEFAULT_OPTIONS = {
    batchSize: 20,
    throttleMs: 0
}

/**
 * Implements a batch write sink
 * 
 * WIP: this only supports Put requests currently
 * 
 * @param {*} TableName 
 * @param {*} deps 
 * @param {*} options 
 */
module.exports = async function* batch(TableName, deps, options={}) {
    assert(TableName, 'TableName is required');
    assert(deps, 'deps is required');

    function commit(items) {
        const { dynamodb, logger } = deps.resolve('dynamodb', 'logger');

        const { actor } = options;
        
       logger.info(`storing items (count=${items.length}) in table (name=${TableName})`);

        const puts = items.map(item => {
            return {
                PutRequest: {
                    Item: item.snapshot ? item.snapshot(actor) : item
                },
            }
        })

        const params = {
            RequestItems: {
                [TableName]: puts
            }
        };
    
        return dynamodb.send(new BatchWriteCommand(params));
    }

    const defaultedOptions = _.defaults(options, DEFAULT_OPTIONS);

    const { batchSize, throttleMs } = defaultedOptions;

    let items = [];
	let item = yield;

    try {
        while (true) {
            items.push(item);
    
            if (items.length === batchSize) {
                await commit(items);
    
                items = [];

                if (throttleMs) await when(true).delay(throttleMs);
            }

            item = yield;
        }
    } finally {
        if (items.length > 0) await commit(items);
    }
}
