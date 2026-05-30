/**
 * @file 客户成交订单（简版）。
 */
import { DataTypes, Model } from 'sequelize';

export class CustomerOrder extends Model {
  static initModel(sequelize) {
    CustomerOrder.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        order_no: { type: DataTypes.STRING(64), allowNull: true },
        amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        currency: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'CNY' },
        status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'pending' },
        paid_at: { type: DataTypes.DATE, allowNull: true },
        remark: { type: DataTypes.STRING(500), allowNull: true },
        created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        modelName: 'CustomerOrder',
        tableName: 'customer_orders',
        underscored: true,
      },
    );
    return CustomerOrder;
  }
}
