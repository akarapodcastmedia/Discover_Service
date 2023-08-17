const redis = require("redis");

const redisClientCache = redis.createClient({
    url : 'redis://cache.akarahub.tech:6379'
});
(async()=> await redisClientCache.connect())();
redisClientCache.on('ready',()=> console.log("connect to cache3 successfully"));
redisClientCache.on('error',(err)=>console.log("error during connecting to redis server ..."));
module.exports= {
    redisClientCache
}