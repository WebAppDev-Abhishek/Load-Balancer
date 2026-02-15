import express from 'express';
import { createClient } from 'redis';

const app = express();
const port = 3000;

// Initialize Redis Client
const client = createClient();
client.on('error', err => console.log('Redis Client Error', err));
await client.connect();

app.get("/heavy", async (req, res) => {
    const cacheKey = 'heavy_result';

    // 1. Check if the result is in Redis
    const cachedData = await client.get(cacheKey);

    if (cachedData) {
        return res.send(`[CACHE HIT] Result: ${cachedData} (Handled by PID: ${process.pid})\n`);
    }

    // 2. If not in cache, do the heavy lifting
    let total = 0;
    for (let i = 0; i < 50_000_000; i++) {
        total++;
    }

    // 3. Store the result in Redis for 60 seconds
    await client.setEx(cacheKey, 60, total.toString());

    res.send(`[CACHE MISS] Calculated Result: ${total} (Processed by PID: ${process.pid})\n`);
});

app.listen(port, () => {
    console.log(`Worker ${process.pid} is ready.`);
});
