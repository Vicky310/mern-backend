const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');

const User = require('../models/user');
const Product = require('../models/product');

module.exports = {
  createUser: async function ({ userInput }, req) {
    //   const email = args.userInput.email;
    const errors = [];
    if (!validator.isEmail(userInput.email)) {
      errors.push({ message: 'E-Mail is invalid.' });
    }
    if (
      validator.isEmpty(userInput.password) ||
      !validator.isLength(userInput.password, { min: 5 })
    ) {
      errors.push({ message: 'Password too short!' });
    }
    if (errors.length > 0) {
      const error = new Error('Invalid input.');
      error.data = errors;
      error.code = 422;
      throw error;
    }
    const existingUser = await User.findOne({ email: userInput.email });
    if (existingUser) {
      const error = new Error('User exists already!');
      throw error;
    }
    const hashedPw = await bcrypt.hash(userInput.password, 12);
    const user = new User({
      email: userInput.email,
      name: userInput.name,
      password: hashedPw
    });
    const createdUser = await user.save();
    return { ...createdUser._doc, _id: createdUser._id.toString() };
  },
  login: async function ({ email, password }) {
    const user = await User.findOne({ email: email });
    if (!user) {
      const error = new Error('User not found.');
      error.code = 401;
      throw error;
    }
    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      const error = new Error('Password is incorrect.');
      error.code = 401;
      throw error;
    }
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email
      },
      'somesupersecretsecret',
      { expiresIn: '1h' }
    );
    return { token: token, userId: user._id.toString() };
  },
  createProduct: async function ({ productInput }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    const errors = [];
    if (
      validator.isEmpty(productInput.title) ||
      !validator.isLength(productInput.title, { min: 5 })
    ) {
      errors.push({ message: 'Title is invalid.' });
    }
    if (
      validator.isEmpty(productInput.description) ||
      !validator.isLength(productInput.description, { min: 5 })
    ) {
      errors.push({ message: 'Description is invalid.' });
    }
    if (errors.length > 0) {
      const error = new Error('Invalid input.');
      error.data = errors;
      error.code = 422;
      throw error;
    }
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('Invalid user.');
      error.code = 401;
      throw error;
    }
    const product = new Product({
      title: productInput.title,
      description: productInput.description,
      price: productInput.price,
      creator: user
    });
    const createdProduct = await product.save();
    user.products.push(createdProduct);
    await user.save();
    return {
      ...createdProduct._doc,
      _id: createdProduct._id.toString(),
      createdAt: createdProduct.createdAt.toISOString(),
      updatedAt: createdProduct.updatedAt.toISOString()
    };
  },
  products: async function ({ page }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    if (!page) {
      page = 1;
    }
    const perPage = 2;
    const totalProducts = await Product.find().countDocuments();
    const products = await Product.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .populate('creator');
    return {
      products: products.map(p => {
        return {
          ...p._doc,
          _id: p._id.toString(),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString()
        };
      }),
      totalProducts: totalProducts
    };
  },
  product: async function ({ id }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    const product = await Product.findById(id).populate('creator');
    if (!product) {
      const error = new Error('No product found!');
      error.code = 404;
      throw error;
    }
    return {
      ...product._doc,
      _id: product._id.toString(),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString()
    };
  },
  updateProduct: async function ({ id, productInput }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    const product = await Product.findById(id).populate('creator');
    if (!product) {
      const error = new Error('No product found!');
      error.code = 404;
      throw error;
    }
    if (product.creator._id.toString() !== req.userId.toString()) {
      const error = new Error('Not authorized!');
      error.code = 403;
      throw error;
    }
    const errors = [];
    if (
      validator.isEmpty(productInput.title) ||
      !validator.isLength(productInput.title, { min: 5 })
    ) {
      errors.push({ message: 'Title is invalid.' });
    }
    if (
      validator.isEmpty(productInput.description) ||
      !validator.isLength(productInput.description, { min: 5 })
    ) {
      errors.push({ message: 'Description is invalid.' });
    }
    if (errors.length > 0) {
      const error = new Error('Invalid input.');
      error.data = errors;
      error.code = 422;
      throw error;
    }
    product.title = productInput.title;
    product.description = productInput.description;
    product.price = productInput.price;
    const updatedProduct = await product.save();
    return {
      ...updatedProduct._doc,
      _id: updatedProduct._id.toString(),
      createdAt: updatedProduct.createdAt.toISOString(),
      updatedAt: updatedProduct.updatedAt.toISOString()
    };
  },
  deleteProduct: async function ({ id }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    const product = await Product.findById(id);
    if (!product) {
      const error = new Error('No product found!');
      error.code = 404;
      throw error;
    }
    if (product.creator.toString() !== req.userId.toString()) {
      const error = new Error('Not authorized!');
      error.code = 403;
      throw error;
    };
    await Product.findByIdAndRemove(id);
    const user = await User.findById(req.userId);
    user.products.pull(id);
    await user.save();
    return true;
  },
  user: async function (args, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('No user found!');
      error.code = 404;
      throw error;
    }
    return { ...user._doc, _id: user._id.toString() };
  },
  updateStatus: async function ({ status }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('No user found!');
      error.code = 404;
      throw error;
    }
    user.status = status;
    await user.save();
    return { ...user._doc, _id: user._id.toString() };
  }
};
