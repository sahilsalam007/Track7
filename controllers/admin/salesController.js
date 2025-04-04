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


const downloadPDF = async (req, res) => {
    try {
        let { day, startDate, endDate } = req.query;
        let query = { status: { $in: ["Confirmed", "Delivered"] } };

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

        if (orders.length === 0) {
            return res.status(404).json({ message: "No orders found for the selected date range" });
        }

        let totalSales = 0;
        let totalDiscounts = 0;
        let totalOrders = orders.length;

        orders.forEach(order => {
            totalSales += order.finalAmount || 0;
            totalDiscounts += order.discount || 0;
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=salesReport.pdf");

        const doc = new PDFDocument({ margin: 40, size: "A4" });
        doc.pipe(res);

        // ✅ **Title**
        doc.fontSize(18).font("Helvetica-Bold").text("Sales Report", { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(12).font("Helvetica").text(`Date Range: ${startDate} - ${endDate}`, { align: "center" });
        doc.moveDown(1);

        // ✅ **Summary**
        doc.fontSize(12).font("Helvetica-Bold").text("Summary", { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).font("Helvetica")
            .text(`Total Orders: ${totalOrders}`)
            .text(`Total Sales: ₹${totalSales.toFixed(2)}`)
            .text(`Total Discount: ₹${totalDiscounts.toFixed(2)}`);
        doc.moveDown(1);

        // ✅ **Table Header Formatting**
        doc.fontSize(12).font("Helvetica-Bold").text("Orders Report");
        doc.moveDown(0.5);

        const headers = ["Order ID", "Date", "Customer", "Payment Method", "Total Qty", "Total Amount", "Discount", "Coupon", "Status"];
        const columnWidths = [100, 70, 80, 90, 60, 90, 70, 70, 60];

        let x = doc.x;
        let y = doc.y;

        // Draw header row with background
        doc.rect(x - 5, y - 3, 570, 20).fill("#d3d3d3").stroke();
        doc.fillColor("black");

        headers.forEach((header, i) => {
            doc.fontSize(10).font("Helvetica-Bold").text(header, x, y, { width: columnWidths[i], align: "center" });
            x += columnWidths[i];
        });

        doc.moveDown(1);
        y = doc.y;

        // ✅ **Table Rows**
        orders.forEach(order => {
            let x = doc.x;
            let y = doc.y;

            const rowData = [
                order._id || "Unknown",
                order.createdOn.toISOString().split("T")[0],
                order.userId?.firstName || "Unknown",
                order.paymentMethod || "N/A",
                order.orderedItems.reduce((sum, item) => sum + (item.quantity || 0), 0), // Total Qty
                `₹${order.finalAmount ? order.finalAmount.toFixed(2) : "0.00"}`,
                `₹${order.discount ? order.discount.toFixed(2) : "0.00"}`,
                order.coupon || "-",
                order.status || "N/A"
            ];

            rowData.forEach((text, i) => {
                doc.fontSize(9).font("Helvetica").text(text, x, y, { width: columnWidths[i], align: "center" });
                x += columnWidths[i];
            });

            // Draw row separators
            doc.moveDown(0.5);
            doc.rect(doc.x - 5, y - 3, 570, 18).stroke(); 

            doc.moveDown(0.5);
        });

        doc.end();
    } catch (error) {
        console.error("PDF Generation Error:", error);
        res.status(500).json({ message: "Error generating PDF report" });
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
        start.setUTCHours(0, 0, 0, 0);
        end.setUTCHours(23, 59, 59, 999);
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