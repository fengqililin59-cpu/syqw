/**
 * @file 客户添加记录（回调 / 获客链路；与活码 state 对齐）。
 */
import { DataTypes, Model } from 'sequelize';

export class WeworkCustomerAddRecord extends Model {
  static initModel(sequelize) {
    WeworkCustomerAddRecord.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        channel_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        external_userid: { type: DataTypes.STRING(64), allowNull: true },
        follow_userid: { type: DataTypes.STRING(64), allowNull: true },
        state: { type: DataTypes.STRING(128), allowNull: true },
        raw_payload: { type: DataTypes.JSON, allowNull: true },
      },
      {
        sequelize,
        modelName: 'WeworkCustomerAddRecord',
        tableName: 'wework_customer_add_records',
        underscored: true,
        updatedAt: false,
      },
    );
    return WeworkCustomerAddRecord;
  }
}
