const { PDFDocument, rgb } = require('pdf-lib');
const supabase = require('../config/supabase');
require('dotenv').config();

async function generatePayslipPDF(employee, payrollRecord) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    
    const titleFontSize = 24;
    const subtitleFontSize = 14;
    const textFontSize = 12;
    
    // Add Company Title
    page.drawText('CloudHR Automation Inc.', { x: 50, y: 750, size: titleFontSize });
    page.drawText('Payslip', { x: 50, y: 720, size: subtitleFontSize, color: rgb(0.3, 0.3, 0.3) });
    
    page.drawText(`Month/Year: ${payrollRecord.month}/${payrollRecord.year}`, { x: 400, y: 720, size: textFontSize });
    
    // Add Employee Details
    page.drawText('Employee Details', { x: 50, y: 670, size: subtitleFontSize });
    page.drawText(`Name: ${employee.full_name}`, { x: 50, y: 640, size: textFontSize });
    page.drawText(`Employee ID: ${employee.employee_id}`, { x: 50, y: 620, size: textFontSize });
    page.drawText(`Department: ${employee.department}`, { x: 300, y: 640, size: textFontSize });
    page.drawText(`Designation: ${employee.designation}`, { x: 300, y: 620, size: textFontSize });
    
    // Add Earnings
    page.drawText('Earnings', { x: 50, y: 570, size: subtitleFontSize });
    page.drawText(`Basic Salary: $${payrollRecord.basic}`, { x: 50, y: 540, size: textFontSize });
    page.drawText(`HRA: $${payrollRecord.hra}`, { x: 50, y: 520, size: textFontSize });
    page.drawText(`Allowances: $${payrollRecord.allowances}`, { x: 50, y: 500, size: textFontSize });
    page.drawText(`Gross Earnings: $${payrollRecord.gross}`, { x: 50, y: 470, size: subtitleFontSize });
    
    // Add Deductions
    page.drawText('Deductions', { x: 300, y: 570, size: subtitleFontSize });
    page.drawText(`PF Deduction: $${payrollRecord.pf_deduction}`, { x: 300, y: 540, size: textFontSize });
    page.drawText(`Professional Tax: $${payrollRecord.pt_deduction}`, { x: 300, y: 520, size: textFontSize });
    page.drawText(`TDS: $${payrollRecord.tds_deduction}`, { x: 300, y: 500, size: textFontSize });
    page.drawText(`LWP Deduction: $${payrollRecord.lwp_deduction}`, { x: 300, y: 480, size: textFontSize });
    
    // Add Net Pay
    page.drawText(`Net Pay: $${payrollRecord.net_pay}`, { x: 50, y: 400, size: titleFontSize, color: rgb(0, 0.5, 0) });
    
    // Add footer
    page.drawText('This is a computer generated document. No signature required.', { x: 50, y: 50, size: 10, color: rgb(0.5, 0.5, 0.5) });
    
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

async function uploadPayslipToSupabase(employee_id, month, year, pdfBuffer) {
    const monthFormatted = month.toString().padStart(2, '0');
    const path = `payslips/${employee_id}/${year}-${monthFormatted}.pdf`;

    try {
        const { error } = await supabase.storage
            .from('payslips')
            .upload(path, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: true
            });

        if (error) throw error;
        return path;
    } catch (err) {
        console.error("Supabase Storage Upload Error: ", err);
        return null;
    }
}

async function getPayslipSignedUrl(path) {
    try {
        const { data, error } = await supabase.storage
            .from('payslips')
            .createSignedUrl(path, 900); // 15 mins

        if (error) throw error;
        return data.signedUrl;
    } catch (err) {
        console.error("Supabase Storage Presign Error: ", err);
        return null;
    }
}

module.exports = { generatePayslipPDF, uploadPayslipToSupabase, getPayslipSignedUrl };
