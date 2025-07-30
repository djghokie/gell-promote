const assert = require('assert');

const { BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");

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

    const batchSize = 20;

    let items = [];
	let item = yield;

    try {
        while (true) {
            items.push(item);
    
            if (items.length === batchSize) {
                await commit(items);
    
                items = [];
            }
    
            item = yield;
        }
    } finally {
        if (items.length > 0) await commit(items);
    }
}
