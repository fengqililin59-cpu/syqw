/**
 * @file 支付记录（当前为手动确认模式）。
 */
import { DataTypes, Model } from 'sequelize';

export class PaymentRecord extends Model {
  static initModel(sequelize) {
    PaymentRecord.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        plan_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        billing_cycle: {
          type: DataTypes.ENUM('monthly', 'yearly'),
          allowNull: false,
          defaultValue: 'monthly',
        },
        amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        currency: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: 'CNY' },
        status: {
          type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
          allowNull: false,
          defaultValue: 'pending',
        },
        pay_channel: {
          type: DataTypes.ENUM('wechat', 'alipay', 'manual'),
          allowNull: false,
          defaultValue: 'manual',
        },
        purchase_type: {
          type: DataTypes.ENUM('subscription', 'balance_recharge', 'addon_purchase'),
          allowNull: false,
          defaultValue: 'subscription',
        },
        out_trade_no: { type: DataTypes.STRING(64), allowNull: false, unique: true },
        pay_code_url: { type: DataTypes.STRING(512), allowNull: true },
        wechat_transaction_id: { type: DataTypes.STRING(64), allowNull: true },
        paid_at: { type: DataTypes.DATE, allowNull: true },
        remark: { type: DataTypes.STRING(255), allowNull: true },
        metadata: { type: DataTypes.JSON, allowNull: true },
      },
      {
        sequelize,
        modelName: 'PaymentRecord',
        tableName: 'payment_records',
        underscored: true,
        timestamps: true,
      },
    );
    return PaymentRecord;
  }
}
