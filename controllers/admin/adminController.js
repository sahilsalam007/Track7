const User=require("../../models/userSchema");
const mongoose=require("mongoose");
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


const loadDashboard=async(req,res)=>{
    if(req.session.admin){
        try{
            res.status(200).render("dashboard")
        }catch(error){
            res.status(500).redirect("/pageerror")
        }
    }
};


 const pageerror=async(req,res)=>{
    res.status(500).render("admin-error") 
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