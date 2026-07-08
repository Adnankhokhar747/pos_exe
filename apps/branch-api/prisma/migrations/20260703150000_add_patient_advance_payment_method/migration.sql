-- Add patient_advance to PaymentMethod enum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'patient_advance';
