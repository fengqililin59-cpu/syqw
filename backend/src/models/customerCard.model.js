/**
 * @file 客户持卡：次卡（times）/ 储值卡（stored）/ 期限卡（period）。
 * 仅做记录与消耗，不涉及收银与支付。
 */
import { DataTypes, Model } from 'sequelize';

export class CustomerCard extends Model {
  static initModel(sequelize) {
    CustomerCard.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        /** 关联卡项定义 products.id */
        product_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        /** 关联 customer_orders.id */
        order_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        /** times / stored / period */
        card_type: { type: DataTypes.STRING(24), allowNull: false },
        name: { type: DataTypes.STRING(200), allowNull: false },
        total_times: { type: DataTypes.INTEGER, allowNull: true },
        remaining_times: { type: DataTypes.INTEGER, allowNull: true },
        total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
        remaining_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
        /** 实付金额，计入客户 LTV */
        paid_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        valid_from: { type: DataTypes.DATEONLY, allowNull: true },
        valid_until: { type: DataTypes.DATEONLY, allowNull: true },
        /** active / used_up / expired / refunded / frozen */
        status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'active' },
        metadata: { type: DataTypes.JSON, allowNull: true },
        created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        modelName: 'CustomerCard',
        tableName: 'customer_cards',
        underscored: true,
      },
    );
    return CustomerCard;
  }
}
