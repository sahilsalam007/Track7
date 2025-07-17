const User=require("../../models/userSchema");
const mongoose=require("mongoose");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema")
const bcrypt=require("bcrypt");

const loadLogin=(req,res)=>{
    if(req.session.admin){
        return res.status(302).redirect("/admin/dashboard")
    }
    res.status(200).render("admin-login",{message:null})
};


const login=async(req,res)=>{
    try{
        const {email,password}=req.body;
        console.log(req.body);
        
        const admin=await User.findOne({email,isAdmin:true});
        if(admin){
            const passwordMatch=await bcrypt.compare(password,admin.password);
            if(passwordMatch){
                req.session.admin=admin._id;
                return res.status(200).redirect("/admin");
            }else{
                return res.status(401).redirect("/admin/login")
            }
        }else{
            return res.status(403).redirect("/admin/login")
        }
    }catch(error){
        console.log("login error",error)
        return res.status(500).redirect("/pageerror")
    }
};


const loadDashboard = async (req, res) => {
    console.log("trigger")
    if (req.session.admin) {
        try {
            const totalSalesData = await Order.aggregate([
                { $match: { status: { $nin: ["Cancelled", "Returned"] } } },
                { $group: { _id: null, total: { $sum: "$finalAmount" } } }
            ]);
            const totalSales = totalSalesData.length > 0 ? totalSalesData[0].total : 0;

            const bestSellingProducts = await Order.aggregate([
                { $unwind: "$orderedItems" },
                {
                    $group: {
                        _id: "$orderedItems.product",
                        totalSold: { $sum: "$orderedItems.quantity" }
                    }
                },
                { $sort: { totalSold: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: "products",
                        localField: "_id",
                        foreignField: "_id",
                        as: "productDetails"
                    }
                },
                { $unwind: "$productDetails" }
            ]);

            const bestSellingCategories = await Order.aggregate([
                { $unwind: "$orderedItems" },
                {
                    $lookup: {
                        from: "products",
                        localField: "orderedItems.product",
                        foreignField: "_id",
                        as: "productData"
                    }
                },
                { $unwind: "$productData" },
                {
                    $lookup: {
                        from: "categories",
                        localField: "productData.category",
                        foreignField: "_id",
                        as: "categoryData"
                    }
                },
                { $unwind: "$categoryData" },
                {
                    $group: {
                        _id: "$categoryData._id",
                        categoryName: { $first: "$categoryData.name" },
                        totalSold: { $sum: "$orderedItems.quantity" }
                    }
                },
                { $sort: { totalSold: -1 } },
                { $limit: 10 }
            ]);

            const bestSellingBrands = await Order.aggregate([
                { $unwind: "$orderedItems" },
                {
                    $lookup: {
                        from: "products",
                        localField: "orderedItems.product",
                        foreignField: "_id",
                        as: "productData"
                    }
                },
                { $unwind: "$productData" },
                {
                    $group: {
                        _id: "$productData.brand",
                        totalSold: { $sum: "$orderedItems.quantity" }
                    }
                },
                { $sort: { totalSold: -1 } },
                { $limit: 10 }
            ]);

            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();
            const currentDay = now.getDate();
            const startOfWeek = new Date(currentYear, currentMonth, currentDay - 6);

            const yearlySales = await Order.aggregate([
                { $match: { createdOn: { $gte: new Date(`${currentYear}-01-01`) } } },
                {
                    $group: {
                        _id: { $month: "$createdOn" },
                        total: { $sum: "$finalAmount" }
                    }
                },
                { $sort: { "_id": 1 } }
            ]);

            const monthlySales = await Order.aggregate([
                { $match: { createdOn: { $gte: new Date(currentYear, currentMonth, 1) } } },
                {
                    $group: {
                        _id: { $dayOfMonth: "$createdOn" },
                        total: { $sum: "$finalAmount" }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            const weeklySales = await Order.aggregate([
                { $match: { createdOn: { $gte: startOfWeek } } },
                {
                    $group: {
                        _id: { $dayOfWeek: "$createdOn" },
                        total: { $sum: "$finalAmount" }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            res.render("dashboard", {
                totalSales,
                bestSellingProducts,
                bestSellingCategories,
                bestSellingBrands,
                yearlySales,
                monthlySales,
                weeklySales
            });
        } catch (error) {
            console.error(error);
            res.status(500).redirect("/pageerror");
        }
    }
};


 const pageerror=async(req,res)=>{
    res.status(500).render("error") 
};


 const logout=async (req,res)=>{
    try{
        req.session.destroy(err=>{
            if(err){
                console.log("Error destroying session",err);
                return res.status(500).redirect("/pageerror")
            }
            res.status(200).redirect("/admin/login")
        })
    }catch(error){
        console.log("unexpected error during logout",error)
        res.status(500).redirect("/pageerror")
    }
};


module.exports={
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout
}