/**
 * @file 裂变活动（任务宝等）。
 */
import { DataTypes, Model } from 'sequelize';

export class Campaign extends Model {
  static initModel(sequelize) {
    Campaign.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        name: { type: DataTypes.STRING(100), allowNull: false },
        type: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'task_treasure' },
        target_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        reward_type: { type: DataTypes.STRING(32), allowNull: false },
        reward_value: { type: DataTypes.TEXT, allowNull: false },
        start_time: { type: DataTypes.DATE, allowNull: false },
        end_time: { type: DataTypes.DATE, allowNull: false },
        status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'draft' },
      },
      {
        sequelize,
        modelName: 'Campaign',
        tableName: 'campaigns',
        underscored: true,
      },
    );
    return Campaign;
  }
}
