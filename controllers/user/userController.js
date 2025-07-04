const User=require("../../models/userSchema")
const Category=require("../../models/categorySchema");
const Product=require("../../models/productSchema");
const Brand=require("../../models/brandSchema")
const env=require("dotenv").config();
const nodemailer=require("nodemailer")
const bcrypt=require("bcrypt");


const pageNotFound=async(req,res)=>{
    try{
        res.render("page-404")
    }catch(error){
        res.redirect("/pageNotFound")
    }
}


const loadHomepage=async (req,res)=>{
    try{
        const user=req.session.user;
        const categories = await Category.find({isListed:true});
        let productData=await Product.find(
            {isBlocked:false, category :{$in:categories.map(category=>category._id)},quantity:{$gt:0}}
        )
        productData.sort((a,b)=>new Date(b.createOn) - new Date(a.createdOn));
        productData=productData.slice(0,4)
        if(user){
            const userData=await User.findOne({_id:user});
            res.render("home",{user:userData , products:productData})
        }else{
            return res.render("home",{products:productData});
        }
    }
    catch(error){
        console.log("Home page not found");
        res.status(500).send("server error")
    }
}


const loadSignup=async (req,res)=>{
    try{
        return res.render("signup");
    }catch(error){
        console.log("Home page not loading",error);
        res.status(500).send("Server Error")
    }
}


function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString();
}


async function sendVerificationEmail(email,otp){
    try{
        console.log("verification mail")
        const transporter=nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            },
            debug:true
        })
        const info=await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Verify your account",
            text:`Your OTP is ${otp}`,
            html:`<b>Your OTP: ${otp}</b>`
        })
        return info.accepted.length>0
    }
    catch(error){
console.error("Error sending email",error);
return false;
    }
}


const signup=async(req,res)=>{
    try{
        const {name,phone,email,password,confirmPassword}=req.body;
        if(password!==confirmPassword){
            return res.render("signup",{message:"Passwords do not match"})
        }
        const findUser=await User.findOne({email});
        if(findUser){
            return res.render("signup",{message:"User with this email already exists"})
        }
        const otp=generateOtp();
        const emailSent=await sendVerificationEmail(email,otp);
        if(!emailSent){
            return res.json("email-error");
        }
        req.session.userOtp=otp;
        req.session.userData={name,phone,email,password};
        res.render("verify-otp");
        console.log("OTP Sent",otp)
    }
    catch(error){
console.error("Signup error",error);
res.redirect("/pageNotFound")
    }
}


const securePassword=async(password)=>{
    try {
        const passwordHash =await bcrypt.hash(password,10);
        return passwordHash;
        
    } catch (error) {
        console.error("Error hashing password:", error);
        return null;
    }
}


const verifyOtp=async(req,res)=>{
    try{
        const {otp}=req.body;
        console.log(req.session.userOtp,otp);
        if(otp===req.session.userOtp){
            const user=req.session.userData;
            const passwordHash=await securePassword(user.password)

            const saveUserData= new User({
                name:user.name,
                email:user.email,
                phone:user.phone,
                password:passwordHash,
            })
            await saveUserData.save();
            req.session.user=saveUserData._id;
            res.json({success:true,redirectUrl:"/"})
        }else{
            res.status(400).json({success:false,message:"Invalid OTP,Please try again"})
        }
    }
    catch(error){
        console.log(error.message)
        res.status(500).json({success:false,message:"An orror occured"})
    }
} 


const resendOtp=async(req,res)=>{
    try{
        const {email}=req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }
        const otp=generateOtp();
        req.session.userOtp=otp;
        const emailSent=await sendVerificationEmail(email,otp)
        if(emailSent){
            console.log("Resend OTP:",otp);
            res.status(200).json({success:true,message:"OTP Resend Succesfully"})
        }else{
            res.status(500).json({success:false,message:"Failed to resend OTP , Please try again"});
        }
    }
    catch(error){
        console.error("Error resending OTP",error);
        res.status(500).json({success:false,message:"Internal Server Error , Please try again"})
    }
}


const loadLogin=async(req,res)=>{
    try{
        if(!req.session.user){
            return res.render("login")
        }
        else{
        res.redirect("/")
        }
    }
    catch(error){
        res.redirect("/pageNotFound")
    }
}


const login=async(req,res)=>{
    try{
        const {email,password}=req.body;
        const findUser=await User.findOne({isAdmin:0,email:email})
        if(!findUser){
            return res.render("login",{message:"User not found"})
        }
        if(findUser.isBlocked){
            return res.render("login",{message:"User is blocked by admin"})
        }

        const passwordMatch=await bcrypt.compare(password,findUser.password);
        if(!passwordMatch){
            return res.render("login",{message:"Incorrect Password"})
        }
        req.session.user=findUser._id;
        res.redirect("/");
    }
    catch(error){
        console.error("login error",error);
        res.render("login",{message:"login failed . Please try again later"})
    }
} 


const logout=async=(req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log("Session destruction error",err.message);
                return res.redirect("/pageNotFound");
            }
            return res.redirect("/login")
        })
    } catch (error) {
        console.log("Logout error",error);
        res.redirect("/pageNotFound")
    }
}


const loadShoppingPage = async (req, res) => {
    try {
        const userId = req.session.user ? req.session.user._id : null;
        let userData = userId ? await User.findById(userId) : null;

        const query = {
            search: req.query.search || '',
            sort: req.query.sort || '',
            category: req.query.category || '',
            brand: req.query.brand || '',
            maxPrice: req.query.maxPrice || '',
            minPrice: req.query.minPrice || '',
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 12
        };

        const filter = {
            isBlocked: false,
            status: "Available"
        };

        if (query.search) {
            filter.productName = { $regex: query.search, $options: 'i' };
        }

        if (query.category) {
            filter.category = query.category;
        }

        if (query.brand) {
            filter.brand = query.brand;
        }

        if (query.minPrice || query.maxPrice) {
            filter.salesPrice = {};
            if (query.minPrice) filter.salesPrice.$gte = parseInt(query.minPrice);
            if (query.maxPrice) filter.salesPrice.$lte = parseInt(query.maxPrice);
        }

        let sortOptions = {};
        switch (query.sort) {
            case 'price-asc':
                sortOptions = { salesPrice: 1 };
                break;
            case 'price-desc':
                sortOptions = { salesPrice: -1 };
                break;
            case 'name-asc':
                sortOptions = { productName: 1 };
                break;
            case 'name-desc':
                sortOptions = { productName: -1 };
                break;
            default:
                sortOptions = { createdAt: -1 };
        }

        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / query.limit);
        const skip = (query.page - 1) * query.limit;

        const [products, categories, brands] = await Promise.all([
            Product.find(filter)
                .sort(sortOptions)
                .skip(skip)
                .limit(query.limit)
                .populate("category")
                .populate("brand"),
            Category.find({ isListed: true }),
            Brand.find()
        ]);

        const updatedProducts = products.map(product => {
            const regularPrice = product.regularPrice;
            const productOffer = product.productOffer || 0;
            const categoryOffer = product.category?.categoryOffer || 0;

            const highestOffer = Math.max(productOffer, categoryOffer);
            const discountAmount = (regularPrice * highestOffer) / 100;
            const finalSalesPrice = Math.round(regularPrice - discountAmount);

            return {
                ...product._doc,
                finalSalesPrice,
                appliedOffer: highestOffer
            };
        });

        let wishlistItems = [];
        let cartItems = [];

        if (userId) {
            const wishlist = await Wishlist.findOne({ userId }).select("products");
            wishlistItems = wishlist ? wishlist.products.map(item => item.productId.toString()) : [];

            const cart = await Cart.findOne({ userId }).select("items.productId");
            cartItems = cart ? cart.items.map(item => item.productId.toString()) : [];
        }

        res.render("shop", {
            products: updatedProducts,
            categories,
            brands,
            query,
            userData,
            isLoggedIn: !!userId,
            wishlistItems,
            cartItems,
            currentPage: query.page,
            totalPages
        });

    } catch (error) {
        console.error("Shop page error:", error);
        res.render("login");
    }
};



module.exports={
    loadHomepage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    loadShoppingPage
}