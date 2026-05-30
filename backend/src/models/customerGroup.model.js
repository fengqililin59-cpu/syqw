/**
 * @file 客户群（企微群）模型。
 */
import { DataTypes, Model } from 'sequelize';

export class CustomerGroup extends Model {
  static initModel(sequelize) {
    CustomerGroup.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        chat_id: { type: DataTypes.STRING(64), allowNull: false },
        name: { type: DataTypes.STRING(100), allowNull: false },
        owner_userid: { type: DataTypes.STRING(64), allowNull: true },
        owner_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        member_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        notice: { type: DataTypes.TEXT, allowNull: true },
        webhook_url: { type: DataTypes.STRING(500), allowNull: true },
        status: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
        raw_json: { type: DataTypes.JSON, allowNull: true },
        last_synced_at: { type: DataTypes.DATE, allowNull: true },
      },
      {
        sequelize,
        modelName: 'CustomerGroup',
        tableName: 'customer_groups',
        underscored: true,
        timestamps: true,
      },
    );
    return CustomerGroup;
  }
}
