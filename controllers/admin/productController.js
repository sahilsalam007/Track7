const Product=require("../../models/productSchema");
const Category=require("../../models/categorySchema");
const Brand=require("../../models/brandSchema");
const User=require("../../models/userSchema")
const fs=require("fs");
const path=require("path");
const sharp=require("sharp")


const getProductAddPage=async(req,res)=>{
    try {
        const category=await Category.find({isListed:true});
        const brand=await Brand.find({isBlocked:false});
        res.status(200).render("product-add",{
            cat:category,
            brand:brand
        })
    } catch (error) {
        res.status(500).redirect("/pageerror")
    }
};


const addProducts=async (req,res)=>{
    try {
        const products=req.body;
        const productExists=await Product.findOne({
            productName:products.productName,
        })
        if(!productExists){
            const images=[];
            if(req.files && req.files.length>0){
                for(let i=0;i<req.files.length;i++){
                    const originalImagePath=req.files[i].path;
                    const uploadDir = path.join("public", "uploads", "product-images");
                     if (!fs.existsSync(uploadDir)) {
                     fs.mkdirSync(uploadDir, { recursive: true });
                     }

                     const resizedImagePath = path.join(uploadDir, req.files[i].filename);
                    await sharp(originalImagePath)
                     .resize({ width: 440, height: 440, fit: "cover" })
                     .toFile(resizedImagePath);

                    await sharp(originalImagePath).resize({width:440,height:440,fit:"cover"}).toFile(resizedImagePath)

                    images.push(req.files[i].filename);
                }
            }
            const categoryId =await Category.findOne({name:products.category});

            if(!categoryId){
                return res.status(400).json({message:'Invalid category name'});
            }
            const newProduct=new Product({
                productName:products.productName,
                description:products.description,
                brand:products.brand,
                category:categoryId._id,
                regularPrice:products.regularPrice,
                salesPrice:products.salesPrice,
                createdOn:new Date(),
                quantity:products.quantity,
                size:products.size,
                color:products.color,
                productImage:images,
                status:"Available",
            });
            await newProduct.save();
            return res.status(201).redirect("/admin/products");
        }else{
            return res.status(400).json({message:"Product already exist, please try with another name"});
        }
    } catch (error) {
        console.error("Error saving product",error);
        return res.status(500).redirect("/admin/pageerror")
    }
};


const getAllProducts=async (req,res)=>{
    try {
        const search=req.query.search || "";
        const page=req.query.page || 1;
        const limit=10;

        const productData=await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},
                {brand:{$regex:new RegExp(".*"+search+".*","i")}}
            ],

        })
        .sort({createdAt:-1})
        .limit(limit*1)
        .skip((page-1)*limit)
        .populate("category")
        .exec();
        console.log(productData)
        const count=await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},
                {brand:{$regex:new RegExp(".*"+search+".*","i")}}
            ],
        }).countDocuments();
        const category=await Category.find({isListed:true})
        const brand =await Brand.find({isBlocked:false})

        if(category && brand){
            res.render("products",{
                data:productData,
                currentPage:page,
                totalPages:Math.ceil(count/limit),
                cat:category,
                brand:brand,
            })
        }else{
            res.status(404).render("page-404");

        }

    } catch (error) {
        res.status(500).redirect("/pageerror")
    }
};


const blockProduct=async (req,res)=>{
    try{
        let id=req.query.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:true}});
        res.status(200).redirect("/admin/products");
    }catch(error){
        res.status(500).redirect("/pageerror")
    }
};


const unblockProduct=async(req,res)=>{
    try{
        let id=req.query.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:false}});
        res.status(200).redirect("/admin/products");
    }catch(error){
        res.status(500).redirect("/pageerror")
    }
};


const getEditProduct=async(req,res)=>{
    try{
        const id=req.query.id;
        const product=await Product.findOne({_id:id});
        const category=await Category.find({});
        const brand =await Brand.find({});
        res.status(200).render("edit-product",{
            product:product,
            cat:category,
            brand:brand,
        })
    } catch(error){
        res.status(500).redirect("pageerror")
    }
};


const editProduct = async (req, res) => {
    try {
      const id = req.params.id;
      const data = req.body;
  
      const existingProduct = await Product.findOne({
        productName: data.productName,
        _id: { $ne: id },
      });
      if (existingProduct) {
        return res.status(400).json({ error: "Product with this name already exists." });
      }

      const images = [];
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          images.push(req.files[i].filename);
        }
      }

      const updateQuery = {
        $set: {
          productName: data.productName,
          description: data.description,
          brand: data.brand,
          category: data.category,
          regularPrice: data.regularPrice,
          salePrice: data.salePrice,
          quantity: data.quantity,
          size: data.size,
          color: data.color,
        },
      };

      if (images.length > 0) {
        updateQuery.$push = { productImage: { $each: images } };
      }

      await Product.findByIdAndUpdate(id, updateQuery, { new: true }); 
      console.log("Update successful");
      res.status(200).redirect("/admin/products");
    } catch (error) {
      console.error(error);
      res.status(500).redirect("/pageerror");
    }
};
  

const deleteSingleImage=async(req,res)=>{
    try {
        ;
        const{imageNameToServer,productIdToServer}=req.body;
        const product=await Product.findByIdAndUpdate(productIdToServer,{$pull:{productImage:imageNameToServer}});
        const imagePath=path.join("public","uploads","re-image",imageNameToServer);
        if(fs.existsSync(imagePath)){
            await fs.unlinkSync(imagePath);
            console.log(`Image ${imageNameToServer} deleted successfully`);
        }else{
            console.log(`Image ${imageNameToServer} not found`)
        }
        res.send({status:true});

    } catch (error) {
        res.status(500).redirect("/pageerror")
    }
};


module.exports={
    getProductAddPage,
    addProducts,
    getAllProducts,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage
}