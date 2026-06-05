let redisClient;

const getRedis = () => redisClient;
const setRedis = (client) => { redisClient = client; };

// Cart key per user
const cartKey = (userId) => `cart:${userId}`;

// Get cart
exports.getCart = async (req, res) => {
  try {
    const key = cartKey(req.user.id);
    const cart = await redisClient.hGetAll(key);

    if (!cart || Object.keys(cart).length === 0) {
      return res.json({
        success: true,
        service: 'cart-service',
        userId: req.user.id,
        items: [],
        total: 0,
        count: 0
      });
    }

    const items = Object.entries(cart).map(([productId, value]) => {
      const item = JSON.parse(value);
      return { productId, ...item };
    });

    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    res.json({
      success: true,
      service: 'cart-service',
      userId: req.user.id,
      items,
      total: Math.round(total * 100) / 100,
      count: items.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add item to cart
exports.addItem = async (req, res) => {
  try {
    const { productId, name, price, quantity = 1 } = req.body;

    if (!productId || !name || !price) {
      return res.status(400).json({ success: false, message: 'productId, name, price required' });
    }

    const key = cartKey(req.user.id);

    // Check if item exists
    const existing = await redisClient.hGet(key, productId);
    let item;

    if (existing) {
      item = JSON.parse(existing);
      item.quantity += quantity;
    } else {
      item = { name, price, quantity };
    }

    await redisClient.hSet(key, productId, JSON.stringify(item));

    // Cart expires in 7 days
    await redisClient.expire(key, 7 * 24 * 60 * 60);

    res.json({
      success: true,
      message: 'Item added to cart',
      item: { productId, ...item }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update item quantity
exports.updateItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
    }

    const key = cartKey(req.user.id);
    const existing = await redisClient.hGet(key, productId);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Item not in cart' });
    }

    const item = JSON.parse(existing);
    item.quantity = quantity;
    await redisClient.hSet(key, productId, JSON.stringify(item));

    res.json({ success: true, message: 'Cart updated', item: { productId, ...item } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Remove item
exports.removeItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const key = cartKey(req.user.id);
    await redisClient.hDel(key, productId);
    res.json({ success: true, message: 'Item removed from cart' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Clear cart
exports.clearCart = async (req, res) => {
  try {
    const key = cartKey(req.user.id);
    await redisClient.del(key);
    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.setRedis = setRedis;