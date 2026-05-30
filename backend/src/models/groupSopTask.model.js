/**
 * @file 群 SOP 任务模型。
 */
import { DataTypes, Model } from 'sequelize';

export class GroupSopTask extends Model {
  static initModel(sequelize) {
    GroupSopTask.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        name: { type: DataTypes.STRING(100), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        msg_type: {
          type: DataTypes.ENUM('text', 'image', 'link', 'miniprogram'),
          allowNull: false,
          defaultValue: 'text',
        },
        content_json: { type: DataTypes.JSON, allowNull: false },
        trigger_type: {
          type: DataTypes.ENUM('scheduled', 'recurring'),
          allowNull: false,
          defaultValue: 'scheduled',
        },
        scheduled_at: { type: DataTypes.DATE, allowNull: true },
        recurring_cron: { type: DataTypes.STRING(64), allowNull: true },
        recurring_desc: { type: DataTypes.STRING(100), allowNull: true },
        status: {
          type: DataTypes.ENUM('draft', 'active', 'paused', 'done'),
          allowNull: false,
          defaultValue: 'draft',
        },
        created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      },
      {
        sequelize,
        modelName: 'GroupSopTask',
        tableName: 'group_sop_tasks',
        underscored: true,
        timestamps: true,
      },
    );
    return GroupSopTask;
  }
}
