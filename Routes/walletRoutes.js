import express from 'express';
import { requestWithdrawal, getMyWallet, getAllWithdrawals } from '../Controllers/walletController.js';
import { protect, adminOnly } from '../Middleware/authMiddleware.js';

const router = express.Router();

router.post('/withdraw', protect, requestWithdrawal);
router.get('/my-wallet', protect, getMyWallet);
router.get('/admin/withdrawals', protect, adminOnly, getAllWithdrawals);

export default router;
