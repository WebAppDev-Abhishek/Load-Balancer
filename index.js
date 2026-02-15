import express from 'express';
import { createClient } from 'redis';
import { Worker } from 'worker_threads';
import rateLimit from 'express-rate-limit';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
// Setting port via environment variable or default to 5000
const port = process.env.PORT || 5000;

// 1. Rate Limiting
const heavyLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 10, 
    message: "Too many heavy requests, please slow down."
});

// 2. Initialize Redis with logging flags
const client = createClient();
client.on('error', err => console.log(`[REDIS ERROR] PID ${process.pid}:`, err));

console.log(`[STATUS] PID ${process.pid} attempting to connect to Redis...`);
await client.connect();
console.log(`[SUCCESS] PID ${process.pid} connected to Redis.`);

app.get("/heavy", heavyLimiter, async (req, res) => {
    const cacheKey = 'heavy_result';
    
    try {
        console.log(`[REQUEST] PID ${process.pid} received a /heavy request.`);
        const cachedData = await client.get(cacheKey);
        
        if (cachedData) {
            console.log(`[CACHE HIT] PID ${process.pid} found data in Redis.`);
            return res.send(`[CACHE HIT] Result: ${cachedData} (PID: ${process.pid})\n`);
        }

        console.log(`[CACHE MISS] PID ${process.pid} spawning Worker Thread for calculation...`);

        // 3. Offload calculation to a Worker Thread
        const worker = new Worker(join(__dirname, 'task.js'));

        worker.on('message', async (total) => {
            console.log(`[COMPLETED] Worker Thread finished. PID ${process.pid} updating Redis.`);
            await client.setEx(cacheKey, 60, total.toString());
            res.send(`[CACHE MISS] Calculated: ${total} (PID: ${process.pid} via Worker Thread)\n`);
        });

        worker.on('error', (err) => {
            console.error(`[WORKER ERROR] PID ${process.pid}:`, err);
            res.status(500).send(err.message);
        });

    } catch (error) {
        console.error(`[SERVER ERROR] PID ${process.pid}:`, error);
        res.status(500).send("Server Error");
    }
});

// 4. Optimization & Dynamic Port Logging
const server = app.listen(port, () => {
    const actualPort = server.address().port; // Get the port directly from the server instance
    console.log(`\n---------------------------------------------------`);
    console.log(`🚀 [SERVER ONLINE]`);
    console.log(`📍 PORT: ${actualPort}`);
    console.log(`🆔 PID:  ${process.pid}`);
    console.log(`---------------------------------------------------\n`);
});

server.keepAliveTimeout = 50000;