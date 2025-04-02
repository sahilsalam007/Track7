const Order=require("../../models/orderSchema");

const getSalesReport = async (req, res) => {
    try {
        console.log('sales:', req.query);

        const { page = 1, day, startDate, endDate } = req.query;
        const limit = 10;
        const skip = (page - 1) * limit;
        let query = { status: { $in: ["Confirmed", "Delivered"] } }; 
        let errors = [];

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const today = new Date();

            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);

            if (isNaN(start) || isNaN(end)) {
                errors.push("Invalid date format.");
            }
            if (start > end) {
                errors.push("Start Date cannot be later than End Date.");
            }
            if (start > today || end > today) {
                errors.push("Future dates are not allowed.");
            }

            if (errors.length > 0) {
                return res.render('sales-report', { 
                    errors, 
                    data: [], 
                    currentPage: parseInt(page), 
                    totalPages: 1, 
                    startDate, 
                    endDate, 
                    day, 
                    totalOrders: 0,
                    totalSales: 0,
                    totalDiscounts: 0,
                    grandTotal: 0
                });
            }

            query.createdOn = { $gte: start, $lte: end };
        }

        let filterFlags = {
            salesToday: false,
            salesWeekly: false,
            salesMonthly: false,
            salesYearly: false
        };

        const setDateFilter = (daysBack = 0) => {
            const date = new Date();
            date.setDate(date.getDate() - daysBack);
            date.setHours(0, 0, 0, 0);
            return { $gte: date };
        };

        switch (day) {
            case 'salesToday':
                query.createdOn = setDateFilter(0);
                filterFlags.salesToday = true;
                break;
            case 'salesWeekly':
                query.createdOn = setDateFilter(7);
                filterFlags.salesWeekly = true;
                break;
            case 'salesMonthly':
                query.createdOn = setDateFilter(30);
                filterFlags.salesMonthly = true;
                break;
            case 'salesYearly':
                query.createdOn = setDateFilter(365);
                filterFlags.salesYearly = true;
                break;
        }

        const orders = await Order.find(query)
            .populate({
                path: 'orderedItems.product',
                model: 'Product',
                select: 'name price'
            })
            .populate('userId', 'firstName email')
            .skip(skip)
            .limit(limit)
            .sort({ createdOn: -1 })
            .lean();

        const allOrders = await Order.find(query).lean();
        console.log(allOrders);

        const salesMetrics = allOrders.reduce((acc, order) => ({
            totalOrders: acc.totalOrders + 1,
            totalSales: acc.totalSales + (order.totalPrice || 0),
            totalDiscounts: acc.totalDiscounts + (order.discount || 0),
            grandTotal: acc.grandTotal + (order.finalAmount || 0)
        }), {
            totalOrders: 0,
            totalSales: 0,
            totalDiscounts: 0,
            grandTotal: 0
        });

        const totalPages = Math.ceil(salesMetrics.totalOrders / limit);

        res.render('sales-report', {
            data: orders,
            currentPage: parseInt(page),
            totalPages,
            startDate,
            endDate,
            day,
            ...filterFlags,
            ...salesMetrics
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};



module.exports={
    getSalesReport
}