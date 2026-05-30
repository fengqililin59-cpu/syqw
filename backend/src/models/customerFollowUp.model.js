/**
 * @file 客户跟进记录模型。
 */
import { DataTypes, Model } from 'sequelize';

export class CustomerFollowUp extends Model {
  static initModel(sequelize) {
    CustomerFollowUp.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        type: {
          type: DataTypes.ENUM('call', 'wechat', 'meeting', 'other'),
          allowNull: false,
          defaultValue: 'other',
        },
        content: { type: DataTypes.TEXT, allowNull: false },
        next_follow_at: { type: DataTypes.DATE, allowNull: true },
      },
      { sequelize, modelName: 'CustomerFollowUp', tableName: 'customer_follow_ups' }
    );
    return CustomerFollowUp;
  }
}
