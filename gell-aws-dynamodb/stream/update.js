const { UpdateCommand } = require("@aws-sdk/lib-dynamodb");

/**
 * WIP: initial attempt at sink implementation that updates a single item attribute
 *  - uses a callback to determine item key and attribute to update
 *  - batch update functionality does not exist in Dynamodb
 *      - except for partiQL implementation
 *  - other approaches might be better
 *      - named operation or parameterized query
 *          - would be more of a generalized operation sink (not just updates)
 *      - State/actor to specify key and attribute to update
 *      - update command derived from item
 *          - pass in projection model as option
 * 
 * @param {*} tableName 
 * @param {*} valueCallback 
 * @param {*} deps 
 */
module.exports = async function* updateSink(tableName, valueCallback, deps) {
    const { dynamodb, logger } = deps.resolve('dynamodb', 'logger');

    function doUpdate(item) {
        const { key, attribute, value } = valueCallback(item);

		const params = {
			TableName: tableName,
			Key: key,
			Update: {
				UpdateExpression: 'SET #attribute=:value, updatedTs=:updatedTs',
				ExpressionAttributeNames: {
					'#attribute': attribute,
				},
				ExpressionAttributeValues: {
					':value': value,
					':updatedTs': Date.now(),
				}
			}
		}
	
        // console.debug('#####', params);

		return dynamodb.send(new UpdateCommand(params));
    }

	let item = yield;

	while (true) {
        await doUpdate(item);

		item = yield;
	}
}
