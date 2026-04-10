// Run once: node generateVapidKeys.js
// Copy the output into your Render environment variables

import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
