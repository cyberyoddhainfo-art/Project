const redis = require('../config/redis');

async function getCache(key) {
    if (!redis) return null;
    try {
        return await redis.get(key);
    } catch (e) {
        console.error('Redis Get Error:', e);
        return null;
    }
}

async function setCache(key, value, expirySec = 300) {
    if (!redis) return;
    try {
        await redis.set(key, value, { ex: expirySec });
    } catch (e) {
        console.error('Redis Set Error:', e);
    }
}

async function clearCache(keyPrefix) {
    if (!redis) return;
    try {
        const keys = await redis.keys(`${keyPrefix}*`);
        if (keys.length > 0) {
            const pipeline = redis.pipeline();
            keys.forEach((k) => pipeline.del(k));
            await pipeline.exec();
        }
    } catch (e) {
        console.error('Redis Clear Error:', e);
    }
}

module.exports = { getCache, setCache, clearCache };
