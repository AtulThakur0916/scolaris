#!/usr/bin/env node
const { app, initializeRedisClient } = require('../server');

// Remove API routes before starting admin server
app._router.stack = app._router.stack.filter((layer) => {
    if (layer.route && layer.route.path) {
        return !layer.route.path.startsWith('/api/');
    }
    return true;
});

const server = require('http').Server(app);
const port = 4000;

server.listen(port, "localhost", async function () {
    console.log('Admin listening on port *:' + port);
    await initializeRedisClient();
});
