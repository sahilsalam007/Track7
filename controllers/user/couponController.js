const Coupon = require("../../models/couponSchema");
const User = require("../../models/userSchema");

const applyCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;
    const userId = req.user._id;
    console.log(couponCode);
    if (!couponCode) {
      return res.json({ success: false, message: "Coupon code is required." });
    }
    const coupon = await Coupon.findOne({ name: couponCode, isList: true });
    console.log(coupon);
    if (!coupon) {
      return res.json({
        success: false,
        message: "Inavalid or inactive coupon.",
      });
    }
    const currentDate = new Date();
    if (coupon.expireOn < currentDate) {
      return res.json({ success: false, message: "Coupon has expired." });
    }

    const findUser = await User.findById(userId).populate("cart.productId");
    const userCart = findUser.cart;
    console.log(userCart);
    const cartTotal = userCart.reduce(
      (sum, item) => (sum += item.productId.salesPrice * item.quantity),
      0
    );

    if (cartTotal < coupon.minimumPrice) {
      return res.json({
        success: false,
        message: `Minimum cart total must be ${coupon.minimumPrice}to apply this coupon.`,
      });
    }
    const discount = coupon.offerPrice;
    console.log(discount, cartTotal);
    const finalPrice = cartTotal - discount;
    console.log("final apply:", finalPrice);

    req.session.appliedCoupon = {
      couponCode: couponCode,
      discount: discount,
    };

    return res.json({
      success: true,
      couponName: couponCode,
      discount: discount,
      finalPrice: finalPrice,
    });
  } catch (error) {
    console.log(error.message);
  }
};

const removeCoupon = async (req, res) => {
  try {
    req.session.appliedCoupon = null;
    return res.json({ success: true, message: "Coupon removed successfully" });
  } catch (error) {
    console.error("Error removing coupon:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  applyCoupon,
  removeCoupon,
};
