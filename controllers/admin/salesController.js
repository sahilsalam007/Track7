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
        console.log("Sample Order:", orders[0]);
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



const downloadPDF = async (req, res, next) => {
    try {
        let { day, startDate, endDate } = req.query;
        let query = { 'payment.status': 'Paid' };

        const today = new Date();
        let fromDate = null;
        let toDate = new Date();

        if (day === "salesToday") fromDate = new Date();
        else if (day === "salesWeekly") fromDate = new Date(today.setDate(today.getDate() - 7));
        else if (day === "salesMonthly") fromDate = new Date(today.setMonth(today.getMonth() - 1));
        else if (day === "salesYearly") fromDate = new Date(today.setFullYear(today.getFullYear() - 1));

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
            .populate("userId", "name email")
            .populate({
                path: "orderedItems.product",
                model: "Product",
                select: "productName"
            })
            .sort({ createdOn: -1 })
            .lean();

        const orderDetails = orders.map(order => {
            const tax = +(order.finalAmount * 0.10).toFixed(2);
            return {
                orderId: order?.orderId || 'N/A',
                orderDate: order?.createdOn || new Date(),
                itemsCount: order.orderedItems?.length || 0,
                customer: `${order.userId?.name || 'N/A'}`,
                discount: order?.discount || 0,
                tax: tax,
                amount: order?.finalAmount || 0,
                totalBeforeTax: order.finalAmount || 0
            };
        });

        const totalOrders = orderDetails.length;
        const totalSales = orderDetails.reduce((acc, o) => acc + o.totalBeforeTax, 0);
        const totalDiscount = orderDetails.reduce((acc, o) => acc + o.discount, 0);

        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, left: 40, right: 40, bottom: 50 },
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="sales-report.pdf"');
        doc.pipe(res);

        doc.fontSize(20).font('Helvetica-Bold').text('Sales Report', { align: 'center' });

        const summaryStartY = doc.y + 10;
        doc.rect(40, summaryStartY, 200, 60).fill('#f2f2f2');
        doc.fillColor('#000');
        doc.fontSize(12).font('Helvetica-Bold').text('Sales Summary', 45, summaryStartY + 5, { underline: true });
        doc.fontSize(11).font('Helvetica')
            .text(`Total Orders: ${totalOrders}`, 45, summaryStartY + 25)
            .text(`Total Sales: rs ${totalSales.toFixed(2)}`, 45, summaryStartY + 40)
            .text(`Total Discount: rs ${totalDiscount.toFixed(2)}`, 45, summaryStartY + 55);

        doc.fontSize(11)
            .fillColor('#333')
            .text(`Report Date: ${today.toDateString()}`, 400, summaryStartY + 5, { align: 'right' });

        doc.moveDown(5);
        
        const headerTop = doc.y;
        doc.rect(20, headerTop, 650, 25).fill('#000');
        doc
            .fillColor('#fff')
            .font('Helvetica-Bold')
            .fontSize(11)
            .text('Order ID', 40, headerTop + 7, { width: 90 })
            .text('Order Date', 130, headerTop + 7, { width: 80 })
            .text('Items', 210, headerTop + 7, { width: 40 })
            .text('Customer', 250, headerTop + 7, { width: 80 })
            .text('Disc (%)', 360, headerTop + 7, { width: 60 })
            .text('Tax (rs)', 420, headerTop + 7, { width: 50 })
            .text('Amnt (rs)', 470, headerTop + 7, { width: 60 })
            .text('Total (rs)', 530, headerTop + 7, { width: 60 });

        doc.fillColor('#000');
        doc.moveDown(1.5);

        let isAlternate = false;
        const tableStartY = doc.y;

        orderDetails.forEach(order => {
            const rowColor = isAlternate ? '#f6f6f6' : '#ffffff';
            const totalAmount = order.amount + order.tax ;
            const rowTop = doc.y;

            doc.rect(20, rowTop, 650, 30).fillAndStroke(rowColor, '#ddd');

            doc.font('Helvetica').fillColor('#000').fontSize(11);
            doc.text(order.orderId.slice(0, 15) + '...', 40, rowTop + 7, { width: 90 });
            doc.text(order.orderDate.toLocaleDateString(), 130, rowTop + 7, { width: 80 });
            doc.text(order.itemsCount, 210, rowTop + 7, { width: 40 });
            doc.text(order.customer, 250, rowTop + 7, { width: 80 });
            doc.text(order.discount.toFixed(2), 360, rowTop + 7, { width: 60 });
            doc.text(order.tax.toFixed(2), 420, rowTop + 7, { width: 50 });
            doc.text(order.amount.toFixed(2), 470, rowTop + 7, { width: 60 });
            doc.text(totalAmount.toFixed(2), 530, rowTop + 7, { width: 60 });

            doc.moveDown(1.5);
            isAlternate = !isAlternate;
        });
        const totalHeight = (orderDetails.length * 30) + 25;
        doc.rect(20, tableStartY - 2, 650, totalHeight).stroke('#aaa');

        doc.end();
    } catch (error) {
        console.log("PDF Report Error:", error.message);
        res.status(500).send('Error generating PDF');
    }
};



const downloadExcel = async (req, res) => {
    try {
        let { day, startDate, endDate } = req.query;
        let query = { 'payment.status': 'Paid' };

        const today = new Date();
        let fromDate = null;
        let toDate = new Date();

        if (day === "salesToday") fromDate = new Date();
        else if (day === "salesWeekly") fromDate = new Date(today.setDate(today.getDate() - 7));
        else if (day === "salesMonthly") fromDate = new Date(today.setMonth(today.getMonth() - 1));
        else if (day === "salesYearly") fromDate = new Date(today.setFullYear(today.getFullYear() - 1));

        if (!startDate || !endDate) {
            startDate = fromDate.toISOString().split("T")[0];
            endDate = toDate.toISOString().split("T")[0];
        }

        const start = new Date(startDate + "T00:00:00.000+05:30");
        const end = new Date(endDate + "T23:59:59.999+05:30");

        query.createdOn = { $gte: start, $lte: end };

        const orders = await Order.find(query)
            .populate("userId", "name email")
            .populate({ path: "orderedItems.product", model: "Product", select: "productName" })
            .sort({ createdOn: -1 })
            .lean();

        if (orders.length === 0) {
            return res.status(404).json({ message: "No orders found" });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Sales Report");

        // Add Summary Sheet
        const summarySheet = workbook.addWorksheet("Summary");
        const totalOrders = orders.length;
        const totalSales = orders.reduce((acc, o) => acc + o.finalAmount, 0);
        const totalDiscount = orders.reduce((acc, o) => acc + (o.discount || 0), 0);

        summarySheet.columns = [
            { header: "Summary", key: "label", width: 30 },
            { header: "Value", key: "value", width: 30 }
        ];

        summarySheet.addRows([
            { label: "Total Orders", value: totalOrders },
            { label: "Total Sales (₹)", value: totalSales.toFixed(2) },
            { label: "Total Discount (₹)", value: totalDiscount.toFixed(2) },
            { label: "Report Date", value: today.toDateString() }
        ]);

        // Orders Sheet
        worksheet.columns = [
            { header: "Order ID", key: "orderId", width: 20 },
            { header: "Customer", key: "user", width: 30 },
            { header: "Order Date", key: "createdOn", width: 20 },
            { header: "Items", key: "items", width: 40 },
            { header: "Discount (₹)", key: "discount", width: 15 },
            { header: "Tax (₹)", key: "tax", width: 15 },
            { header: "Amount (₹)", key: "finalAmount", width: 15 },
            { header: "Total (₹)", key: "total", width: 15 }
        ];

        orders.forEach(order => {
            const tax = +(order.finalAmount * 0.10).toFixed(2);
            const totalAmount = order.finalAmount + tax;
            worksheet.addRow({
                orderId: order.orderId || 'N/A',
                user: `${order.userId?.name || "Unknown"}`,
                createdOn: order.createdOn.toLocaleDateString(),
                items: order.orderedItems.map(item => `${item.product?.productName || "Unknown"} x${item.quantity}`).join(", "),
                discount: order.discount || 0,
                tax,
                finalAmount: order.finalAmount,
                total: totalAmount.toFixed(2)
            });
        });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", "attachment; filename=salesReport.xlsx");
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Excel Report Error:", error.message);
        res.status(500).json({ message: "Error generating Excel report" });
    }
};


module.exports={
    getSalesReport,
    downloadPDF, 
    downloadExcel 
}