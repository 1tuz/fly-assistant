#!/bin/bash
# Create mock file structure for testing

mkdir -p mock_data/documents/reports
mkdir -p mock_data/documents/invoices  
mkdir -p mock_data/archive/2024
mkdir -p mock_data/archive/2025

# Create some test files
echo "Q1 Report 2024" > mock_data/documents/reports/q1_report.txt
echo "Q2 Report 2024" > mock_data/documents/reports/q2_report.txt
echo "Q3 Report 2024" > mock_data/documents/reports/q3_report.txt

echo "Invoice #001" > mock_data/documents/invoices/invoice_001.txt
echo "Invoice #002" > mock_data/documents/invoices/invoice_002.txt

echo "Old data" > mock_data/archive/2024/old_file.txt

echo "✅ Mock data created in mock_data/"
ls -R mock_data/
