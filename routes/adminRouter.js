const express=require("express");
const router=express.Router();
const adminController=require("../controllers/admin/adminController");
const {userAuth,adminAuth,isSessionAdmin}=require("../middlewares/auth");
const customerController=require("../controllers/admin/customerController");
const categoryController=require("../controllers/admin/categoryController");
const multer=require("multer");
const storage=require("../helpers/multer");
const uploads=multer({storage});
const brandController=require("../controllers/admin/brandController");
const productController=require("../controllers/admin/productController");


// admins auth
router.get("/pageerror",adminController.pageerror);
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/",isSessionAdmin,adminAuth,adminController.loadDashboard);
router.get("/logout",adminController.logout);


//customer management
router.get("/users",isSessionAdmin,adminAuth,customerController.customerInfo);
router.get("/blockCustomer",adminAuth,customerController.customerBlocked);
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked);

//category management
router.get("/category",isSessionAdmin,adminAuth,categoryController.categoryInfo);
router.post("/addCategory",isSessionAdmin,adminAuth,categoryController.addCategory);
router.post("/addCategoryOffer",adminAuth,categoryController.addCategoryOffer);
router.post("/removeCategoryOffer",adminAuth,categoryController.removeCategoryOffer);
router.get("/listCategory",adminAuth,categoryController.getListCategory);
router.get("/unlistCategory",adminAuth,categoryController.getUnlistCategory);
router.get("/editCategory",adminAuth,categoryController.getEditCategory);
router.post("/editCategory/:id",adminAuth,categoryController.editCategory);


//brand management
router.get("/brands",isSessionAdmin,adminAuth,brandController.getBrandPage);
router.post("/addBrand",adminAuth,uploads.single("image"),brandController.addBrand);
router.get("/blockBrand",adminAuth,brandController.blockBrand);
router.get("/unblockBrand",adminAuth,brandController.unBlockBrand);
router.get("/deleteBrand",adminAuth,brandController.deleteBrand);


//product management
router.get("/addProducts",isSessionAdmin,adminAuth,productController.getProductAddPage);
router.post("/addProducts",adminAuth,uploads.array("images",4),productController.addProducts);
router.get("/products",isSessionAdmin,adminAuth,productController.getAllProducts);
router.get("/blockProduct",adminAuth,productController.blockProduct);
router.get("/unblockProduct",adminAuth,productController.unblockProduct);
router.get("/editProduct",adminAuth,productController.getEditProduct);
router.post("/editProduct/:id",adminAuth,uploads.array("images",4),productController.editProduct);
router.post("/deleteImage",adminAuth,productController.deleteSingleImage);

module.exports=router;