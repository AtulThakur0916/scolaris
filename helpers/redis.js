const {createClient} = require("redis");
const hash = require("object-hash");

// initialize the Redis client variable
let redisClient = undefined;

async function initializeRedisClient() {
    // read the Redis connection URL from the envs
    let redisURL = process.env.REDIS_URI;
    if (redisURL) {
        // create the Redis client object
        redisClient = createClient({url: redisURL}).on("error", (e) => {
            console.error(`Failed to create the Redis client with error:`);
            console.error(e);
        });

        try {
            // connect to the Redis server
            await redisClient.connect();
            console.log(`Connected to Redis successfully!`);
        } catch (e) {
            console.error(`Connection to Redis failed with error:`);
            console.error(e);
        }
    }
}

function requestToKey(req) {
    // build a custom object to use as part of the Redis key
    const reqDataToHash = {
        query: req.query,
        body: req.body,
    };

    // `${req.path}@...` to make it easier to find
    // keys on a Redis client
    return `${req.path}@${hash.sha1(reqDataToHash)}`;
}

function isRedisWorking() {
    // verify wheter there is an active connection
    // to a Redis server or not
//  return !!redisClient?.isOpen;
    return redisClient.isOpen;
}

async function writeData(key, data, options) {
    if (isRedisWorking()) {
        try {
            // write data to the Redis cache
            await redisClient.set(key, data, options);
        } catch (e) {
            console.error(`Failed to cache data for key=${key}`, e.message);
        }
    }
}

async function readData(key) {
    let cachedValue = undefined;
    if (isRedisWorking()) {
        // try to get the cached response from redis
        return await redisClient.get(key);
    }

    return cachedValue;
}

// Expiry is set to 6 hours
// Enable compression and decompression by default
function redisCachingMiddleware( options = { EX: 21600 }, compression = true 
    ) {
    return async (req, res, next) => {
        console.log('redisCachingMiddleware', isRedisWorking());
        if (isRedisWorking()) {
            const key = requestToKey(req);
            // note the compression option
            const cachedValue = await readData(key, compression);
            console.log('cachedValue', cachedValue);
            if (cachedValue) {
                try {          
                    return res.json(JSON.parse(cachedValue));
                } catch (err) {
                    console.log('Redis', err.message, cachedValue)
                    return res.send(cachedValue);
                }
            } else {
                const oldSend = res.send;
                res.send = function (data) {
                console.log('Redis oldSend', data, res.statusCode)
                    res.send = oldSend;

                    if (res.statusCode.toString().startsWith("2")) {
                        // note the compression option
                        writeData(key, JSON.stringify(data), options).then();
                    }
                    return res.send(data);
                };
                next();
            }
        } else {
            next();
        }
    };
}

module.exports = { initializeRedisClient, redisCachingMiddleware };