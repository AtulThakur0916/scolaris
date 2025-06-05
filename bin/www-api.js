#!/usr/bin/env node
const { app, initializeRedisClient } = require('../server');

// Remove Admin Panel routes before starting API server
app._router.stack = app._router.stack.filter((layer) => {
    if (layer.route && layer.route.path) {
        return layer.route.path.startsWith('/api/');
    }
    return true;
});

const server = require('http').Server(app);
const port = 3000;

server.listen(port, "localhost", async function () {
    console.log('API listening on port *:' + port);
    await initializeRedisClient();
});
