import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { APP_NAME } from '@pullquest/shared';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: APP_NAME });
});

app.listen(port, () => {
  console.log(`[server]: API Server is running at http://localhost:${port}`);
});
