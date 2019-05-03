const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authRoutes = require('./auth.route');
const userRoutes = require('./user.route');
const productsRoutes = require('./product.route');
const addressesRoutes = require('./address.route');
const ordersRoutes = require('./order.route');

/** PRODUCTION */
// const dbUri = "mongodb://akros:akros@178.128.154.163:27017/fragrance-deals?authSource=admin";
/** DEVELOPMENT */
const dbUri = "mongodb://localhost:27017/fragrance-deals?authSource=admin";

mongoose.Promise = global.Promise;

mongoose.connect(dbUri, (err) => {
    if (err) {
        console.log("error", err);
    } else {
        if (dbUri.indexOf('localhost') !== -1) {
            console.log('mongodb(local) connected');
        } else {
            console.log('mongodb(remote) connected');
        }
    }
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productsRoutes);
router.use('/addresses', addressesRoutes);
router.use('/orders',ordersRoutes);

module.exports = router;