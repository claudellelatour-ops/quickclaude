import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { env, isDevelopment, connectDatabase } from './config';
import { errorHandler } from './middleware';

// Import routes
import authRoutes from './modules/auth/auth.routes';
import companyRoutes from './modules/company/company.routes';
import userRoutes from './modules/users/user.routes';
import accountRoutes from './modules/accounts/account.routes';
import journalRoutes from './modules/journal/journal.routes';
import customerRoutes from './modules/customers/customer.routes';
import vendorRoutes from './modules/vendors/vendor.routes';
import invoiceRoutes from './modules/invoices/invoice.routes';
import billRoutes from './modules/bills/bill.routes';
import customerPaymentRoutes from './modules/payments/customerPayment.routes';
import billPaymentRoutes from './modules/payments/billPayment.routes';
import bankingRoutes from './modules/banking/banking.routes';
import reportRoutes from './modules/reports/report.routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 100, // Higher limit in dev
  message: { success: false, error: { message: 'Too many requests, please try again later' } },
});
app.use('/api', limiter);

// Parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging
if (isDevelopment) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/journal-entries', journalRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/customer-payments', customerPaymentRoutes);
app.use('/api/bill-payments', billPaymentRoutes);
app.use('/api/bank-accounts', bankingRoutes);
app.use('/api/reports', reportRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { message: 'Endpoint not found' },
  });
});

// Error handler
app.use(errorHandler);

// Start server
async function startServer() {
  await connectDatabase();

  app.listen(env.PORT, () => {
    console.log(`🚀 Server running on port ${env.PORT}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
    console.log(`   Health check: http://localhost:${env.PORT}/health`);
  });
}

startServer().catch(console.error);

export default app;
