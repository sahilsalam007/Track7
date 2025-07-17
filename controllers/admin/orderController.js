const Product= require("../../models/productSchema");
const User=require("../../models/userSchema");
const Order=require("../../models/orderSchema");
const mongoose = require("mongoose");
const Wallet = require("../../models/walletSchema");

const getorderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId })
      .populate('userId', 'name email')
      .populate({
        path: 'orderedItems.product',
        select: 'productName productImage price',
      });

    if (!order) {
      return res.status(404).render('error', { message: 'Order not found' });
    }

    const wallet = await Wallet.findOne({ userId: order.userId._id });

    console.log("Order:", order);
    console.log("Wallet:", wallet);

    res.status(200).render('admin-order-details', {
      order,
      wallet,
    });

  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).render('error', { message: 'Server error' });
  }
};


const updateStatus = async (req,res) => {
    try {
        const { orderId, status } = req.body;      
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if(status==="Delivered"){
            order.payment.status="Paid";
            order.orderedItems.forEach(item=>{
                if(!['Cancelled','Return Request','Returned'].includes(item.productStatus)){
                    item.productStatus = 'Delivered';
                }
            })
        }

        order.status = status;
        await order.save();
        res.json({ success: true, message: 'Order status updated successfully', updatedStatus: status });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ success: false, message: 'Server error'});
}
};


const getOrderList = async (req, res) => { 
    try {
        const searchQuery = req.query.search ? req.query.search.trim() : '';       
        const page = parseInt(req.query.page) || 1;
        const limit = 10;      
        let query = {};
        if (searchQuery) {
            query = {
                $or: [
                    { orderId: { $regex: searchQuery, $options: "i" } }, 
                    { "userId.name": { $regex: searchQuery, $options: "i" } },
                ]
            };
        }
        const totalOrders = await Order.countDocuments(query);
        const orders = await Order.find(query)
            .populate('userId', 'name email')  
            .sort({ createdOn: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        
        const formattedOrders = orders.map(order => ({
            ...order.toObject(),
            user: order.userId,
        }));
        console.log(formattedOrders)
        res.status(200).json({
            orders: formattedOrders,
            totalPages: Math.ceil(totalOrders / limit),
            currentPage: page,
            searchQuery:searchQuery
        });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ error: "Failed to fetch orders." });
    }
};


const getorder = async(req, res) => {
    try {
        const search = req?.query?.search?.trim();
        const filter={};
        if(search){
            filter.orderId=search;   
        }

        const orders = await Order.find(filter);
        res.status(200).render("admin-orders",{orders})
        
    } catch (error) {
        console.error(error)
        res.status(500).redirect('/pageNotFound')
}
};

const approveItemReturn = async (req, res) => {
    try {
        const { orderId, itemId } = req.body;

        console.log('Approving return for orderId:', orderId, 'itemId:', itemId);
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const item = order.orderedItems.id(itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found in order' });
        }

        if (item.productStatus !== 'Return Request') {
            return res.status(400).json({ success: false, message: 'Item is not in Return Request status' });
        }

        // Update item status
        item.productStatus = 'Returned';

        // Refund logic
        if (order.payment.method === 'razorpay' || order.payment.method === 'wallet') {
            let wallet = await Wallet.findOne({ userId: order.userId });
            if (!wallet) {
                wallet = new Wallet({ userId: order.userId, balance: 0, transactions: [] });
            }

            const refundAmount = item.price * item.quantity;
            wallet.balance += refundAmount;
            wallet.transactions.push({
                type: "credit",
                amount: refundAmount,
                description: `Refund for returned item #${itemId} in order #${order.orderId}`,
                orderId: order._id,
            });

            await wallet.save();
        }

        // Restock the product
        const product = await Product.findById(item.product);
        if (product) {
            product.quantity += item.quantity;
            await product.save();
        }

        // Update order status
        const allItemsReturnedOrCancelled = order.orderedItems.every(item => item.productStatus === 'Returned' || item.productStatus === 'Cancelled');
        order.status = allItemsReturnedOrCancelled ? 'returned' : 'return-requested';

        await order.save();

        console.log(`Item [${itemId}] in Order [${order.orderId}] approved for return`);

        return res.status(200).json({ success: true, message: 'Item return approved successfully' });
    } catch (error) {
        console.error('Approve item return error:', error);
        return res.status(500).json({ success: false, message: 'Error processing return approval' });
    }
};


module.exports={
   getOrderList,
   getorder,
   updateStatus,
   getorderDetails,
   approveItemReturn
}