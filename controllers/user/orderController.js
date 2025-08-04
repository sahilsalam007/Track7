const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const mongoose = require('mongoose');
const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const Cart = require('../../models/cartSchema');
const Razorpay = require("razorpay");
const Wallet=require("../../models/walletSchema");
const Coupon=require("../../models/couponSchema");
const crypto = require("crypto");
require('dotenv').config();
const{razorpayInstance,verifySignature}=require("../../config/razorPay");
const PDFDocument = require('pdfkit');


const generateOrderId = async () => {
    const latestOrder = await Order.findOne().sort({ createdOn: -1 });

    let lastId = 1000;
    if (latestOrder && latestOrder.orderId) {
        const match = latestOrder.orderId.match(/TRA(\d+)/);
        if (match) {
            lastId = parseInt(match[1]);
        }
    }
    return `TRA${lastId + 1}`;
};


const orderPlaced = async (req, res) => {
    try {

        const { totalPrice, addressId, paymentMethod } = req.body;
        const normalPaymentMethod = paymentMethod.toLowerCase();
        let discount =0
        if(req.session.appliedCoupon && typeof req.session.appliedCoupon.discount === 'number'){
            discount =  req.session.appliedCoupon.discount;
        }

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
            const product = await Product.findById(item.productId._id);
            if (product) {
                product.quantity -= item.quantity;
                await product.save();
            }
        }
        const finalAmount= totalPrice - discount;
        if(normalPaymentMethod === "cod" && finalAmount > 1000){
            return res.status(400).json({success:false, message:"COD not allows orders above  rs 1000"})
        }

        const orderId = await generateOrderId();
        const newOrder = new Order({
            orderId,
            userId,
            orderedItems: cart.map(item => ({
                product: item.productId,
                quantity: item.quantity,
                price: item.productId.salesPrice
            })),
            totalPrice,
            discount,
            finalAmount,
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
            payment: {
        method: normalPaymentMethod, 
        status: normalPaymentMethod === "cod" ? "Pending" : "Paid" 
    },
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
        const { userId, couponCode, taxAmount = 0 } = req.body;

        

        const user = await User.findById(userId).populate("cart.productId");
        if (!user) {
         
            return res.status(404).json({ success: false, error: "User not found" });
        }

        let totalPrice = 0;
        for (const item of user.cart) {
            totalPrice += item.productId.salesPrice * item.quantity;
        }

        let discount = 0;
        if (couponCode) {
            const coupon = await Coupon.findOne({ name: couponCode.trim() }); // preshnam 
            if (coupon) discount = coupon.offerPrice;
        }

        const finalAmount = totalPrice + taxAmount - discount;
        const response = await razorpay.orders.create({
            amount: (finalAmount * 100), 
            currency: "INR",
            receipt: userId + "-" + new Date().getTime()
        });

        res.json({
            success: true,
            orderId: response.id,
            currency: response.currency,
            amount: response.amount,
            finalAmount,
            discount,
            taxAmount
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
            userId,
            addressId,
            taxAmount,
            totalPrice
        } = req.body;
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

        if (!userId || !addressId || !totalPrice) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields: userId, addressId, or totalPrice"
            });
        }

        const user = await User.findOne({ _id: userId }).populate("cart.productId");
        if (!user) {
            return res.status(404).json({ success: false, error: "User not found" });
        }
        const cart = user.cart || [];
        if (!cart.length) {
            return res.status(400).json({ success: false, error: "Cart is empty" });
        }
        const orderedItems = cart.map(item => ({
            product: item.productId._id,
            quantity: item.quantity,
            price: item.productId.salesPrice
        }));
        const userAddress = await Address.findOne(
            { "address._id": addressId },
            { "address.$": 1, _id: 0 }
        );

        if (!userAddress || !userAddress.address.length) {
            return res.status(400).json({ success: false, error: "Invalid address" });
        }

         const address = userAddress.address[0];
        let discount = 0
        if(req.session.appliedCoupon && typeof req.session.appliedCoupon.discount === "number"){
            discount =  req.session.appliedCoupon.discount;
        }
         const finalAmount = totalPrice - discount + taxAmount;
         const orderId = await generateOrderId();
         const newOrder = new Order({
            orderId,
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
                 status: "Paid"
             },
             status: "Pending"
         });

         for (const item of cart) {
            const product = await Product.findById(item.productId._id);
            if (product) {
                product.quantity -= item.quantity;
                await product.save();
            }
        }
 
         await newOrder.save();
         await User.updateOne({ _id: userId }, { $set: { cart: [] } });

       return res.status(200).json({ 
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


const loadOrderFailed=async(req,res)=>{
    try {
        res.render("order-failed");
    } catch (error) {
        
    }
}


const getFailedOrders=async(req,res)=>{
    try {
        const failedOrders=await Order.find({status:"Failed"})
        .populate("userId")
        .populate({
            path:"orderedItems.product",
            select:"productName productImage price"
        })
       
        res.render("failed-orders",{
            RAZORPAY_KEY_ID:process.env.RAZORPAY_KEY_ID,
            failedOrders:failedOrders
        })
    } catch (error) {
        console.error("Error fetching failed orders:",error);
        res.status(500).json({success:false,message:"Internal Server Error"})
    }
}
     

const createFailedOrder = async (req, res) => {
    try {
        const { userId, addressId, totalPrice, discount, paymentMethod, razorpayPaymentId, razorpayOrderId } = req.body;

        const sample=await Cart.find({userId:userId})
        
        const user = await User.findById(userId).populate('cart.productId');
        const cart=user.cart;
        if (!cart || cart.length === 0) {
            return res.status(400).json({ success:false,message: "Your cart is empty." });
        }
  
        
        const outOfStockItems = [];
        for (const item of cart) {
             
            const product = await Product.findById(item.productId);
        
            if (!product || product.quantity < item.quantity) {
                outOfStockItems.push({
                    product: product ? product.productName : 'Unknown product',
                    requestedQuantity: item.quantity,
                    availableQuantity: product ? product.quantity : 0
                });
            }
        }

        const existingFailedOrder = await Order.findOne({ razorpayOrderId, status: 'Failed' });

        if (existingFailedOrder) {
            return res.status(400).json({ success: false, message: "A failed order for this payment already exists." });
        }

        if (outOfStockItems.length > 0) {
            return res.status(404).json({ success:false,message: 'Some items are out of stock.', outOfStockItems });
        }

        const selectedAddress = await Address.findOne({userId})
        if(!selectedAddress){
           return res.status(404).json({error : 'Address not found'})
        }


        if (!selectedAddress) {
            return res.status(400).json({ error: "Invalid address." });
        }

     
        let totalAmount = totalPrice - (discount || 0);

      
        const order = new Order({
            userId,
            orderedItems: cart.map(item => ({
                product: item.productId,
                quantity: item.quantity,
                price: item.price,
                size: item.size
            })),
            totalPrice,
            discount: discount || 0,
            finalAmount: totalAmount,
            address: selectedAddress,
            paymentMethod,
            status: 'Failed',   
            razorpayPaymentId,
            razorpayOrderId,
            
        });

        await order.save();
        


        return res.json({ success: true, orderId: order._id });

    } catch (error) {
        console.error(" Error saving failed order:", error);
        return res.status(500).json({ error: "Failed to create order." });
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
 
};


const downloadInvoice = async (req, res, next) => {
    try {
      const { orderId } = req.params
      const orderDetails = await Order.findById(orderId)
      .populate('orderedItems.product')
      .populate('userId');



      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, left: 40, right: 40, bottom: 40 },
      })
  
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${orderId}.pdf"`)
      doc.pipe(res)

      doc
        .fillColor('#000000')
        .rect(0, 0, 100, 60)
        .rect(doc.page.width - 100, 0, 100, 60)
        .fill()

      doc
        .fontSize(36)
        .font('Helvetica-Bold')
        .text('INVOICE', 40, 80)
        
      doc
        .fontSize(16)
        .font('Helvetica')
        .text('Track7', doc.page.width - 240, 80)
        .fontSize(12)
        .text('Your Shopping Partner', doc.page.width - 240, 100)

      doc
        .moveTo(40, 130)
        .lineTo(doc.page.width - 40, 130)
        .stroke()

      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('INVOICE TO:', 40, 150)
  
      doc
        .font('Helvetica')
        .fontSize(12)
        .text(orderDetails?.address?.name, 40, 170)
        .text(`Address: ${orderDetails.address.addressType}`, 40, 190)
        .text(`${orderDetails.address.phone}`, 90, 210)
        .text(`${orderDetails.address.city, orderDetails.address.state}`, 90, 230)
        .text(`${orderDetails?.address?.pincode}`, 90, 250)

      doc
        .fontSize(12)
        .text(`Order ID: ${orderId}`, doc.page.width - 400, 170, { align: 'right' })
        .text(`Date: ${new Date(orderDetails.createdOn).toLocaleDateString()}`, doc.page.width - 200, 190, { align: 'right' })

      const tableTop = 300
      const tableHeaders = ['PRODUCTS', 'QTY', 'PRICE', 'TOTAL']
      const columnWidths = [250, 100, 100, 100]

      doc
        .fillColor('#000000')
        .rect(40, tableTop - 30, doc.page.width - 80, 30)
        .fill()
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(12)
  
      let currentX = 50
      tableHeaders.forEach((header, i) => {
        doc.text(header, currentX, tableTop - 20)
        currentX += columnWidths[i]
      })

      doc.fillColor('#000000')
      let yPosition = tableTop + 10
  
      orderDetails.orderedItems
  .filter(item => item.productStatus !== "Cancelled")
  .forEach((item, index) => {
    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor('#000000')
      .text(item?.product?.productName, 50, yPosition)
      .text(item.quantity.toString(), 300, yPosition)
      .text(`Rs.${item?.price}`, 400, yPosition)
      .text(`Rs.${item?.price * item.quantity}`, 500, yPosition);

    yPosition += 40;
});

      doc
        .moveTo(40, 430)
        .lineTo(doc.page.width - 50, 430)
        .stroke()

      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('Payment Method:', 40, yPosition + 20)
        .font('Helvetica')
        .fontSize(12)
        .text(`Payment Method: ${orderDetails.payment.method==="cod"?"Cash on Delivery":orderDetails.payment.method==="razorpay"?"Online":"Wallet"}`, 40, yPosition + 40)
        .text(`Payment Status: ${orderDetails.payment.status}`, 40, yPosition + 60)

      doc
        .font('Helvetica')
        .fontSize(12)

        .text('Delivery Fee:', 400, yPosition + 20)
        .text(`Rs.${0}`, 500, yPosition + 20)
        .text('Coupon Discount:', 400, yPosition + 40)
        .text(`Rs.${orderDetails?.couponUsed?.couponDiscount||'0'}`, 500, yPosition + 40)
        .text('Total:', 400, yPosition + 60)
        .text(`Rs.${orderDetails.finalAmount}`, 500, yPosition + 60)

      doc
        .font('Helvetica')
        .fontSize(14)
        .text('Thank you for purchase!', 40, yPosition + 100)

      doc
        .fillColor('#000000')
        .rect(0, doc.page.height - 40, doc.page.width, 40)
        .fill()
  
      doc.end()
  
    } catch (error) {
      console.error('Error generating invoice:', error)
      res.status(500).send('Error generating invoice PDF')
    }
  }
 

const cancelOrder = async (req, res) => {
    try {
        const { orderId, itemId } = req.body;
        const userId = req.session.user;

        const findUser = await User.findById(userId);
        if (!findUser) return res.status(404).json({ message: 'User not found' });

        const findOrder = await Order.findOne({ orderId });
        if (!findOrder) return res.status(404).json({ message: 'Order not found' });

        if (findOrder.status === 'cancelled') { 
            return res.status(400).json({ message: 'Order is already cancelled' });
        }

        const itemIndex = findOrder.orderedItems.findIndex(item => item._id.toString() === itemId);
        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Item not found in the order' });
        }

        const cancelledItem = findOrder.orderedItems[itemIndex];

        console.log("Cancelling item:", cancelledItem);
        console.log(findOrder.payment.method)
        const refundAmount = cancelledItem.price * cancelledItem.quantity;
        if (findOrder.payment.method === 'razorpay' || findOrder.payment.method === 'wallet') {
            let wallet = await Wallet.findOne({ userId });
            if (!wallet) wallet = new Wallet({ userId, balance: 0, transactions: [] });

            console.log("Refund Amount:", refundAmount);

            wallet.balance += refundAmount;
            wallet.transactions.push({
                type: "credit",
                amount: refundAmount,
                description: `Refund for cancelled item #${cancelledItem._id} in order #${orderId}`,
                orderId: findOrder._id,
            });

            await wallet.save();
        }

        const product = await Product.findById(cancelledItem.product);
        if (product) {
            product.quantity += cancelledItem.quantity;
            await product.save();
        }

        findOrder.orderedItems[itemIndex].productStatus = "Cancelled";
             console.log("final amount",findOrder.finalAmount)
             findOrder.finalAmount-=refundAmount
        await findOrder.save();

        return res.status(200).json({ message: "Item cancelled successfully" });

    } catch (error) {
        console.error("Cancel Order Error:", error);
        res.status(500).json({ message: 'Internal server error' });
    }
};


const walletPayment = async (req, res) => {
    try {
        const userId = req.session.user;
        let discount = 0
        if(req.session.appliedCoupon && typeof req.session.appliedCoupon.discount === 'number'){
            discount =  req.session.appliedCoupon.discount;
        }
        const { totalPrice, addressId, paymentMethod} = req.body;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Please log in" });
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
            const product = await Product.findById(item.productId._id);
            if (product) {
                product.quantity -= item.quantity;
                await product.save();
            }
        }
        

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            return res.status(400).json({ success: false, message: "Wallet not found" });
        }


        if (wallet.balance < totalPrice) {
            return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
        }

        const orderId = await generateOrderId();
        const newOrder = new Order({
            orderId,
            userId,
            orderedItems: cart.map(item => ({
                product: item.productId,
                quantity: item.quantity,
                price: item.productId.salesPrice
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
            payment: {
                method: "wallet",
                status: "Paid"
            },
            status: "Pending"
        });

        wallet.balance -= totalPrice;
        wallet.transactions.push({
            type: "debit",
            amount:totalPrice,
            description: "Wallet payment for order",
            orderId:newOrder._id
        });

        await wallet.save();
        
        await newOrder.save();
        await User.updateOne({ _id: userId }, { $set: { cart: [] } });

        res.json({ success: true, message: "Payment successful", newBalance: wallet.balance });

    } catch (error) {
        console.error("Wallet payment error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
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

        
        res.status(200).render('order-details',{order})

    } catch (error) {
          console.error("Error fetching order details:", error);
        res.status(500).redirect('/pageNotFound');
    }
}
  

const returnOrder = async (req, res) => {
    const { orderId, itemId } = req.params;
    const { returnReason } = req.body;

    try {
        const order = await Order.findOne({ orderId: orderId.trim() });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const item = order.orderedItems.id(itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found in order' });
        }

        if (item.productStatus !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
        }

        if (item.productStatus === 'Returned' || item.productStatus === 'Return Request') {
            return res.status(400).json({ success: false, message: 'Item already requested for return or returned' });
        }
        item.productStatus = 'Return Request';
        item.returnReason = returnReason;
        if (order.orderedItems.some(item => item.productStatus === 'Return Request')) {
            order.status = 'return-requested';
        }

        await order.save();


        return res.status(200).json({ success: true, message: 'Return request submitted successfully' });
    } catch (error) {
        console.error('Return order error:', error);
        return res.status(500).json({ success: false, message: 'Error processing return request' });
    }
};



module.exports = {
    orderPlaced,
    loadOrderSuccess,
    loadOrderFailed,
    viewOrders,
    downloadInvoice,
    cancelOrder,
    createFailedOrder,
    getOrderDetails,
    getFailedOrders,
    createRazorpayOrder,
    verifyRazorpayPayment,
    walletPayment,
    returnOrder
}
