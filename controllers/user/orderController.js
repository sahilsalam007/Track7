const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')
const mongoose = require('mongoose')
const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema')
const Cart = require('../../models/cartSchema')
const Coupon = require('../../models/couponSchema')
const ObjectId = require('mongoose').Types.ObjectId;
 


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


const loadOrderSuccess = async (req,res) => {
    try {
        res.render('order-success')
    } catch (error) {
        
    }
};

     
const viewOrders = async (req, res) => {
    try {
        const userId = req.session.user;

        console.log(userId)
        const orders=await Order.find({userId:userId})
        .populate('userId')
        .populate('orderedItems.product').sort({ createdOn: -1 })
        .populate("address")

      
        res.render("orders",{orders,})
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).render('orders', { user: req.session.user, orders: [], error: "Failed to fetch orders." });
    }
 
}


const cancelOrder = async (req,res) => {
    try {

        const {orderId} = req.params
        const userId = req.session.user

        console.log('orderid is :',orderId)
        console.log('userid is:',userId)

        const findUser = await User.findById(userId)


        if(!findUser){
            return res.status(404).json({message:'User not found'})
        }

       
        const findOrder = await Order.findOne({orderId:orderId})

        if (!findOrder) {
          return res.status(404).json({ message: "Order not found" });
        }

        if (findOrder.status === "Cancelled") {
            return res.status(400).json({ message: "Order is already cancelled" });
          }


          for(const item of findOrder.orderedItems){
            const product = await Product.findById(item.product)

            if(product){
              product.quantity += item.quantity
              await product.save()
            }
          }


        
          await Order.updateOne({ orderId: orderId }, { status: "Cancelled" });
          
        //   res.status(200).json({ message: "Order cancelled successfully" });
          res.redirect('/orders')
    
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" })   
        
    }
}


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
        
        res.render('order-details',{order})

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
}
