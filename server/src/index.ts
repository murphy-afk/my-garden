import express from 'express';

const port = Number(process.env['PORT'] ?? 3001);

const app = express();

app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Garden API listening on http://localhost:${port}`);
});
