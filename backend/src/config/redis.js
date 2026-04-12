const { Redis } = require('@upstash/redis');
require('dotenv').config();

let redis = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
} else {
    console.warn("Redis environment variables missing. Caching will be skipped or will fail.");
}

module.exports = redis;
