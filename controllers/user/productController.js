const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Brand = require('../../models/brandSchema')
const Wishlist = require("../../models/wishlistschema")


const productDetails = async (req, res) => {
  try {
    const userId = req.session.user._id;
    //const userData = await User.findById(userId)
    const userData = userId ? await User.findById(userId) : null;
    const productId = req.query.id;
    const product = await Product.findById(productId)
      .populate("category")
      .populate("brand");

    const findCategory = product.category;
    const relatedProducts = await Product.find({
      category: findCategory?._id,
      _id: { $ne: productId },
    }).limit(3);

    res.render("product-details", {
      user: userData,
      product: product,
      quantity: product.quantity,
      category: findCategory,
      relatedProducts: relatedProducts,
    });
  } catch (error) {
    console.error("Error for fetching product details", error);
    res.redirect("/pageNotFound");
  }
};


module.exports = {
  productDetails,
};