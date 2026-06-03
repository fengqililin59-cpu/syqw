/**
 * @file 余额交易流水。
 */
import { DataTypes, Model } from 'sequelize';

export class BalanceTransaction extends Model {
  static initModel(sequelize) {
    BalanceTransaction.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        type: {
          type: DataTypes.ENUM('recharge', 'consume', 'refund'),
          allowNull: false,
        },
        amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        balance_after: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        channel: {
          type: DataTypes.ENUM('wechat', 'alipay', 'manual', 'auto_renew', 'addon_purchase'),
          allowNull: false,
          defaultValue: 'manual',
        },
        reference: { type: DataTypes.STRING(128), allowNull: true },
        description: { type: DataTypes.STRING(255), allowNull: true },
      },
      {
        sequelize,
        modelName: 'BalanceTransaction',
        tableName: 'balance_transactions',
        underscored: true,
        timestamps: true,
        updatedAt: false,
      },
    );
    return BalanceTransaction;
  }
}
