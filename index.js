import express from 'express';
import { createClient } from 'redis';
import { Worker } from 'worker_threads';
import rateLimit from 'express-rate-limit';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 5000;

// 1. Rate Limiting: Prevent a single IP from spamming the heavy route
const heavyLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 heavy requests per minute
    message: "Too many heavy requests, please slow down."
});

// 2. Initialize Redis
const client = createClient();
client.on('error', err => console.log('Redis Error', err));
await client.connect();

app.get("/heavy", heavyLimiter, async (req, res) => {
    const cacheKey = 'heavy_result';
    
    try {
        const cachedData = await client.get(cacheKey);
        if (cachedData) {
            return res.send(`[CACHE HIT] Result: ${cachedData} (PID: ${process.pid})\n`);
        }

        // 3. Offload calculation to a Worker Thread (Non-blocking)
        const worker = new Worker(join(__dirname, 'task.js'));

        worker.on('message', async (total) => {
            await client.setEx(cacheKey, 60, total.toString());
            res.send(`[CACHE MISS] Calculated: ${total} (PID: ${process.pid} via Worker Thread)\n`);
        });

        worker.on('error', (err) => res.status(500).send(err.message));

    } catch (error) {
        res.status(500).send("Server Error");
    }
});

// 4. Optimization: Increase Server Timeout for heavy loads
const server = app.listen(port, () => {
    console.log(`Worker ${process.pid} is ready at http://localhost:${port}`);
});

server.keepAliveTimeout = 50000;


