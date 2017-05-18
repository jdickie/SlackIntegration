var request = require('request'),
querystring = require('querystring');

var checkIfThingPublished = (event, callback) =>
{
    try {
        if (event.text === 'undefined') {
            callback("No thingId specified");
            return;
        }
        var ApiKey = process.env.storyapi;
        var url = "https://api.npr.org/query?apiKey=" + ApiKey + "&id=" + event.text + "&output=JSON";
        console.log("Url:", url)
        request({
            url: url,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            json: true
        }, function (err, res, body) {
            if (err) {
                callback(err);
                return;
            }
            if (body !== null) {
                // Body should be JSON
                if (body.list.story && body.list.story.length) {
                    if (body.list.story[0].id !== event.text) {
                        noStoryFoundMessage(event, callback);
                        return;
                    }
                    var date = body.list.story[0].pubDate.$text,
                        link = null;
                    // Getting story link here
                    for (var i = 0; i < body.list.story[0].link.length; i++) {
                        if (body.list.story[0].link[i].type == "html") {
                            link = body.list.story[0].link[i].$text;
                            break;
                        }
                    }

                    callback(null, {
                        date: date,
                        link: link
                    });
                } else {
                    noStoryFoundMessage(event, callback);
                }
            } else {
                noStoryFoundMessage(event, callback);
            }
        });
    } catch (err) {
        callback(err.message);
    }
}

var noStoryFoundMessage = (json, callback) => {
    request({
        url: process.env.webhookUrl,
        method: 'POST',
        json: true,
        body: {
            "text": "No Story Found! This likely means that your story is _not_ published.",
            "attachments": [{
                "fallback": "Could not find a published story in our API system matching the ID " + json.text,
                "text": "No story was found in the story API matching " + json.text + ". Check this <http://www.npr.org/xstory/" + json.text + "?live=1|URL> inside " +
                "the building in order to see if something shows up. If it does, this means the story is saved but not published."

            }]
        }
    }, function (err, res, body) {
        if (err) {
            callback(null, {"text": err.message});
        }
        callback(null);
    });
}

var sendBackHelpText = (callback) => {
    try {
        var response = {
            "text": "Emergency? If during work hours (9am - 5pm) " +
            "please contact <" + process.env.onlinetechEmail + "|onlinetech>. " +
            "Off hours? Then call the number below after reading the instructions.",
            attachments: [{
                "text": "Please only use in an off-hours emergency: \n" +
                "• Seamus is down or unreachable \n " +
                "• You can't publish / update breaking news or a story that, if not updated, negatively impacts the mission of NPR \n " +
                "• The web site is completely unreachable \n " +
                "• The home page is blank or missing content. \n\n (Refer to " +
                "<http://confluence.npr.org/display/OPS/Digital+Media+Support|this guide in Confluence> for more details on what constitutes an emergency.)",
                "fields": [{
                    "title": "Emergency Dev Hotline",
                    "value": process.env.emergencyNumber
                }]
            }]
        };

        request({
            url: process.env.webhookUrl,
            body: response,
            json: true,
            method: 'POST'
        }, function(err, res, body) {
            if (err) {
                callback(null, {"text": err.message});
            }
            callback(null);
        });
    } catch (err) {
        console.log(err);
        callback(null, { "text": err.message });
    }
}

var getItemsFromMessyBody = (body, callback) =>
{
    try {
        var token = body.match(/token=([A-z0-9]+)&/)[1],
            command = body.match(/command=%2F([A-z]+)&/)[1],
            text = body.match(/text=([0-9]+)&/),
            responseUrl = body.match(/response_url=([A-z0-9.%]+)/)[1].replace(/%2F/g, '/').replace(/%3A/g, ':');

            if (text !== null && text[1] !== null) {
                text = text[1];
            }
        callback(null, {
            token: token,
            command: command,
            text: text,
            responseUrl: responseUrl
        });
    } catch (err) {
        console.log(err);
        callback(err);
    }
}

var formatForSlack = (results, responseUrl, callback) =>
{
    try {
        var formattedText = {
            "text": "Last published on: " + results.date
        };
        if (results.link) {
            formattedText.attachments = [{
                "title": "See story on the live website now.",
                "title_link": results.link
            }];
        }
        console.log("response url: ", process.env.webhookUrl);
        request({
            url: process.env.webhookUrl,
            method: 'POST',
            body: formattedText,
            json: true
        }, callback);
    } catch (err) {
        console.log(err);
        callback(null, "An error occurred " + err.message);
    }
}

exports.handler = (event, context, callback) =>
{
    console.log("Event: ", event);
    try {
        getItemsFromMessyBody(event.body, function (err, json) {
            if (err) {
                callback(null, {
                    "err": err.message
                })
            }
            console.log("json", json);
            if (json.command == "diditpublish" && json.text) {
                checkIfThingPublished(json, function (err, results) {
                    if (err !== null) {
                        callback(err);
                    }
                    console.log("results: ", results);

                    formatForSlack(results, json.responseUrl, callback);
                })
            } else {
                sendBackHelpText(callback);
            }
        });
    } catch (err) {
        console.log(err);
        callback(null, {
            "text": "An error occurred: " + err.message
        });
    }
}
;
