'use strict';
const aws = require('aws-sdk');
const uuidv4 = require('uuidv4');
const dynamodb = new aws.DynamoDB();
const tableName = process.env.TABLE_NAME;
const primaryKey = process.env.PRIMARY_KEY;


/**
 * This function expects Lex events and logs intents and
 * session variables to DynamoDB.
 * 
 * Incoming events are routed based on intent.
 */
exports.handler = (event, context, callback) => {
    try {
        // By default, treat the user request as coming from the America/New_York time zone.
        process.env.TZ = 'America/New_York';
        console.log(`event.bot.name=${event.bot.name}`);
        
        // Output the event in a JSON format we can easily copy and paste
        // from the Cloudwatch logs to facilitate debugging.
        console.log(JSON.stringify(event, null, 4));

        /**
         * Uncomment this if statement and populate with your Lex bot name, alias and / or version as
         * a sanity check to prevent invoking this Lambda function from an undesired source.
         */

        // Get the intent name.  Intent names should match
        // what you see in the AWS Lex Console
        const intentName = event.currentIntent.name;

        // Dispatch to the correct intent handler
        if (intentName === 'Ping') {
            return ping(event, callback);
        } else if (intentName === 'GetServiceInfo') {
            return logIntent(event, callback);
        }
        // Handle unknown intents
        throw new Error(`Intent with name ${intentName} not supported`);
    } catch (err) {
        callback(err);
    }
};

/**
 * This provides a quick way to check connectivity
 * between Lex and this function.
 */
function ping(event, callback) {
    let callbackObj = {
        dialogAction: {
            type: 'Close',
            fulfillmentState: "Fulfilled",
            message: {
                contentType: "PlainText",
                content: "Pong!"
            }
        }
    };
    callback(null, callbackObj);
}

/**
 * This is to hanlde the "LogIntent" intent.
 * Any intent phrases from LogIntent that Lex matches will be
 * logged here.
 * 
 * @param {} event 
 * @param {*} callback 
 */
function logIntent(event, callback) {
    try {
        let docClient = new aws.DynamoDB.DocumentClient({region: process.env.AWS_REGION});
        
        // Load the data we need to save from the input event into an object
        let item = {
            "currentIntent": event.currentIntent,
            "inputTranscript": event.inputTranscript,
            "requestAttributes": event.requestAttributes,
            "sessionAttributes": event.sessionAttributes
        };
        item[primaryKey] = uuidv4.uuid();

        console.log('intent name =======>'+event.currentIntent.name);
        console.log('servicename=======>'+event.currentIntent.slots.servicename);
        console.log('current intent=========>'+event.currentIntent);
        console.log('inputTranscript=========>'+event.inputTranscript);
        console.log('requestAttributes=========>'+event.requestAttributes);
        console.log('sessionAttributes=========>'+event.sessionAttributes);
        // Note the data object we are sending to DynamoDB
        console.log(JSON.stringify(params, null, 4));

        if(event.currentIntent.name=="GetServiceInfo"){
            console.log("======> Query");
            var params = {
                TableName : tableName,
                ProjectionExpression:"LexLogId, servicevalue",
                KeyConditionExpression: "LexLogId = :name",
                ExpressionAttributeValues: {
                    ":name": event.currentIntent.slots.servicename
                }
            };
            console.log('=========>'+params);
            docClient.query(params, function(err, data) {
                if (err) {
                    console.log("Unable to query. Error:", JSON.stringify(err, null, 2));
                } else {
                    console.log("Query succeeded.");
                    data.Items.forEach(function(item) {
                        console.log(" -", item.LexLogId + ": " + item.servicevalue);
                        let callbackObj = {
                            dialogAction: {
                                type: 'Close',
                                fulfillmentState: "Fulfilled",
                                message: {
                                    contentType: "PlainText",
                                    content: item.servicevalue
                                }
                            }
                        };
                        // Save the response we are sending back to Lex in
                        // the Cloudwatch logs.
                        console.log('Logged!');
                        console.log(JSON.stringify(callbackObj, null, 4));
                        callback(null, callbackObj);
                    });
                }
            });
        }
        else{
            console.log('Putting to DynamoDB');
            docClient.put(params, function(err, data) {
                if(err) {
                    console.log('Error occurred on DynamoDB put.');
                    console.log(err);
                    callback(err);
                } else {
                    let callbackObj = {
                        dialogAction: {
                            type: 'Close',
                            fulfillmentState: "Fulfilled",
                            message: {
                                contentType: "PlainText",
                                content: "Logged!"
                            }
                        }
                    };
                    // Save the response we are sending back to Lex in
                    // the Cloudwatch logs.
                    console.log('Logged!');
                    console.log(JSON.stringify(callbackObj, null, 4));
                    callback(null, callbackObj);
                }
            });
        }
        
        //}
    } catch (err) {
        callback(err);
    }
}
