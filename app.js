const express = require('express');
const redis = require('redis');
const cors = require('cors');
const helmet = require('helmet');
const client = require('prom-client');
const { setRedis } = require('./src/controllers/cartController');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;

// Prometheus
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: 'cart_service_requests_total',
  help: 'Total requests to cart service',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestCounter.inc({ method: req.method, route: req.path, status: res.statusCode });
  });
  next();
});

// Connect Redis
const connectRedis = async () => {
  const redisClient = redis.createClient({ url: process.env.REDIS_URL });
  redisClient.on('error', err => console.log('Redis error:', err));
  redisClient.on('connect', () => console.log('Redis connected'));
  await redisClient.connect();
  setRedis(redisClient);
};

connectRedis().catch(console.error);

// Routes
app.use('/api/cart', require('./src/routes/cart'));

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'cart-service', timestamp: new Date().toISOString() });
});

// Metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(PORT, () => {
  console.log(`Cart Service running on port ${PORT}`);
});