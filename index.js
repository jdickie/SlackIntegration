var request = require('request');

var checkIfThingPublished = (event, callback) => {
    try {
      if (event.text === 'undefined') {
        callback("No thingId specified");
        return;
      }
      var ApiKey = process.env.storyapi;
      var url = "https://api.npr.org/query?apiKey=" + ApiKey + "&id=" + event.thingid + "&output=JSON";
      request({
        url: url,
        method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          json: true
      }, function(err, res, body) {
        if (err) {
          callback(err);
          return;
        }
        if (body !== null) {
          // Body should be JSON
            if (body.list.story && body.list.story.length) {
                var date = body.list.story[0].pubDate.$text,
                link = null;
                // Getting story link here
                for (var i=0; i < body.list.story[0].link.length; i++) {
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
                callback("No story found");
            }
        }
      });
    } catch (err) {
      callback(err.message);
    }
}


var getItemsFromMessyBody = (body, callback) => {
    try {
        var token = body.match(/token=([A-z0-9]+)&/)[1],
            command = body.match(/command=%2F([A-z]+)&/)[1],
            text = body.match(/text=([0-9]+)&/)[1];
        callback(null, {
            token: token,
            command: command,
            text: text
        });
    } catch(err) {
        console.log(err);
        callback(err);
    }
}

var formatForSlack = (results, callback) => {
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
        callback(null, formattedText);
    } catch (err) {
        console.log(err);
        callback("An error occurred");
    }

}

exports.handler = (event, context, callback) => {
    try {
        getItemsFromMessyBody(event.body, function(err, json) {
            if (err) {
                throw new err(err.message);
            }
            if (json.command == "diditpublish") {
                checkIfThingPublished(json, function(err, results) {
                    if (err !== null) {
                        callback(err);
                    }

                    formatForSlack(results, callback);
                })
            } else {
                callback(null, 'Hello from Lambda');
            }
        });
    } catch (err) {
        console.log(err);
        callback(null, {
            "text": "An error occurred: " + err.message
        });
    }
};
