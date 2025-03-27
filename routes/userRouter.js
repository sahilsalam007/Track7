const express=require("express");
const router=express.Router();
const passport = require("passport");
const userController=require("../controllers/user/userController");
const profileController=require("../controllers/user/profileController")
const productController=require("../controllers/user/productController");
const checkOutController = require('../controllers/user/checkoutController')
const {userAuth} = require("../middlewares/auth");
const {session}=require("../middlewares/auth")
const cartController=require("../controllers/user/cartController");
const Address = require("../models/addressSchema");
const orderController=require("../controllers/user/orderController");
const wishlistController=require("../controllers/user/wishlistController");

//err and page navigation
router.get("/pageNotFound",userController.pageNotFound);
router.get("/",userController.loadHomepage);
router.get("/shop",userAuth,session,userController.loadShoppingPage);


//googleauth
router.get("/auth/google",passport.authenticate("google",{scope:["profile","email"]}));
router.get("/auth/google/callback",passport.authenticate("google",{failureRedirect:"/signup"}),(req,res)=>{
    req.session.user=req.user._id;
    res.redirect("/")
});


//user authen rot
router.get("/signup",userController.loadSignup);
router.post("/signup",userController.signup);
router.post("/verify-otp",userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp);
router.get("/login",userController.loadLogin);
router.post("/login",userController.login);
router.get("/logout",userController.logout);



//pasword rest rot
router.get("/forgot-password",profileController.getForgotPassPage);
router.post("/forgot-email-valid",profileController.forgotEmailValid);
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp);
router.get("/reset-password", profileController.getResetPassPage);
router.post("/resend-forgot-otp",profileController.resendOtp);
router.post("/reset-password",profileController.postNewPassword);

router.get("/userProfile",userAuth,profileController.userProfile);
router.get("/change-email",userAuth,profileController.changeEmail);
router.post("/change-email",userAuth,profileController.changeEmailValid);
router.post("/verify-email-otp",userAuth,profileController.verifyEmailOtp);
router.post("/update-email",userAuth,profileController.updateEmail);
router.get("/change-password",userAuth,profileController.changePassword);
router.post("/change-password",userAuth,profileController.changePasswordValid);
router.post("/verify-changepassword-otp",userAuth,profileController.verifyChangePassOtp);


//address mngmt
router.get("/addAddress",userAuth,profileController.addAddress);
router.post("/addAddress",userAuth,profileController.postAddAddress);
router.get("/editAddress",userAuth,profileController.editAddress);
router.post("/editAddress",userAuth,profileController.postEditAddress);
router.get("/deleteAddress",userAuth,profileController.deleteAddress);

//cart management
router.get("/cart",userAuth,cartController.getCartPage);
router.post("/addToCart/:id",userAuth,cartController.addToCart);
router.get("/deleteItem",userAuth,cartController.deleteProduct)
router.post("/changeQuantity",userAuth,cartController.changeQuantity);
router.post("/wishlist/moveAlltoCart",userAuth,cartController.moveAllToCart);
//prdt rot
router.get("/productDetails",userAuth,session,productController.productDetails);

//checkout Rot
router.get('/checkOut',userAuth,checkOutController.getCheckOut)
router.post('/add-address',userAuth,checkOutController.addaddress)
router.post('/edit-address',userAuth,checkOutController.editaddress)

//order Mngt
router.post('/orderPlaced',userAuth,orderController.orderPlaced)
router.get('/order-success',userAuth,orderController.loadOrderSuccess)
router.get('/orders',userAuth,session,orderController.viewOrders)
router.post('/cancel-order/:orderId',userAuth,orderController.cancelOrder)
router.get('/order-details/:orderId',userAuth,orderController.getOrderDetails)


//wishList management
router.get("/wishlist",userAuth,wishlistController.getWishlist);
router.post("/wishlist/add",userAuth,wishlistController.addToWishlist);
router.delete("/remove-wishlist",userAuth,wishlistController.removeWishlist);
router.post('/create-razorpay-order', orderController.createRazorpayOrder);
router.post('/verify-razorpay-payment', orderController.verifyRazorpayPayment);
module.exports=router;