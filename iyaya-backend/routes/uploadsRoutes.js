const express = require("express");
const router = express.Router();
const multer = require("multer");
const { supabase } = require("../config/supabase");

// Configure multer for memory storage (files will be uploaded to Supabase)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and documents
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(
      file.originalname.toLowerCase().split(".").pop(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

// Helper function to upload file to Supabase Storage
const uploadToSupabase = async (file, bucket = "uploads") => {
  const fileExt = file.originalname.split(".").pop();
  const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file.buffer, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.mimetype,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(data.path);

  return {
    filename: fileName,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    url: publicUrl,
    path: data.path,
  };
};

// POST /api/uploads/single - Upload single file
router.post("/single", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    const fileData = await uploadToSupabase(req.file);

    res.json({
      success: true,
      data: fileData,
    });
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({
      success: false,
      error: "File upload failed",
    });
  }
});

// POST /api/uploads/multiple - Upload multiple files
router.post("/multiple", upload.array("files", 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No files uploaded",
      });
    }

    const uploadPromises = req.files.map((file) => uploadToSupabase(file));
    const files = await Promise.all(uploadPromises);

    res.json({
      success: true,
      data: files,
    });
  } catch (error) {
    console.error("Multiple file upload error:", error);
    res.status(500).json({
      success: false,
      error: "File upload failed",
    });
  }
});

// POST /api/uploads/profile - Upload profile image
router.post("/profile", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    const fileData = await uploadToSupabase(req.file, "profiles");

    res.json({
      success: true,
      data: fileData,
    });
  } catch (error) {
    console.error("Profile upload error:", error);
    res.status(500).json({
      success: false,
      error: "Profile upload failed",
    });
  }
});

module.exports = router;
