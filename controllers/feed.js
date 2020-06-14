const fs = require('fs');
const path = require('path');

const { validationResult } = require('express-validator/check');

const io = require('../socket');
const Product = require('../models/product');
const User = require('../models/user');

exports.getProducts = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;
  try {
    const totalItems = await Product.find().countDocuments();
    const products = await Product.find()
      .populate('creator')
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.status(200).json({
      message: 'Fetched products successfully.',
      products: products,
      totalItems: totalItems
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.createProduct = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    throw error;
  }
  const title = req.body.title;
  const description = req.body.description;
  const price = req.body.price;
  const product = new Product({
    title: title,
    description: description,
    price: price,
    creator: req.userId
  });
  try {
    await product.save();
    const user = await User.findById(req.userId);
    user.products.push(product);
    await user.save();
    io.getIO().emit('products', {
      action: 'create',
      product: { ...product._doc, creator: { _id: req.userId, name: user.name } }
    });
    res.status(201).json({
      message: 'Product created successfully!',
      product: product,
      creator: { _id: user._id, name: user.name }
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getProduct = async (req, res, next) => {
  const productId = req.params.productId;
  const product = await Product.findById(productId);
  try {
    if (!product) {
      const error = new Error('Could not find product.');
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json({ message: 'Product fetched.', product: product });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updateProduct = async (req, res, next) => {
  const productId = req.params.productId;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    throw error;
  }
  const title = req.body.title;
  const description = req.body.description;
  const price = req.body.price;
  try {
    const product = await Product.findById(productId).populate('creator');
    if (!product) {
      const error = new Error('Could not find product.');
      error.statusCode = 404;
      throw error;
    }
    if (product.creator._id.toString() !== req.userId) {
      const error = new Error('Not authorized!');
      error.statusCode = 403;
      throw error;
    }
    product.title = title;
    product.description = description;
    product.price = price;
    const result = await product.save();
    io.getIO().emit('products', { action: 'update', product: result });
    res.status(200).json({ message: 'Product updated!', product: result });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.deleteProduct = async (req, res, next) => {
  const productId = req.params.productId;
  try {
    const product = await Product.findById(productId);

    if (!product) {
      const error = new Error('Could not find product.');
      error.statusCode = 404;
      throw error;
    }
    if (product.creator.toString() !== req.userId) {
      const error = new Error('Not authorized!');
      error.statusCode = 403;
      throw error;
    }
    // Check logged in user
    await Product.findByIdAndRemove(productId);

    const user = await User.findById(req.userId);
    user.products.pull(productId);
    await user.save();
    io.getIO().emit('products', { action: 'delete', product: productId })
    res.status(200).json({ message: 'Deleted product.' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

