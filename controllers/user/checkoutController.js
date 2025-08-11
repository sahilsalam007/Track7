const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Coupon = require("../../models/couponSchema");
const Product = require("../../models/productSchema");
const mongoose = require("mongoose");
const { CURSOR_FLAGS } = require("mongodb");
require("dotenv").config();

const getCheckOut = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res
        .status(401)
        .render("login", { message: "Please login to access your cart" });
    }

    let user = await User.findOne({ _id: userId }).populate("cart.productId");
    if (!user) {
      user = { items: [] };
    }

    const cart = user.cart;
    if (!cart || cart.length === 0) {
      return res.status(400).render("cart", {
        swal: {
          title: "Empty Cart",
          text: "Your cart is empty. Please add products before checkout.",
          icon: "error",
        },
        title: "Cart",
        user,
        data: [],
        grandTotal: 0,
      });
    }

    const blockedProducts = cart.filter((item) => item.productId.isBlocked);
    const unavailableItems = cart.filter(
      (item) => item.quantity > item.productId.quantity
    );
    if (unavailableItems.length > 0) {
      const unavailableNames = unavailableItems
        .map((item) => item.productId.name)
        .join(", ");

      return res.status(400).render("cart", {
        swal: {
          title: "Product Quantity Error",
          text: `Some items in your cart exceed available stock: ${unavailableNames}. Please update your cart.`,
          icon: "error",
          showConfirmButton: true,
        },
        title: "Cart",
        user,
        data: cart,
        grandTotal: cart.reduce(
          (sum, item) => sum + item.productId.salesPrice * item.quantity,
          0
        ),
      });
    }
    if (blockedProducts.length > 0) {
      const blockedProductNames = blockedProducts
        .map((item) => item.productId.name)
        .join(", ");
      user.cart = [];

      await user.save();

      return res.status(400).render("cart", {
        swal: {
          title: "Blocked Products",
          text: `One or more products in your cart is currently unavailable. Please remove them to proceed.`,
          icon: "error",
          showConfirmButton: true,
        },
        title: "Cart",
        user,
        data: [],
        grandTotal: 0,
      });
    }

    const userAddresses = await Address.findOne({ userId });
    const currentDate = new Date();
    let totalPrice = 0;

    if (cart) {
      totalPrice = cart.reduce(
        (sum, item) => sum + item.productId.salesPrice * item.quantity,
        0
      );
    }

    const taxAmount = totalPrice * 0.1;
    const coupons = await Coupon.find({
      isList: true,
      expireOn: { $gte: currentDate },
    });

    res.status(200).render("checkout", {
      cart,
      addresses: userAddresses ? userAddresses.address : [],
      title: "Checkout",
      user,
      coupons,
      totalPrice: totalPrice,
      taxAmount: taxAmount,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.log("checkout page error", error);
    res.status(500).redirect("/cart");
  }
};

const addaddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressType, name, city, landMark, state, pincode, phone } =
      req.body;

    let userAddress = await Address.findOne({ userId });

    if (!userAddress) {
      userAddress = new Address({
        userId,
        address: [
          {
            addressType,
            name,
            city,
            state,
            pincode,
            landMark,
            phone,
          },
        ],
      });
    } else {
      userAddress.address.push({
        addressType,
        name,
        city,
        landMark,
        state,
        pincode,
        phone,
      });
    }

    await userAddress.save();

    res
      .status(200)
      .json({ success: true, message: "address added successfully" });
  } catch (error) {
    console.error("Add address error:", error);

    res.status(500).redirect("/checkOut");
  }
};

const editaddress = async (req, res) => {
  try {
    const {
      addressId,
      name,
      addressType,
      city,
      landMark,
      state,
      pincode,
      phone,
    } = req.body;

    console.log("Edit address request:", req.body);

    if (!addressId) {
      return res
        .status(400)
        .json({ success: false, message: "Address ID is required" });
    }

    const result = await Address.updateOne(
      { "address._id": addressId },
      {
        $set: {
          "address.$.name": name,
          "address.$.addressType": addressType,
          "address.$.city": city,
          "address.$.landMark": landMark,
          "address.$.state": state,
          "address.$.pincode": pincode,
          "address.$.phone": phone,
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found or not modified" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Address updated successfully" });
  } catch (error) {
    console.error("Edit Address Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update address" });
  }
};

module.exports = {
  getCheckOut,
  addaddress,
  editaddress,
};
