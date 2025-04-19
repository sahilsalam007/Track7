const Order=require("../../models/orderSchema");
const PDFDocument=require("pdfkit");
const fs=require("fs");
const ExcelJS=require("exceljs");

const getSalesReport = async (req, res) => {
    try {
        console.log('sales:', req.query);

        const { page = 1, day, startDate, endDate } = req.query;
        const limit = 10;
        const skip = (page - 1) * limit;
        let query = { 'payment.status': 'Paid' }; 
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
        } else if (day === 'custom') {
            errors.push("Please provide both startDate and endDate for custom filter.");
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
            .populate('userId')
            .skip(skip)
            .limit(limit)
            .sort({ createdOn: -1 })
            .lean();

        const allOrders = await Order.find(query).populate('userId').lean();

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

        res.status(200).render('sales-report', {
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



const downloadPDF=async(req, res,next) => {
    try {


        let { day, startDate, endDate } = req.query;
        let query = { 'payment.status':'Paid' }; 

        const today = new Date();
        let fromDate = null;
        let toDate = today;

        if (day === "salesToday") {
            fromDate = new Date();
        } else if (day === "salesWeekly") {
            fromDate = new Date();
            fromDate.setDate(today.getDate() - 7);
        } else if (day === "salesMonthly") {
            fromDate = new Date();
            fromDate.setMonth(today.getMonth() - 1);
        } else if (day === "salesYearly") {
            fromDate = new Date();
            fromDate.setFullYear(today.getFullYear() - 1);
        }

        if ((!startDate || !endDate) && fromDate) {
            startDate = fromDate.toISOString().split("T")[0];
            endDate = toDate.toISOString().split("T")[0];
        }

        if (!startDate || !endDate) {
            return res.status(400).json({ message: "Start and End dates are required" });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        start.setUTCHours(0, 0, 0, 0);
        end.setUTCHours(23, 59, 59, 999);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ message: "Invalid date format" });
        }

        query.createdOn = { $gte: start, $lte: end };

        const orders = await Order.find(query)
            .populate("userId", "firstName email")
            .populate({
                path: "orderedItems.product",
                model: "Product",
                select: "productName"
            })
            .sort({ createdOn: -1 })
            .lean();

            console.log(orders);


        const orderDetails=orders.map((order)=>{
            return {
                    orderId:order?.orderId,
                    orderDate:order?.createdOn,
                    itemsCount:order.orderedItems.length,
                    usedCoupon:"djlkf",
                    customer:"sahil",
                    amount:order?.finalAmount
                }
        })

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, left: 40, right: 40, bottom: 50 },
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="sales-report.pdf"');

      doc.pipe(res);
  
      doc.fontSize(20).font('Helvetica-Bold').text('Sales Report', { align: 'center' }).moveDown();
 
      doc.fontSize(12).text(`Report Date: ${today}`, { align: 'right' }).moveDown();
  
      doc.rect(20, doc.y, 550, 20).fillAndStroke('#000000', '#00000');
      doc
      .font('Helvetica-Bold')
        .fillColor('#ffffff')
        .fontSize(12)
        .text('Order ID', 55, doc.y + 5, { width: 200 })
        .text('order Date', 175, doc.y - 15 , { width: 70 })
        .text('Items Count', 270, doc.y - 14, { width: 100 })
        .text('Customer', 400, doc.y - 14, { width: 100 })
        .text('Amount', 500, doc.y - 14, { width: 100 })
      doc.moveDown();

      let isAlternate = false;
      orderDetails.forEach((order) => {
        const rowColor = isAlternate ? '#f9f9f9' : '#fff';
        doc.rect(20, doc.y, 550, 30).fillAndStroke(rowColor, '#ddd');
        doc
        .font('Helvetica')
          .fillColor('#000')
          .fontSize(12)
          .text(order.orderId.slice(0,15)+'...', 40, doc.y + 9, { width: 200 })
          .text(order.orderDate.toLocaleDateString(), 185, doc.y - 12 , { width: 70 })
          .text(order.itemsCount, 300, doc.y - 14, { width: 100 })
          .text(order.customer, 405, doc.y - 14, { width: 100 })
          .text(order.amount, 500, doc.y - 14, { width: 100 })
        doc.moveDown();
        isAlternate = !isAlternate;
      });
  
      doc.rect(20, doc.y, 550, 90).fillAndStroke("f9f9f9", '#ddd');

      doc
        .fontSize(10)
        .fillColor("#0000")
        .text('Thank you for your business!', 50, doc.y + 15, { align: 'center', baseline: 'bottom' });

      doc.end();
    } catch (error) {
        console.log(error.message)
      res.status(500).send('Error generating PDF');
    }
  };


const downloadExcel = async (req, res) => {
    try {
        let { day, startDate, endDate } = req.query;
        let query = { status: { $in: ["Confirmed", "Delivered"] } };

        const today = new Date();
        let fromDate = null;
        let toDate = today;

        if (day === "salesToday") fromDate = new Date();
        else if (day === "salesWeekly") fromDate = new Date(today.setDate(today.getDate() - 7));
        else if (day === "salesMonthly") fromDate = new Date(today.setMonth(today.getMonth() - 1));
        else if (day === "salesYearly") fromDate = new Date(today.setFullYear(today.getFullYear() - 1));

        if (!startDate || !endDate) {
            startDate = fromDate.toISOString().split("T")[0];
            endDate = toDate.toISOString().split("T")[0];
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        start.setUTCHours(0 - 5, 30, 0, 0);    
         end.setUTCHours(23 - 5, 59 + 30, 59, 999); 

        query.createdOn = { $gte: start, $lte: end };

        const orders = await Order.find(query)
            .populate("userId", "firstName email")
            .populate({ path: "orderedItems.product", model: "Product", select: "productName" })
            .sort({ createdOn: -1 })
            .lean();

        if (orders.length === 0) return res.status(404).json({ message: "No orders found" });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Sales Report");

        worksheet.columns = [
            { header: "Order ID", key: "_id", width: 20 },
            { header: "User", key: "user", width: 20 },
            { header: "Total (₹)", key: "finalAmount", width: 15 },
            { header: "Discount (₹)", key: "discount", width: 15 },
            { header: "Date", key: "createdOn", width: 20 },
            { header: "Items", key: "items", width: 30 }
        ];

        orders.forEach(order => {
            worksheet.addRow({
                _id: order._id,
                user: `${order.userId?.firstName || "Unknown"} (${order.userId?.email || "N/A"})`,
                finalAmount: order.finalAmount,
                discount: order.discount || 0,
                createdOn: order.createdOn.toDateString(),
                items: order.orderedItems.map(item => `${item.product?.productName || "Unknown"} x${item.quantity}`).join(", ")
            });
        });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", "attachment; filename=salesReport.xlsx");
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ message: "Error generating Excel report" });
    }
};


module.exports={
    getSalesReport,
    downloadPDF, 
    downloadExcel 
}