const Product= require("../../models/productSchema");
const User=require("../../models/userSchema");
const Order=require("../../models/orderSchema");

const getorderDetails = async (req,res) => {
    try {

        const { orderId } = req.params;
        const order = await Order.findById(orderId)
            .populate('userId', 'name  email') 
            .populate({  
                path:'orderedItems.product',select:'productName productImage price'
            }); 
        if (!order) {
            return res.status(404).status(404).render('admin/error', { message: 'Order not found' });
        }
        // console.log('order data:',order)
        // console.log('order Items:',order.orderedItems)
        res.status(200).render('admin-order-details', { order });        
    } catch (error) {
        console.error('Error fetching order details:', error)
        res.status(500).render('admin/error', { message: 'Server error' })        
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


const getorder=async(req,res)=>
{
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


module.exports={
   getOrderList,
   getorder,
   updateStatus,
   getorderDetails
}