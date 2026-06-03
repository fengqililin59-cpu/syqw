/**
 * 构建时 VITE_ALIPAY_ENABLED=0 → 计费页/余额充值不展示支付宝（与后端 ALIPAY_DISABLED 一致）
 */
export const ALIPAY_UI_ENABLED = import.meta.env.VITE_ALIPAY_ENABLED !== '0';
