const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')
const mongoose = require('mongoose')
const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema')
const Cart = require('../../models/cartSchema')
const Razorpay = require("razorpay");


// const crypto = require("crypto");
require('dotenv').config()
const{razorpayInstance,
  verifySignature}=require("../../config/razorPay")


const orderPlaced = async (req, res) => {
    try {
        console.log("User in request:", req.user);
        console.log("Session user:", req.session.user);

        const { totalPrice, addressId, paymentMethod, discount = 99 } = req.body;
        const userId = req.user._id;

        const findUser = await User.findById(userId);
        if (!findUser) {
            return res.status(404).json({ error: "User not found" });
        }

        const userAddressDoc = await Address.findOne({ userId });
        if (!userAddressDoc) {
            return res.status(404).json({ error: "Address not found" });
        }

        const desiredAddress = userAddressDoc.address.id(addressId);
        if (!desiredAddress) {
            return res.status(404).json({ error: "Selected address not found" });
        }

        const user = await User.findOne({ _id:userId }).populate('cart.productId');
        const cart =user.cart;
        console.log("working here",cart);

        if (!cart || cart.length === 0) {
            return res.status(400).json({ error: "Your cart is empty." });
        }

        const outOfStockItems = [];
        for (const item of cart) {
            const product = await Product.findOne({_id : item.productId});
           
            if (!product || product.quantity < item.quantity) {
                outOfStockItems.push({
                    product: product ? product.productName : 'Unknown Product',
                    requestedQuantity: item.quantity,
                    availableQuantity: product ? product.quantity : 0
                });
            }
        }

        if (outOfStockItems.length > 0) {
            return res.status(400).json({
                error: "Some items are out of stock.",
                outOfStockItems
            });
        }

        for (const item of cart) {
            const product = await Product.findById(item.productId);
            product.quantity -= item.quantity;
            await product.save();
        }

        const newOrder = new Order({
            userId,
            orderedItems: cart.map(item => ({
                product: item.productId,
                quantity: item.quantity,
                price: item.productId.salesPrice, 
                size: item.size
            })),
            totalPrice,
            discount,
            finalAmount: totalPrice - discount,
            address: {
                addressType: desiredAddress.addressType,
                name: desiredAddress.name,
                city: desiredAddress.city,
                landMark: desiredAddress.landMark,
                state: desiredAddress.state,
                pincode: desiredAddress.pincode,
                phone: desiredAddress.phone,
                altPhone: desiredAddress.altPhone
            },
            paymentMethod,
            status: "Pending"
        });
        
        await newOrder.save();
        await User.updateOne({ _id: userId }, { $set: { cart: [] } });
        res.status(200).json({ success: true, message: "Order placed successfully!", order: newOrder });
    } catch (error) {
        console.error("Error placing order:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});
const createRazorpayOrder = async (req, res) => {
    try {
        const { userId, addressId, totalPrice } = req.body;

        // Validate incoming data
        if (!userId || !addressId || !totalPrice) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields: userId, addressId, or totalPrice"
            });
        }

        // Fetch user with cart populated
        const user = await User.findOne({ _id: userId }).populate("cart.productId");
        if (!user) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        // Check cart
        const cart = user.cart || [];
        if (!cart.length) {
            return res.status(400).json({ success: false, error: "Cart is empty" });
        }

        // Map cart items to orderedItems
        const orderedItems = cart.map(item => ({
            product: item.productId._id,
            quantity: item.quantity,
            price: item.productId.salesPrice
        }));

        // Fetch address correctly
        const userAddress = await Address.findOne(
            { "address._id": addressId },
            { "address.$": 1, _id: 0 }
        );

        if (!userAddress || !userAddress.address.length) {
            return res.status(400).json({ success: false, error: "Invalid address" });
        }

        const address = userAddress.address[0]; // Extract the matched address

        // Calculate finalAmount
        const discount = 99; // Adjust dynamically if needed
        const finalAmount = totalPrice - discount;

        // Create new Mongoose Order document
        const newOrder = new Order({
            userId,
            orderedItems,
            totalPrice,
            discount,
            finalAmount,
            address: {
                addressType: address.addressType,
                name: address.name,
                city: address.city,
                landMark: address.landMark,
                state: address.state,
                pincode: address.pincode,
                phone: address.phone,
                altPhone: address.altPhone || ""
            },
            payment: {
                method: "razorpay",
                status: "paid"
            },
            status: "confirmed"
        });

        await newOrder.save();

        // Create Razorpay order
        const razorpayOrder = await razorpay.orders.create({
            amount: finalAmount * 100, // Convert to paisa
            currency: "INR",
            receipt: newOrder.orderId
        });

        // Update order with Razorpay details
        newOrder.payment.razorpayDetails = {
            orderId: razorpayOrder.id
        };
        await newOrder.save();

        res.json({
            success: true,
            order: razorpayOrder,
            orderId: newOrder._id
        });
    } catch (error) {
        console.warn("Error creating Razorpay order:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const verifyRazorpayPayment = async (req, res) => {
    try {
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature,
            orderId 
        } = req.body;

        // Verify payment signature
        const isValid = verifySignature(
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature
        );

        if (!isValid) {
            return res.status(400).json({ 
                success: false, 
                error: "Invalid payment signature" 
            });
        }

        // Update order status
        const order = await Order.findByIdAndUpdate(
            orderId, 
            { 
                status: 'Paid', 
                razorpayPaymentId: razorpay_payment_id,
                razorpaySignature: razorpay_signature
            }, 
            { new: true }
        );

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                error: "Order not found" 
            });
        }

        res.status(200).json({ 
            success: true, 
            message: "Payment verified successfully" 
        });
    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(500).json({ 
            success: false, 
            error: "Payment verification failed" 
        });
    }
};
const loadOrderSuccess = async (req,res) => {
    try {
        res.status(200).render('order-success')
    } catch (error) {
        console.error("Error loading order success page:", error);
        res.status(500).render('error-page'); 
    }
};

     
const viewOrders = async (req, res) => {
    try {
        const userId = req.session.user;

        const limit=5;
        let page=1;
        if(req.query.page){
           page=Number(req.query.page) ||1
        }
        const skip = (page-1) * limit;
        
        const totalOrder=await Order.countDocuments({userId:userId})
        const totalPages = Math.ceil(totalOrder/limit)
        const orders=await Order.find({userId:userId})
        .populate('userId')
        .populate('orderedItems.product').sort({ createdOn: -1 })
        .populate("address")
        .skip(skip)
        .limit(limit)
      
        res.status(200).render("orders",{orders,totalPages,currentPage:page})
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).render('orders', { user: req.session.user, orders: [], error: "Failed to fetch orders." });
    }
 
}


const cancelOrder = async (req, res) => {
    try {
        const { orderId, itemId } = req.body;
        const userId = req.session.user;

        console.log('Order ID:', orderId);
        console.log('User ID:', userId);

        const findUser = await User.findById(userId);
        if (!findUser) return res.status(404).json({ message: 'User not found' });

        const findOrder = await Order.findOne({ _id: orderId });
        if (!findOrder) return res.status(404).json({ message: 'Order not found' });

        if (findOrder.status === 'Cancelled') {
            return res.status(400).json({ message: 'Order is already cancelled' });
        }

        const itemIndex = findOrder.orderedItems.findIndex(item => item._id.toString() === itemId);
        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Item not found in the order' });
        }

        const cancelledItem = findOrder.orderedItems[itemIndex];

        // Refund Logic
        if (findOrder.paymentMethod === 'razorpay' || findOrder.paymentMethod === 'wallet') {
            let wallet = await Wallet.findOne({ userId });
            if (!wallet) wallet = new Wallet({ userId, balance: 0, transactions: [] });

            wallet.balance += cancelledItem.price * cancelledItem.quantity;
            wallet.transactions.push({
                type: 'credit',
                amount: cancelledItem.price * cancelledItem.quantity,
                description: `Refund for cancelled item #${cancelledItem._id} in order #${orderId}`,
                orderId: findOrder._id,
            });

            await wallet.save();
        }

        // Restore product stock
        const product = await Product.findById(cancelledItem.product);
        if (product) {
            product.quantity += cancelledItem.quantity;
            await product.save();
        }

        // Remove the item from the order
        findOrder.orderedItems.splice(itemIndex, 1);

        // If all items are removed, cancel the entire order
        if (findOrder.orderedItems.length === 0) {
            findOrder.status = 'Cancelled';
        }

        await findOrder.save();

        res.json({ message: "Item cancelled successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};





const getOrderDetails = async (req,res) => {
    try {

        const orderId = req.params.orderId;
        const userId = req.session.user


        const order = await Order.findOne({ _id: orderId, userId })
        .populate('orderedItems.product').lean()
        

        if (!order) {
            return res.status(404).json({message:'users order not found'})
        }

        console.log(order)
        
        res.status(200).render('order-details',{order})

    } catch (error) {
          console.error("Error fetching order details:", error);
        res.status(500).redirect('/pageNotFound');
    }
}
             


module.exports = {
    orderPlaced,
    loadOrderSuccess,
    viewOrders,
    cancelOrder,
    getOrderDetails,
    createRazorpayOrder,
    verifyRazorpayPayment
}
