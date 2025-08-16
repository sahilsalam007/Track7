const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const mongoose = require("mongoose");

const getCartPage = async (req, res) => {
  try {
    const id = req.session.user;
    const user = await User.findOne({ _id: id });

    if (!user) {
      return res.status(404).redirect("/pageNotFound");
    }

    const oid = new mongoose.Types.ObjectId(id);

    let data = await User.aggregate([
      { $match: { _id: oid } },
      { $unwind: "$cart" },
      {
        $lookup: {
          from: "products",
          localField: "cart.productId",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $project: {
          _id: 0,
          productId: "$cart.productId",
          quantity: "$cart.quantity",
          productName: "$productDetails.productName",
          salePrice: "$productDetails.salesPrice",
          productTotalQuantity: "$productDetails.quantity",
          brand: "$productDetails.brand",
          productImage: { $arrayElemAt: ["$productDetails.productImage", 0] },
        },
      },
    ]);
    let grandTotal = data.reduce(
      (acc, item) => acc + item.salePrice * item.quantity,
      0
    );
    req.session.grandTotal = grandTotal;
    res.render("cart", {
      user,
      quantity: user.cart.reduce((acc, item) => acc + item.quantity, 0),
      data,
      grandTotal: typeof grandTotal !== "undefined" ? grandTotal : 0,
    });
  } catch (error) {
    console.error("Error in getCartPage:", error);
    res.redirect("/pageNotFound");
  }
};

const addToCart = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.session.user;
    const quantity = parseInt(req.body.quantity) || 1;
    console.log("userid is:", userId);
    const findUser = await User.findById(userId);
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        status: "error",
        message: "Product not found",
      });
    }
    if (product.isBlocked) {
      return res.status(403).json({
        status: "error",
        message: "This product is no longer available",
      });
    }
    if (product.quantity <= 0) {
      return res.status(400).json({
        status: "error",
        message: "Product is out of stock",
      });
    }
    const cartIndex = findUser.cart.findIndex(
      (item) => item.productId.toString() === id.toString()
    );

    if (cartIndex === -1) {
      await User.findByIdAndUpdate(
        userId,
        {
          $push: {
            cart: {
              productId: id,
              quantity: quantity,
            },
          },
        },
        { new: true }
      );
      return res.status(200).json({
        status: "success",
        message: "Product added to cart",
      });
    } else {
      const productInCart = findUser.cart[cartIndex];
      if (productInCart.quantity >= 5) {
        return res.status(400).json({
          status: "error",
          message: "Cannot add more than 5 items of this product",
        });
      }

      if (productInCart.quantity < product.quantity) {
        const newQuantity = productInCart.quantity + quantity;
        await User.updateOne(
          { _id: userId, "cart.productId": id },
          { $set: { "cart.$.quantity": newQuantity } }
        );

        return res.status(200).json({
          status: "success",
          message: "Cart updated successfully",
        });
      } else {
        return res.status(400).json({
          status: "error",
          message: "Requested quantity exceeds available stock",
        });
      }
    }
  } catch (error) {
    console.error("Add to cart error:", error);
    return res.status(500).json({
      status: "error",
      message: "An error occurred while adding to cart",
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const productId = req.query.id;
    if (!productId) {
      return res.status(400).redirect("/pageNotFound");
    }
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).redirect("/pageNotFound");
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).redirect("/pageNotFound");
    }
    const cartIndex = user.cart.findIndex(
      (item) => item.productId.toString() === productId.toString()
    );

    if (cartIndex === -1) {
      return res.status(404).redirect("/cart");
    }

    user.cart.splice(cartIndex, 1);
    await user.save();
    res.status(200).redirect("/cart");
  } catch (error) {
    console.error("Error:", error);
    res.status(500).redirect("/pageNotFound");
  }
};

const changeQuantity = async (req, res) => {
  try {
    const userId = req.session.user;
    const productId = req.body.productId;
    const count = parseInt(req.body.count);

    if (!userId || !productId) {
      return res.status(400).json({ status: false, error: "Missing data" });
    }

    const findUser = await User.findOne({ _id: userId });
    if (!findUser) {
      return res.status(404).json({ status: false, error: "User not found" });
    }

    const productExistInCart = findUser.cart.find(
      (item) => item.productId.toString() === productId
    );
    if (!productExistInCart) {
      return res
        .status(400)
        .json({ status: false, error: "Product not in cart" });
    }

    let newQuantity = productExistInCart.quantity + count;
    if (newQuantity < 1) {
      return res
        .status(400)
        .json({ status: false, error: "Quantity cannot be less than 1" });
    }

    const findProduct = await Product.findOne({ _id: productId });
    if (!findProduct || newQuantity > findProduct.quantity) {
      return res
        .status(400)
        .json({ status: false, error: "Not enough stock available" });
    }

    const quantityUpdated = await User.updateOne(
      { _id: userId, "cart.productId": productId },
      { $set: { "cart.$.quantity": newQuantity } }
    );

    if (quantityUpdated.modifiedCount > 0) {
      const grandTotal = await User.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(userId) } },
        { $unwind: "$cart" },
        {
          $lookup: {
            from: "products",
            localField: "cart.productId",
            foreignField: "_id",
            as: "productDetails",
          },
        },
        { $unwind: "$productDetails" },
        {
          $group: {
            _id: null,
            totalPrice: {
              $sum: {
                $multiply: ["$cart.quantity", "$productDetails.salesPrice"],
              },
            },
          },
        },
      ]);
      const remainingStock = findProduct.quantity - newQuantity;
      res.json({
        status: true,
        quantityInput: newQuantity,
        count: count,
        totalAmount: newQuantity * (findProduct.salesPrice || 0),
        grandTotal: grandTotal[0]?.totalPrice || 0,
        remainingStock: remainingStock,
      });
    } else {
      res.status(400).json({ status: false, error: "Cart not updated" });
    }
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ status: false, error: "Server error" });
  }
};

const moveAllToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);

    if (!user || user.wishlist.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Wishlist is empty or user not found.",
      });
    }
    for (let wishlistProductId of user.wishlist) {
      const product = await Product.findById(wishlistProductId).lean();
      if (!product) {
        continue;
      }
      if (product.quantity <= 0) {
        continue;
      }
      const cartIndex = user.cart.findIndex(
        (item) => item.productId.toString() === wishlistProductId.toString()
      );
      if (cartIndex === -1) {
        await User.findByIdAndUpdate(userId, {
          $addToSet: {
            cart: {
              productId: wishlistProductId,
              quantity: 1,
            },
          },
        });
      } else {
        const productInCart = user.cart[cartIndex];
        if (productInCart.quantity < product.quantity) {
          await User.updateOne(
            { _id: userId, "cart.productId": wishlistProductId },
            { $inc: { "cart.$.quantity": 1 } }
          );
        }
      }
    }
    user.wishlist = [];
    await user.save();
    res
      .status(200)
      .json({ status: "success", message: "All items moved to cart." });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
};

module.exports = {
  getCartPage,
  addToCart,
  deleteProduct,
  changeQuantity,
  moveAllToCart,
};
