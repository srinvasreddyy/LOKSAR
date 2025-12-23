import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// --- Multer Configuration ---
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } 
});

// --- Email Configuration ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// --- Helper: Robust Data Formatter ---
const formatValue = (data) => {
  if (data === null || data === undefined || data === '') return 'N/A';
  
  // If it's a simple string or number, return it
  if (typeof data === 'string' || typeof data === 'number') return data;

  // If it's an array, map through it and format each item
  if (Array.isArray(data)) {
    if (data.length === 0) return 'N/A';
    return data.map(item => formatValue(item)).join(', ');
  }

  // If it's an object, try to find a meaningful label
  if (typeof data === 'object') {
    // Check common label keys
    if (data.label) return data.label;
    if (data.value) return data.value;
    if (data.name) return data.name;
    if (data.id && data.id !== 'other') return data.id; // Fallback to ID if not 'other'
    
    // Handle nested 'other' cases (e.g. { id: 'other', other: 'Custom Text' })
    if (data.other) return data.other;
    
    // Last resort: formatted JSON or first value
    const values = Object.values(data);
    if (values.length > 0 && typeof values[0] === 'string') return values[0];
    
    return 'Provided'; // Fallback to avoid [object Object]
  }

  return String(data);
};

// --- Email Styling ---
const generateEmailTemplate = (title, content) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background-color: #0D6B7D; padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 1px; }
        .header p { color: #e0f7fa; margin: 5px 0 0; font-size: 14px; }
        .content { padding: 40px 30px; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
        .section-title { font-size: 16px; font-weight: 700; color: #0D6B7D; text-transform: uppercase; margin: 25px 0 15px 0; border-bottom: 2px solid #e0f2f1; padding-bottom: 8px; }
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .info-table td { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .info-table td:first-child { width: 40%; font-weight: 600; color: #555; }
        .info-table td:last-child { color: #333; }
        .highlight { background-color: #e0f7fa; border-radius: 6px; padding: 15px; border-left: 4px solid #0D6B7D; margin: 20px 0; }
        .description-box { background-color: #f9f9f9; padding: 15px; border-radius: 6px; border: 1px solid #eee; font-style: italic; color: #555; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>LOKSAR</h1>
          <p>Professional Home & Gardening Services</p>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Loksar Services. All rights reserved.</p>
          <p>Leicester, United Kingdom | support@loksar.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const sendEmail = async (to, subject, htmlContent, attachments = []) => {
  try {
    await transporter.sendMail({
      from: `"Loksar Services" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
      attachments,
    });
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// --- Endpoints ---

// 1. Contact Us
app.post('/api/contact', async (req, res) => {
  const { name, email, phone, subject, message } = req.body;

  const adminContent = `
    <h2 style="color: #333; margin-top:0;">New Inquiry</h2>
    <div class="highlight">
      <strong>Subject:</strong> ${subject}
    </div>
    <div class="section-title">Contact Details</div>
    <table class="info-table">
      <tr><td>Name</td><td>${name}</td></tr>
      <tr><td>Email</td><td><a href="mailto:${email}" style="color:#0D6B7D; text-decoration:none;">${email}</a></td></tr>
      <tr><td>Phone</td><td>${phone}</td></tr>
    </table>
    <div class="section-title">Message</div>
    <div class="description-box">${message}</div>
  `;

  const userContent = `
    <h2 style="color: #333; margin-top:0;">Hello ${name},</h2>
    <p>Thank you for contacting <strong>LOKSAR</strong>. We have successfully received your inquiry regarding <strong>"${subject}"</strong>.</p>
    <div class="highlight">
      Our team will review your message and get back to you within 24 hours.
    </div>
    <p>Best Regards,<br>The Loksar Team</p>
  `;

  try {
    await sendEmail(process.env.ADMIN_EMAIL, `New Contact: ${subject}`, generateEmailTemplate('New Contact', adminContent));
    await sendEmail(email, 'We received your message - Loksar', generateEmailTemplate('Thank You', userContent));
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// 2. Cleaning Booking
app.post('/api/book-cleaning', upload.array('files'), async (req, res) => {
  try {
    const userDetails = JSON.parse(req.body.userDetails);
    const bookingDetails = JSON.parse(req.body.bookingDetails);
    const description = req.body.description || '';
    
    const emailAttachments = req.files ? req.files.map(file => ({
      filename: file.originalname,
      content: file.buffer
    })) : [];

    // Specific logic for Best Days which can be nested
    let bestDaysDisplay = 'N/A';
    if (bookingDetails.bestDays) {
      if (Array.isArray(bookingDetails.bestDays)) {
        bestDaysDisplay = formatValue(bookingDetails.bestDays);
      } else if (bookingDetails.bestDays.bestDays) {
        // Handle { bestDays: [...], other: '...' }
        const days = formatValue(bookingDetails.bestDays.bestDays);
        bestDaysDisplay = days;
        if (bookingDetails.bestDays.other) {
          bestDaysDisplay += ` (Other: ${bookingDetails.bestDays.other})`;
        }
      }
    }

    // Specific logic for Current Cleaner
    let currentCleanerDisplay = 'N/A';
    if (bookingDetails.currentCleaner) {
       if (typeof bookingDetails.currentCleaner === 'object' && bookingDetails.currentCleaner.currentCleaner) {
           currentCleanerDisplay = bookingDetails.currentCleaner.currentCleaner;
           if(bookingDetails.currentCleaner.other) currentCleanerDisplay += ` (${bookingDetails.currentCleaner.other})`;
       } else {
           currentCleanerDisplay = formatValue(bookingDetails.currentCleaner);
       }
    }
    
    // Specific logic for Cleaning Type
    let cleaningTypeDisplay = formatValue(bookingDetails.cleaningType);
    if (bookingDetails.cleaningTypeOther) {
      cleaningTypeDisplay += ` (${bookingDetails.cleaningTypeOther})`;
    }

    const bookingRows = `
      <tr><td>Property Type</td><td>${formatValue(bookingDetails.propertyType)}</td></tr>
      <tr><td>Frequency</td><td>${formatValue(bookingDetails.frequency)}</td></tr>
      <tr><td>Bedrooms</td><td>${formatValue(bookingDetails.bedrooms)}</td></tr>
      <tr><td>Bathrooms</td><td>${formatValue(bookingDetails.receptionRooms)}</td></tr>
      <tr><td>Service Type</td><td>${cleaningTypeDisplay}</td></tr>
      <tr><td>Current Cleaner</td><td>${currentCleanerDisplay}</td></tr>
      <tr><td>Preferred Days</td><td>${bestDaysDisplay}</td></tr>
      <tr><td>Supplies</td><td>${formatValue(bookingDetails.supplyMaterials)}</td></tr>
      <tr><td>Hiring Decision</td><td>${formatValue(bookingDetails.hiringDecision)}</td></tr>
      <tr><td>Location</td><td>${formatValue(bookingDetails.location)}</td></tr>
    `;

    // Admin Email
    const adminContent = `
      <h2 style="color: #d32f2f; margin-top:0;">New Cleaning Job Request</h2>
      <div class="section-title">Customer Details</div>
      <table class="info-table">
        <tr><td>Name</td><td>${userDetails.name}</td></tr>
        <tr><td>Email</td><td>${userDetails.email}</td></tr>
        <tr><td>Phone</td><td>${userDetails.phone}</td></tr>
      </table>
      <div class="section-title">Job Specification</div>
      <table class="info-table">${bookingRows}</table>
      <div class="section-title">Customer Notes</div>
      <div class="description-box">${description || 'No additional notes provided.'}</div>
    `;

    // User Email
    const userContent = `
      <h2 style="color: #333; margin-top:0;">Booking Confirmation</h2>
      <p>Dear ${userDetails.name},</p>
      <p>Thank you for choosing <strong>LOKSAR</strong>. We have received your request for a cleaning service.</p>
      <div class="highlight">
        We will review your property details and provide you with a competitive quote shortly.
      </div>
      <div class="section-title">Your Request Summary</div>
      <table class="info-table">${bookingRows}</table>
      <p>Best Regards,<br>The Loksar Team</p>
    `;

    await sendEmail(process.env.ADMIN_EMAIL, 'New Cleaning Job Alert', generateEmailTemplate('New Cleaning Job', adminContent), emailAttachments);
    await sendEmail(userDetails.email, 'Booking Received - Loksar Services', generateEmailTemplate('Booking Received', userContent));

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

// 3. Gardening Booking
app.post('/api/book-gardening', upload.array('files'), async (req, res) => {
  try {
    const userDetails = JSON.parse(req.body.userDetails);
    const bookingDetails = JSON.parse(req.body.bookingDetails);
    const description = req.body.description || '';

    const emailAttachments = req.files ? req.files.map(file => ({
      filename: file.originalname,
      content: file.buffer
    })) : [];

    const bookingRows = `
      <tr><td>Property Type</td><td>${formatValue(bookingDetails.propertyType)}</td></tr>
      <tr><td>Services</td><td>${formatValue(bookingDetails.services)}</td></tr>
      <tr><td>Frequency</td><td>${formatValue(bookingDetails.frequency)}</td></tr>
      <tr><td>Garden Size</td><td>${formatValue(bookingDetails.gardenSize)}</td></tr>
      <tr><td>Condition</td><td>${formatValue(bookingDetails.gardenCondition)}</td></tr>
      <tr><td>Plants</td><td>${formatValue(bookingDetails.plants)}</td></tr>
      <tr><td>Waste Removal</td><td>${formatValue(bookingDetails.gardenWaste)}</td></tr>
      <tr><td>Start Time</td><td>${formatValue(bookingDetails.workBegin)}</td></tr>
      <tr><td>Hiring Decision</td><td>${formatValue(bookingDetails.hiringDecision)}</td></tr>
      <tr><td>Location</td><td>${formatValue(bookingDetails.location)}</td></tr>
    `;

    const adminContent = `
      <h2 style="color: #2e7d32; margin-top:0;">New Gardening Job Request</h2>
      <div class="section-title">Customer Details</div>
      <table class="info-table">
        <tr><td>Name</td><td>${userDetails.name}</td></tr>
        <tr><td>Email</td><td>${userDetails.email}</td></tr>
        <tr><td>Phone</td><td>${userDetails.phone}</td></tr>
      </table>
      <div class="section-title">Job Specification</div>
      <table class="info-table">${bookingRows}</table>
      <div class="section-title">Customer Notes</div>
      <div class="description-box">${description || 'No additional notes provided.'}</div>
    `;

    const userContent = `
      <h2 style="color: #333; margin-top:0;">Booking Confirmation</h2>
      <p>Dear ${userDetails.name},</p>
      <p>Thank you for choosing <strong>LOKSAR</strong>. We have received your gardening service request.</p>
      <div class="highlight">
        Our gardening experts will review your requirements and get back to you soon.
      </div>
      <div class="section-title">Your Request Summary</div>
      <table class="info-table">${bookingRows}</table>
      <p>Best Regards,<br>The Loksar Team</p>
    `;

    await sendEmail(process.env.ADMIN_EMAIL, 'New Gardening Job Alert', generateEmailTemplate('New Gardening Job', adminContent), emailAttachments);
    await sendEmail(userDetails.email, 'Booking Received - Loksar Services', generateEmailTemplate('Booking Received', userContent));

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});