const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Brand = require('../../models/brandSchema')
const Wishlist = require("../../models/wishlistSchema")

const productDetails = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    const productId = req.query.id;

    const product = await Product.findById(productId)
      .populate("category")
      .populate("brand");

    const findCategory = product.category;

    const relatedProducts = await Product.find({
      category: findCategory?._id,
      _id: { $ne: productId },
    }).limit(3);

    // Get wishlist
    let wishlistItems = [];
    if (userId) {
      const wishlist = await Wishlist.findOne({ userId });
      wishlistItems = wishlist?.products?.map(item => item.productId.toString()) || [];
    }

    res.render("product-details", {
      user: res.locals.user,
      product,
      quantity: product.quantity,
      category: findCategory,
      relatedProducts,
      wishlistItems
    });

  } catch (error) {
    console.error("Error for fetching product details", error);
    res.redirect("/pageNotFound");
  }
};


module.exports = {
  productDetails,
};