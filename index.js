import express from 'express'; // Fixed: Changed from require to import

const port = 3000;
const app = express();

app.get("/heavy", (req, res) => {
    let total = 0;
    // This blocks the Event Loop for this specific worker
    for (let i = 0; i < 50_000_000; i++) {
        total++;
    }
    // Added process.pid so you can see which worker is doing the work
    res.send(`The result of the CPU intensive task is ${total} from PID: ${process.pid}\n`);
});

app.listen(port, () => {
    console.log(`Worker ${process.pid} is listening on port ${port}`);
});